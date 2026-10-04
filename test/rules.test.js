import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, RULES, atOrAbove, braceSpans, buildReport, decide, defaultConfig, readRecord, ruleById, statusWord } from '../src/index.js';
import { columnIn, findingsOf, lineOf, madr, md, nygard, reportOf } from './helpers.js';

const only = (report) => report.findings.map((f) => f.rule);

test('a healthy folder of Nygard records and of MADR records gives no finding', () => {
  const r = reportOf({ '0001-a.md': nygard({ title: '# 1. A' }), '0002-b.md': nygard({ title: '# 2. B' }), '0003-c.md': madr({ title: '# C' }) });
  assert.deepEqual(only(r), []);
  assert.equal(r.verdict.pass, true);
  assert.deepEqual(r.totals.byLayout, { nygard: 2, madr: 1, none: 0 });
});

test('missing-title: a first heading below level 1, or no heading at all; a level 1 heading or a front matter title is enough', () => {
  const r = reportOf({ '0001-a.md': nygard({ title: '## 1. A' }), '0002-b.md': 'Just text.\n', '0003-c.md': nygard({ title: null }).replace('## Status', '---\ntitle: C\n---\n\n## Status') });
  const f = findingsOf(r, 'missing-title');
  assert.deepEqual(f.map((x) => x.file), ['0001-a.md', '0002-b.md']);
  assert.match(f[0].found, /its first heading "1\. A" is a level 2 heading/);
  assert.equal(f[0].line, 1);
  assert.match(f[1].found, /it has no heading and no title in its front matter/);
});

test('unknown-layout: no heading matches any layout; the sections of such a record are not checked', () => {
  const r = reportOf({ '0001-a.md': md('# Notes', '', '## Attendees', '', 'All.', '', '## Plan', '', 'Later.') });
  assert.deepEqual(only(r), ['unknown-layout']);
  assert.match(r.findings[0].found, /no heading of the record matches a section of Nygard and MADR/);
  const near = reportOf({ '0001-a.md': md('# Notes', '', '## Decision', '', 'We will.') });
  assert.equal(findingsOf(near, 'unknown-layout').length, 0, 'one matching heading is a layout');
  assert.deepEqual(findingsOf(near, 'missing-section').map((f) => f.found), ['required section Context of the Nygard layout is missing', 'required section Consequences of the Nygard layout is missing']);
});

