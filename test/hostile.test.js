import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FILE_LIMITS, LIMITS, MARKDOWN_LIMITS, MAX_PROBLEMS, findLinks, parseJson, readRecord, defaultConfig } from '../src/index.js';
import { GOOD, cli, md, nygard, run, withFiles } from './helpers.js';

// Hostile input: folders and records built to exhaust the memory or the time, to make the tool follow a link out of the
// folder, to rewrite the terminal or to change how objects behave. Each test also checks the time, because work that
// grows faster than the input is a failure even when the answer is right. Tests that need a symbolic link or a device
// are guarded with process.platform, and none of them asserts a line or a column: those are asserted in the tests that
// run everywhere.

const LIMIT = { timeout: 180000 };
// Coverage counting slows every line of the tool several times over, so a run with --experimental-test-coverage gets a
// wider time limit. A plain `npm test` keeps the tight one, and that is the run that guards against slow growth.
// The runner sets NODE_V8_COVERAGE for its test processes only when coverage is on.
const COVERAGE = Boolean(process.env.NODE_V8_COVERAGE);
const fast = async (fn, ms = 5000) => {
  const limit = COVERAGE ? ms * 4 : ms;
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < limit, `took ${Date.now() - start} ms`);
  return result;
};

test('hostile: a record over the size limit is refused before it is read, and so is a folder over the total or the entry limit', LIMIT, async () => {
  const big = await fast(() => run({ ...GOOD, 'adr/0009-big.md': `# Big\n\n${'x'.repeat(FILE_LIMITS.maxRecordBytes + 1)}` }, ['adr']));
  assert.equal(big.code, 2);
  assert.match(big.err, /adr\/0009-big\.md: [\d,]+ bytes is over the 1 MB limit/);
  const total = await run(GOOD, ['adr'], { maxTotalBytes: 300 });
  assert.equal(total.code, 2);
  assert.match(total.err, /the records together are over the/);
  const entries = await run(GOOD, ['adr'], { maxEntries: 2 });
  assert.equal(entries.code, 2);
  assert.match(entries.err, /adr: holds more than 2 entries; check a smaller folder/);
  assert.equal(LIMITS.maxEntries, 5000);
});

test('hostile: five hundred records with links between them are read and checked in seconds', LIMIT, async () => {
  const files = {};
  for (let i = 1; i <= 500; i += 1) {
    const n = String(i).padStart(4, '0');
    files[`adr/${n}-record-${i}.md`] = nygard({ title: `# ${i}. Record ${i}`, status: i % 7 === 0 ? 'Proposed' : 'Accepted', decision: `We will follow [the last one](${String(Math.max(1, i - 1)).padStart(4, '0')}-record-${Math.max(1, i - 1)}.md) and [a missing one](9${n}-x.md).` });
  }
  const r = await fast(() => run(files, ['adr', '--format', 'json']), 20000);
  assert.equal(r.code, 1, r.err.slice(0, 300));
  const report = JSON.parse(r.out);
  assert.equal(report.totals.records, 500);
  assert.equal(report.totals.links.broken, 500);
  assert.equal(report.findings.filter((f) => f.rule === 'stale-proposed').length > 60, true);
});

test('hostile: a line of megabytes, deep nesting, thousands of headings and lines full of link openers are read in one pass', LIMIT, async () => {
  const config = defaultConfig();
  const long = `# T\n\n## Decision\n\n${'word '.repeat(600000)}\n`;
  await fast(() => readRecord('0001-a.md', long, config));
  const deep = `# T\n\n${Array.from({ length: 3000 }, (_, i) => `${'  '.repeat(i)}- item`).join('\n')}\n`;
  const nested = await fast(() => readRecord('0001-a.md', deep, config));
  assert.ok(nested.tooDeep !== null);
  const quotes = `# T\n\n${'>'.repeat(100000)} text\n`;
  await fast(() => readRecord('0001-a.md', quotes, config));
  const heads = `# T\n\n${Array.from({ length: 40000 }, (_, i) => `## H${i}\n\ntext`).join('\n\n')}\n`;
  await fast(() => readRecord('0001-a.md', heads, config), 10000);
  const openers = '](('.repeat(300000);
  await fast(() => findLinks(openers));
  const parens = `[a](${'('.repeat(200000)}`;
  await fast(() => findLinks(parens));
  const ticks = '`'.repeat(100000) + '[a](b.md)';
  await fast(() => findLinks(ticks));
  const braces = `# T\n\n## Decision\n\n${'{'.repeat(500000)}\n`;
  await fast(() => readRecord('0001-a.md', braces, config));
  assert.equal(MARKDOWN_LIMITS.maxDepth, 16);
});

test('hostile: JSON nested very deep or very long is refused in one pass', LIMIT, async () => {
  for (const content of ['['.repeat(500000), `{"name": "${'x'.repeat(5000)}"}`, `{"placeholders": {"add": [${'"a",'.repeat(100001)}"a"]}}`]) {
    const r = await fast(() => run({ ...GOOD, 'c.json': content }, ['adr', '--config', 'c.json']));
    assert.equal(r.code, 2);
    assert.ok(r.err.length < 3000, 'the error stays short');
  }
  await fast(async () => assert.throws(() => parseJson(`[${'1,'.repeat(300000)}1]`), /more than 100000 values/));
});

test('hostile: thousands of unreadable records list twenty problems and a count', LIMIT, async () => {
  const files = {};
  for (let i = 0; i < 100; i += 1) files[`adr/${String(i).padStart(4, '0')}-bin.md`] = Buffer.from([0, 1, 2]);
  const r = await fast(() => run(files, ['adr']));
  assert.equal(r.code, 2);
  assert.match(r.err, /the input has problems:/);
  assert.ok(r.err.endsWith('\n  and 80 more\n'), r.err.slice(-200));
  assert.equal(MAX_PROBLEMS, 20);
});

