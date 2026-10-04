import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NOTICE, USAGE, VERSION, guardFormula, mdCell, parseArgs, toJson, toMarkdown, toText } from '../src/index.js';
import { GOOD, nygard, reportOf, run } from './helpers.js';

const BAD = { ...GOOD, 'adr/0005-broken.md': nygard({ title: '# 5. Broken', status: 'Approved', consequences: null }) };

test('cli: exit 0 with no finding at or above the fail level, 1 with one, and the fail level from the command line', async () => {
  const good = await run(GOOD, ['adr']);
  assert.equal(good.code, 0, good.err);
  assert.match(good.out, /^adr-health-check: adr\nfolder: adr \(3 records, 0 other files, 0 subfolders, 0 symbolic links\)\n/);
  assert.match(good.out, /RESULT: PASS - no finding at or above warning\n$/);
  const bad = await run(BAD, ['adr']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /RESULT: FAIL - 2 findings at or above warning\n$/);
  assert.match(bad.out, /NOTICE   numbering-gap     adr\n/);
  assert.equal((await run(BAD, ['adr', '--fail-on', 'error'])).code, 1);
  const gap = { ...GOOD, 'adr/0005-later.md': nygard({ title: '# 5. Later' }) };
  assert.equal((await run(gap, ['adr'])).code, 0, 'a notice is below the default fail level');
  assert.equal((await run(gap, ['adr', '--fail-on', 'notice'])).code, 1);
  assert.equal((await run({ ...gap, 'c.json': '{"failOn": "notice"}' }, ['adr', '--config', 'c.json'])).code, 1);
  assert.equal((await run({ ...gap, 'c.json': '{"failOn": "notice"}' }, ['adr', '--config', 'c.json', '--fail-on', 'warning'])).code, 0, 'the command line wins');
});

test('cli: exit 2 for usage errors, with the usage', async () => {
  for (const [args, message] of [
    [[], /give the folder of records to check/],
    [['a', 'b'], /one folder at a time; b is a second one/],
    [['adr', '--bogus'], /unknown argument --bogus/],
    [['adr', '--format', 'html'], /unknown format html/],
    [['adr', '--format', 'json', '--format', 'text'], /--format was given twice/],
    [['adr', '--fail-on', 'fatal'], /unknown level fatal/],
    [['adr', '--config'], /--config needs a value/],
    [['adr', '--config', '--explain'], /--config needs a value/],
    [['adr', '--out', 'a', '--out', 'b'], /--out was given twice/],
    [['-'], /reading from standard input is not supported/],
    [['adr', '--config', '-'], /reading from standard input is not supported/],
    [['https://example.com/adr'], /give a local path; the tool never fetches a URL/]
  ]) {
    const r = await run(GOOD, args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, message);
    assert.ok(r.err.includes('Usage: adr-health-check'), args.join(' '));
    assert.equal(r.out, '');
  }
  assert.deepEqual(parseArgs(['adr', '--explain', '--format', 'json']).format, 'json');
});

test('cli: exit 2 for input errors, with every problem and no verdict', async () => {
  const missing = await run(GOOD, ['nowhere']);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /no verdict, the input has a problem:\n {2}nowhere: no such folder\n/);
  assert.match((await run(GOOD, ['adr/0001-record-decisions.md'])).err, /is not a folder; give the folder that holds the records/);
  const both = await run({ ...GOOD, 'adr/0009-bin.md': Buffer.from([35, 32, 0, 1]), 'c.json': '{"nmae": 1}' }, ['adr', '--config', 'c.json']);
  assert.equal(both.code, 2);
  assert.match(both.err, /c\.json:1: nmae: unknown key; did you mean name\?/);
  assert.match((await run({ ...GOOD, 'adr/0009-bin.md': Buffer.from([35, 32, 0, 1]) }, ['adr'])).err, /adr\/0009-bin\.md: holds binary data \(a null byte\); only text is read/);
  assert.match((await run({ ...GOOD, 'adr/0009-u16.md': Buffer.from([0xff, 0xfe, 35, 0]) }, ['adr'])).err, /is UTF-16; only UTF-8 is read/);
  assert.match((await run({ ...GOOD, 'adr/0009-latin.md': Buffer.from([35, 32, 0xe9, 10]) }, ['adr'])).err, /is not valid UTF-8/);
  assert.match((await run(GOOD, ['adr', '--config', 'none.json'])).err, /none\.json: no such file/);
});

test('cli: --help, --version, --print-defaults', async () => {
  const help = await run({}, ['--help']);
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const option of ['--config', '--format', '--explain', '--fail-on', '--out', '--print-defaults', '--help', '--version']) assert.ok(USAGE.includes(option), option);
  assert.match(USAGE, /Exit codes: 0 no finding at or above the fail level, 1 a finding at or above it, 2 usage or input error\./);
  const version = await run({}, ['--version']);
  assert.equal(version.out, `${VERSION}\n`);
  assert.equal(VERSION, '1.0.0');
  const defaults = await run({}, ['--print-defaults']);
  assert.equal(defaults.code, 0);
  assert.equal(JSON.parse(defaults.out).useDefaultLayouts, false);
});