test('missing-section: required at error, recommended at notice, optional never; an empty section is empty, not missing', () => {
  const r = reportOf({ '0001-a.md': nygard({ consequences: null }), '0002-b.md': madr().replace(/### Consequences[\s\S]*$/, '') });
  const f = findingsOf(r, 'missing-section');
  assert.deepEqual(f.map((x) => [x.file, x.level, x.found]), [
    ['0001-a.md', 'error', 'required section Consequences of the Nygard layout is missing'],
    ['0002-b.md', 'notice', 'recommended section Consequences of the MADR layout is missing']
  ]);
  const empty = reportOf({ '0001-a.md': nygard({ consequences: '' }) });
  assert.deepEqual(only(empty), ['empty-section']);
  const levels = reportOf({ '0001-a.md': nygard({ consequences: null }) }, { rules: { missingSection: { required: 'warning' } } });
  assert.equal(findingsOf(levels, 'missing-section')[0].level, 'warning');
  const off = reportOf({ '0001-a.md': nygard({ consequences: null }) }, { layouts: { nygard: { sections: { consequences: { level: 'off' } } } } });
  assert.deepEqual(only(off), []);
});

test('empty-section: no text, or nothing but placeholders; a heading whose subheadings hold text is not empty', () => {
  const text = nygard({ context: 'TBD', consequences: '### Pros\n\nGood.\n\n### Cons\n' });
  const r = reportOf({ '0001-a.md': text });
  const f = findingsOf(r, 'empty-section');
  assert.deepEqual(f.map((x) => x.found), ['the heading "Context" holds nothing but TBD', 'the heading "Cons" has no text under it']);
  assert.equal(f[0].line, lineOf(text, '## Context'));
  assert.equal(f[0].column, columnIn(text, 'Context'));
  assert.equal(findingsOf(r, 'placeholder').length, 0, 'a placeholder in an empty section is reported once, through the section');
  const code = reportOf({ '0001-a.md': nygard({ consequences: '```\nnone\n```' }) });
  assert.deepEqual(only(code), [], 'a code block is text of the section');
  const quote = reportOf({ '0001-a.md': nygard({ consequences: '> As agreed.' }) });
  assert.deepEqual(only(quote), [], 'a block quote is text of the section');
});

test('placeholder: listed phrases and text in curly braces, outside code, quotes and links, with line and column', () => {
  const decision = 'We will use a queue; the vendor is TBD. The owner is {name of the owner}. `TODO` is code, "TBD" is quoted, [x](TODO.md) is a link.';
  const text = nygard({ decision });
  const r = reportOf({ '0001-a.md': text });
  const f = findingsOf(r, 'placeholder');
  assert.deepEqual(f.map((x) => x.found.split(' in ')[0]), ['placeholder TBD', 'placeholder {name of the owner}']);
  assert.equal(f[0].line, lineOf(text, 'We will use'));
  assert.equal(f[0].column, columnIn(text, 'TBD'));
  assert.equal(f[1].column, columnIn(text, '{name'));
  assert.equal(findingsOf(reportOf({ '0001-a.md': nygard({ decision: 'Use todo lists, TBDs and {} or {  }.' }) }), 'placeholder').length, 0, 'lower case todo, a longer word, and braces with no letter are no placeholder');
  const title = reportOf({ '0001-a.md': nygard({ title: '# {short title of the decision}' }) });
  assert.match(findingsOf(title, 'placeholder')[0].found, /placeholder \{short title of the decision\} in "\{short title of the decision\}"/);
  const noBraces = reportOf({ '0001-a.md': text }, { templateBraces: false });
  assert.equal(findingsOf(noBraces, 'placeholder').length, 1);
  const quoted = reportOf({ '0001-a.md': nygard({ decision: 'We will.\n\n> TBD by the vendor.' }) });
  assert.equal(findingsOf(quoted, 'placeholder').length, 0, 'a block quote is never read for words');
  assert.deepEqual(braceSpans('a {b} {c'), [{ phrase: 'text in curly braces', from: 2, to: 5 }]);
});

test('missing-status: a Nygard record with no status at all; MADR does not need one by default', () => {
  const r = reportOf({ '0001-a.md': nygard({ status: null }), '0002-b.md': madr({ title: '# Other' }).replace('status: accepted\n', 'deciders: Ana\n') });
  assert.deepEqual(only(r), ['missing-status']);
  assert.equal(r.findings[0].file, '0001-a.md');
  const empty = reportOf({ '0001-a.md': nygard({ status: '' }) });
  assert.deepEqual(only(empty).sort(), ['empty-section', 'missing-status'], 'a status heading with nothing under it gives no status');
  const line = reportOf({ '0001-a.md': nygard({ status: null }).replace('# 1. Use a queue\n', '# 1. Use a queue\n\n* **Status**: accepted\n') });
  assert.deepEqual(only(line), [], 'a "Status:" line before the first section, as MADR 2 writes it, is a status');
  const late = reportOf({ '0001-a.md': `${nygard({ status: null })}\nStatus: accepted\n` });
  assert.deepEqual(only(late), ['missing-status'], 'a "Status:" line after the first section is not read');
  const needed = reportOf({ '0002-b.md': madr().replace('status: accepted\n', '') }, { layouts: { madr: { requireStatus: true } } });
  assert.deepEqual(only(needed), ['missing-status']);
});

test('unknown-status: a word that is not a status word, no word, or a status given twice in the front matter', () => {
  const r = reportOf({
    '0001-a.md': nygard({ status: 'Approved by the board' }),
    '0002-b.md': madr({ status: '"{proposed | rejected | accepted}"' }),
    '0003-c.md': madr().replace('status: accepted', 'status: accepted\nstatus: rejected'),
    '0004-d.md': nygard({ status: '**Accepted** after review' }),
    '0005-e.md': nygard({ status: 'Superseded by [ADR 4](0004-d.md)' })
  });
  const f = findingsOf(r, 'unknown-status');
  assert.deepEqual(f.map((x) => x.file), ['0001-a.md', '0002-b.md', '0003-c.md']);
  assert.match(f[0].found, /the status "approved" is not one of proposed, accepted, rejected, deprecated and superseded/);
  assert.match(f[1].found, /the status in front matter holds no status word/);
  assert.match(f[2].found, /the status is given 2 times in the front matter, on lines 2 and 3/);
  assert.equal(statusWord('[Superseded](x.md) by'), 'superseded');
  assert.equal(statusWord('accepted-'), 'accepted');
  assert.equal(statusWord(''), '');
  const added = reportOf({ '0001-a.md': nygard({ status: 'Approved' }) }, { statuses: { add: ['approved'] } });
  assert.equal(findingsOf(added, 'unknown-status').length, 0);
});

test('stale-proposed: proposed with at least three later accepted records; two is a near miss; the limit and the words come from the configuration', () => {
  const recs = (accepted) => {
    const out = { '0001-a.md': nygard({ title: '# 1. A', status: 'Proposed' }) };
    for (let i = 0; i < accepted; i += 1) out[`000${i + 2}-r.md`] = nygard({ title: `# ${i + 2}. R${i}` });
    return out;
  };
  assert.equal(findingsOf(reportOf(recs(2)), 'stale-proposed').length, 0);
  const f = findingsOf(reportOf(recs(3)), 'stale-proposed');
  assert.equal(f.length, 1);
  assert.match(f[0].found, /the record is still proposed while 3 later records are accepted: 0002-r\.md, 0003-r\.md and 0004-r\.md/);
  assert.match(findingsOf(reportOf(recs(5)), 'stale-proposed')[0].found, /5 later records are accepted: 0002-r\.md, 0003-r\.md, 0004-r\.md and 2 more/);
  assert.equal(findingsOf(reportOf(recs(2), { rules: { staleProposed: { after: 2 } } }), 'stale-proposed').length, 1);
  const earlier = { '0005-a.md': nygard({ status: 'Proposed' }), '0001-b.md': nygard(), '0002-c.md': nygard(), '0003-d.md': nygard() };
  assert.equal(findingsOf(reportOf(earlier), 'stale-proposed').length, 0, 'accepted records with lower numbers do not count');
  const sameNumber = { '0001-a.md': nygard({ status: 'Proposed' }), '0001-b.md': nygard(), '0002-c.md': nygard(), '0003-d.md': nygard() };
  assert.equal(findingsOf(reportOf(sameNumber), 'stale-proposed').length, 0, 'a record with the same number is not later');
  const rejected = { '0001-a.md': nygard({ status: 'Proposed' }), '0002-b.md': nygard({ status: 'Rejected' }), '0003-c.md': nygard({ status: 'Rejected' }), '0004-d.md': nygard() };
  assert.equal(findingsOf(reportOf(rejected), 'stale-proposed').length, 0);
  assert.equal(findingsOf(reportOf(rejected, { rules: { staleProposed: { decided: ['accepted', 'rejected'] } } }), 'stale-proposed').length, 1);
});

test('superseded-link: a link to another record or an ADR number of another record is enough; nothing, a broken link or itself is not', () => {
  const base = { '0002-b.md': nygard({ title: '# 2. B' }) };
  const check = (status, name = '0001-a.md') => findingsOf(reportOf({ ...base, [name]: nygard({ status }) }), 'superseded-link');
  assert.equal(check('Superseded by [ADR 2](0002-b.md)').length, 0);
  assert.equal(check('Superseded by ADR-0002').length, 0);
  assert.equal(check('Superseded by ADR 2.').length, 0);
  assert.match(check('Superseded')[0].found, /the record is superseded, but its status names no record that replaces it/);
  assert.match(check('Superseded by [ADR 9](0009-x.md)')[0].found, /but the link 0009-x\.md and ADR 9 name no other record of the folder/);
  assert.match(check('Superseded by ADR 9')[0].found, /but ADR 9 names no other record of the folder/);
  assert.equal(check('Superseded by [itself](0001-a.md)').length, 1);
  assert.equal(check('Superseded by ADR 1').length, 1, 'its own number does not count');
  const fm = reportOf({ ...base, '0001-a.md': madr({ status: '"superseded by ADR-0002"' }) });
  assert.equal(findingsOf(fm, 'superseded-link').length, 0);
  const later = reportOf({ ...base, '0001-a.md': nygard({ status: 'Superseded.\n\nSee [ADR 2](0002-b.md).' }) });
  assert.equal(findingsOf(later, 'superseded-link').length, 0, 'every paragraph of the status section is read');
  const deprecated = reportOf({ ...base, '0001-a.md': nygard({ status: 'Deprecated' }) }, { rules: { supersededLink: { statuses: ['superseded', 'deprecated'] } } });
  assert.equal(findingsOf(deprecated, 'superseded-link').length, 1);
});

test('duplicate-number, numbering-gap and duplicate-title over the folder', () => {
  const r = reportOf({ '0001-a.md': nygard({ title: '# 1. Use a queue' }), '0002-b.md': nygard({ title: '# ADR 2: Use a Queue!' }), '0002-c.md': nygard({ title: '# 2. Cache' }), '0005-d.md': nygard({ title: '# 5. D' }), '0007-e.md': nygard({ title: '# 7. E' }) });
  assert.deepEqual(findingsOf(r, 'duplicate-number').map((f) => f.found), ['the number 2 is used by 2 records: 0002-b.md and 0002-c.md']);
  assert.deepEqual(findingsOf(r, 'numbering-gap').map((f) => f.found), ['no record has a number from 3 to 4, between 0002-b.md and 0005-d.md', 'no record has the number 6, between 0005-d.md and 0007-e.md']);
  assert.deepEqual(findingsOf(r, 'duplicate-title').map((f) => f.found), ['the title "ADR 2: Use a Queue!" is the title of 2 records: 0001-a.md and 0002-b.md']);
  assert.equal(findingsOf(r, 'numbering-gap')[0].level, 'notice');
  const huge = reportOf({ '0001-a.md': nygard({ title: '# A' }), '999999999-b.md': nygard({ title: '# B' }) });
  assert.match(findingsOf(huge, 'numbering-gap')[0].found, /from 2 to 999,999,998/);
  const unnumbered = reportOf({ 'notes.md': nygard({ title: '# A' }), 'more.md': nygard({ title: '# B' }) });
  assert.deepEqual(findingsOf(unnumbered, 'numbering-gap'), []);
  assert.equal(findingsOf(unnumbered, 'file-name').length, 2);
});

test('file-name: every record is held to the spec, which the configuration can change', () => {
  const r = reportOf({ '0001-a.md': nygard(), '08-Rename-Tables.md': nygard({ title: '# 8. Rename' }) });
  assert.deepEqual(findingsOf(r, 'file-name').map((f) => f.found), ['the file name 08-Rename-Tables.md does not follow NNNN-title-with-dashes.md: the number has 2 digits, not 4']);
  const loose = reportOf({ '08-Rename-Tables.md': nygard() }, { fileName: { digits: 2, lowercase: false } });
  assert.equal(findingsOf(loose, 'file-name').length, 0);
});

test('levels and the verdict: rules off, the order of findings, the fail level', () => {
  const r = reportOf({ '0001-a.md': nygard({ consequences: null }), '0003-b.md': nygard({ title: '# 3. B', context: 'TBD' }) });
  assert.deepEqual(r.findings.map((f) => `${f.level} ${f.rule}`), ['error missing-section', 'warning empty-section', 'notice numbering-gap']);
  assert.equal(r.verdict.text, 'FAIL - 2 findings at or above warning');
  const offAll = Object.fromEntries(RULES.map((x) => [x.key, x.key === 'missingSection' ? { required: 'off', recommended: 'off' } : { level: 'off' }]));
  assert.deepEqual(only(reportOf({ '0001-a.md': 'x\n', '0001-b.md': 'y\n', '0005-c.md': '# T\n\n## Status\n\nOdd\n' }, { rules: offAll })), []);
  assert.deepEqual(LEVELS, ['notice', 'warning', 'error']);
  assert.equal(atOrAbove('warning', 'notice'), true);
  assert.equal(atOrAbove('notice', 'warning'), false);
  assert.deepEqual(decide([], 'warning'), { pass: true, failOn: 'warning', failing: 0, byLevel: { error: 0, warning: 0, notice: 0 }, text: 'PASS - no finding at or above warning' });
  assert.equal(decide([{ level: 'notice' }], 'warning').text, 'PASS - no finding at or above warning (1 below it)');
  assert.equal(ruleById('broken-link').key, 'brokenLink');
  assert.equal(RULES.length, 14);
  for (const rule of RULES) {
    assert.match(rule.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(rule.facts.length >= 1, rule.id);
  }
});

test('the findings of one rule are capped, and the rest counted in a note', () => {
  const decision = Array.from({ length: 30 }, (_, i) => `- [x](09${String(i).padStart(2, '0')}-missing.md)`).join('\n');
  const records = { '0001-a.md': nygard({ decision }) };
  const r = reportOf(records);
  assert.equal(findingsOf(r, 'broken-link').length, 30);
  const capped = buildReport({ shown: 'adr', files: ['0001-a.md'], folders: [], links: [], other: [], ignored: [] }, [readRecord('0001-a.md', records['0001-a.md'], defaultConfig())], defaultConfig(), { maxFindingsPerRule: 10 });
  assert.equal(findingsOf(capped, 'broken-link').length, 10);
  assert.ok(capped.notes.includes('broken-link: 30 findings; the first 10 are listed'));
  assert.equal(capped.totals.links.broken, 30);
});