test('hostile: CRLF, CR and a byte order mark give the same report as LF', async () => {
  const lf = await run(GOOD, ['adr', '--format', 'json']);
  for (const eol of ['\r\n', '\r']) {
    const files = Object.fromEntries(Object.entries(GOOD).map(([k, v]) => [k, `${String.fromCharCode(0xfeff)}${v.split('\n').join(eol)}`]));
    const r = await run(files, ['adr', '--format', 'json']);
    assert.equal(r.out, lf.out, JSON.stringify(eol));
  }
});

test('hostile: links that try to leave the folder are never followed, however they are written', async () => {
  const decision = ['[a](../secret.md)', '[b](..%2Fsecret.md)', '[c](..\\secret.md)', '[d](/etc/passwd)', '[e](C:/Windows/win.ini)', '[f](file:///etc/passwd)', '[g](sub/../../secret.md)'].join(' ');
  const r = await run({ 'secret.md': '# secret\n', ...GOOD, 'adr/0004-x.md': nygard({ title: '# 4. X', decision }) }, ['adr', '--format', 'json']);
  assert.equal(r.code, 0, r.err);
  const report = JSON.parse(r.out);
  assert.equal(report.totals.links.notFollowed, 6);
  assert.equal(report.totals.links.web, 1);
  assert.equal(report.totals.links.broken, 0);
});

test('hostile: control, escape and direction characters in names and text never reach the reports', async () => {
  const esc = String.fromCharCode(27);
  const rlo = String.fromCharCode(0x202e);
  const ls = String.fromCharCode(0x2028);
  const r = await run({ ...GOOD, [`adr/0004-x${rlo}.md`]: nygard({ title: `# 4. X${esc}[31m${ls}`, decision: `[a](0009${esc}.md)` }) }, ['adr', '--explain']);
  for (const c of [esc, rlo, ls]) assert.ok(!r.out.includes(c) && !r.err.includes(c), String(c.charCodeAt(0)));
});

test('hostile: __proto__, constructor and toString as file names, titles, statuses and layout ids are only data', async () => {
  const files = { 'adr/__proto__.md': nygard({ title: '# __proto__', status: 'constructor' }), 'adr/toString.md': nygard({ title: '# toString', status: 'Accepted' }), 'c.json': '{"layouts": {"constructor": {"title": "C", "sections": {"toString": {"title": "T", "aliases": ["hasOwnProperty"], "level": "required"}}}}}' };
  const r = await run(files, ['adr', '--config', 'c.json', '--format', 'json']);
  assert.equal(r.code, 1, r.err);
  const report = JSON.parse(r.out);
  assert.deepEqual(report.records.map((x) => x.status.word), ['constructor', 'accepted']);
  assert.ok(report.findings.some((f) => f.rule === 'unknown-status' && f.found.includes('"constructor"')));
  assert.equal({}.toString.name, 'toString');
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

test('hostile: a symbolic link in the folder is not followed, even to a record outside it, and a link to it is broken; no line or column', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows needs extra rights to make a symbolic link');
    return;
  }
  await withFiles({ 'outside.md': nygard({ title: '# Outside' }), ...GOOD, 'adr/0004-x.md': nygard({ title: '# 4. X', decision: '[o](0005-linked.md)' }) }, async (dir) => {
    await symlink(resolve(dir, 'outside.md'), resolve(dir, 'adr/0005-linked.md'));
    await symlink(resolve(dir), resolve(dir, 'adr/up'));
    const r = await fast(() => cli(['adr', '--format', 'json'], dir));
    assert.equal(r.code, 1, r.err);
    const report = JSON.parse(r.out);
    assert.equal(report.totals.records, 4);
    assert.equal(report.folder.symbolicLinks, 2);
    assert.ok(report.notes.some((n) => n.includes('are symbolic links and were not followed')));
    assert.ok(report.findings.some((f) => f.rule === 'broken-link' && f.found.includes('which is a symbolic link, which is never followed')));
    assert.ok(!r.out.includes('Outside'));
  });
});

test('hostile: the folder named on the command line may be a link to a folder, because the person who runs the tool named it', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows needs extra rights to make a symbolic link');
    return;
  }
  await withFiles(GOOD, async (dir) => {
    await symlink(resolve(dir, 'adr'), resolve(dir, 'decisions'));
    const r = await cli(['decisions'], dir);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /folder: decisions \(3 records/);
  });
});

test('hostile: a device named as the configuration is refused as not a regular file', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows has no /dev/zero to name as a configuration');
    return;
  }
  await withFiles(GOOD, async (dir) => {
    const r = await fast(() => cli(['adr', '--config', '/dev/zero'], dir));
    assert.equal(r.code, 2);
    assert.match(r.err, /not a regular file/);
  });
});

test('hostile: a record that is only a title, only front matter, or empty is read without a crash', async () => {
  const r = await run({ 'adr/0001-a.md': '', 'adr/0002-b.md': '---\nstatus: accepted\n---\n', 'adr/0003-c.md': '# Only a title\n', 'adr/0004-d.md': md('```', '# not a heading') }, ['adr', '--format', 'json']);
  assert.equal(r.code, 1, r.err);
  const report = JSON.parse(r.out);
  assert.deepEqual(report.records.map((x) => x.layout), [null, null, null, null]);
  assert.ok(report.notes.some((n) => n.includes('a code fence opened on line 1 is never closed')));
});