test('cli: --out writes the report there and nothing else, and refuses the folder of records and the configuration', async () => {
  const r = await run({ ...GOOD, 'c.json': '{}' }, ['adr', '--config', 'c.json', '--out', 'report.md', '--format', 'markdown']);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, '');
  assert.match(r.err, /the report is in report\.md; PASS/);
  const into = await run(GOOD, ['adr', '--out', 'adr/report.txt']);
  assert.equal(into.code, 2);
  assert.match(into.err, /adr\/report\.txt: is inside the folder of records/);
  const config = await run({ ...GOOD, 'c.json': '{}' }, ['adr', '--config', 'c.json', '--out', 'c.json']);
  assert.match(config.err, /c\.json: is one of the inputs/);
});

test('cli: a run leaves the folder as it was, and a folder with no record passes with a note', async () => {
  const { withFiles, cli } = await import('./helpers.js');
  await withFiles(GOOD, async (dir) => {
    const before = await readdir(resolve(dir, 'adr'));
    const contents = await Promise.all(before.map((f) => readFile(resolve(dir, 'adr', f), 'utf8')));
    await cli(['adr', '--format', 'json'], dir);
    const after = await readdir(resolve(dir, 'adr'));
    assert.deepEqual(after, before);
    assert.deepEqual(await Promise.all(after.map((f) => readFile(resolve(dir, 'adr', f), 'utf8'))), contents);
  });
  const empty = await run({ 'adr/README.md': '# Index\n', 'adr/notes.txt': 'x' }, ['adr']);
  assert.equal(empty.code, 0);
  assert.match(empty.out, /note: the folder holds no record: no file name ends with \.md other than the ignored files/);
  assert.match(empty.out, /note: not read as records: README\.md/);
  assert.match(empty.out, /folder: adr \(0 records, 2 other files/);
  const sub = await run({ ...GOOD, 'adr/drafts/0009-x.md': '# x\n' }, ['adr']);
  assert.match(sub.out, /note: 1 subfolder was not read: drafts/);
});

test('reports: text, Markdown and JSON hold the same findings; --explain adds the rule, the reasons and the sources', () => {
  const r = reportOf({ '0001-a.md': nygard({ title: '# 1. A', consequences: null }), '0002-b.md': nygard({ title: '# 2. B', status: 'Superseded' }) });
  const text = toText(r);
  assert.match(text, /ERROR {4}missing-section {3}adr\/0001-a\.md\n {11}required section Consequences of the Nygard layout is missing\n/);
  assert.ok(text.includes(NOTICE));
  assert.ok(!text.includes('why:'));
  const explained = toText(r, { explain: true });
  assert.match(explained, / {11}rule: a section of the layout of a record at level required \(finding at error\)/);
  assert.match(explained, / {11}basis: "We will use a format with just a few parts, so each document is easy to digest\." \(Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www\.cognitect\.com\)/);
  assert.match(explained, / {11}basis: "MADR is a streamlined template .*" \(Markdown Architectural Decision Records, https:\/\/adr\.github\.io\/madr\/\)/);
  assert.match(explained, /Records \(2\)\n\n {2}number {2}file/);
  const markdown = toMarkdown(r, { explain: true });
  assert.match(markdown, /^## adr-health-check: FAIL - 2 findings at or above warning\n/);
  assert.match(markdown, /\| \*\*error\*\* \| missing-section \| required section Consequences of the Nygard layout is missing \| adr/);
  assert.match(markdown, /#### superseded-link: adr\/0002-b\.md:5:1/);
  assert.match(markdown, /\| 2 \| adr\/0002-b\.md \| nygard \| superseded \| none \|/);
  const json = JSON.parse(toJson(r));
  assert.equal(json.tool, 'adr-health-check');
  assert.equal(json.findings.length, 2);
  assert.equal(json.findings[0].why, undefined);
  assert.equal(JSON.parse(toJson(r, { explain: true })).findings[0].why.length > 0, true);
  assert.deepEqual(json.records.map((x) => x.status.word), ['accepted', 'superseded']);
  assert.equal(json.verdict.pass, false);
});

test('reports: text from a record cannot break a table, make a link, run as a formula or rewrite the terminal', () => {
  const esc = String.fromCharCode(27);
  const rlo = String.fromCharCode(0x202e);
  const r = reportOf({ '0001-a.md': nygard({ title: `# =HYPERLINK("x")|[a](b)<b>${esc}[31m${rlo}`, status: `Odd${esc}[2J`, decision: `We will.\n\n### =cmd|<b>[a](b)${esc}[31m${rlo}` }) });
  for (const out of [toText(r, { explain: true }), toMarkdown(r, { explain: true }), toJson(r, { explain: true })]) {
    assert.ok(!out.includes(esc), 'no escape character');
    assert.ok(!out.includes(rlo), 'no direction control');
  }
  const md = toMarkdown(r);
  assert.ok(md.includes('the heading "=cmd\\|&lt;b&gt;\\[a\\](b)'), md);
  assert.equal(guardFormula('=1+1'), "'=1+1");
  assert.equal(guardFormula('-x'), "'-x");
  assert.equal(guardFormula('plain'), 'plain');
  assert.equal(mdCell('a|b [c](d) `e` *f* _g_ <h> & \\ \n'), 'a\\|b \\[c\\](d) \\`e\\` \\*f\\* \\_g\\_ &lt;h&gt; &amp; \\\\  ');
  assert.equal(mdCell('@cmd'), "'@cmd");
});
