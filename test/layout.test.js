import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_LIMITS, defaultConfig, detectLayout, headingExtents, isStatusHeading, matchHeading, normalizeHeading, readRecord } from '../src/index.js';
import { configOf, findingsOf, madr, md, nygard, reportOf } from './helpers.js';

const config = defaultConfig();
const layout = (id) => config.layouts.find((l) => l.id === id);

test('headings: numbering, case, markup and punctuation are left out, and the whole heading must match an alias', () => {
  assert.equal(normalizeHeading('2.1 Decision Outcome'), 'decision outcome');
  assert.equal(normalizeHeading('**Context & Problem Statement**'), 'context and problem statement');
  assert.equal(normalizeHeading('Section 3: Status'), 'status');
  assert.equal(normalizeHeading('[Status](x.md)'), 'status');
  assert.equal(normalizeHeading('1.'), '1');
  assert.equal(normalizeHeading('x'.repeat(SECTION_LIMITS.maxHeadingChars + 50)).length, SECTION_LIMITS.maxHeadingChars);
  assert.equal(matchHeading('Decision', layout('nygard')).id, 'decision');
  assert.equal(matchHeading('Decision Outcome', layout('nygard')), null, 'a heading that holds an alias is not that section');
  assert.equal(matchHeading('Context and Problem Statement', layout('nygard')), null);
  assert.equal(matchHeading('4. decision outcome', layout('madr')).id, 'decisionOutcome');
  assert.equal(matchHeading('   ', layout('madr')), null);
  assert.equal(isStatusHeading('## Status'.slice(3), config.statusKeys), true);
  assert.equal(isStatusHeading('Status quo', config.statusKeys), false);
});

test('layout detection: the layout with the most matched sections wins, the first one on a tie, none with no match', () => {
  const layouts = config.layouts;
  assert.equal(detectLayout(['Context', 'Decision', 'Consequences'], layouts).layout.id, 'nygard');
  assert.equal(detectLayout(['Context and Problem Statement', 'Considered Options', 'Decision Outcome', 'Consequences'], layouts).layout.id, 'madr');
  const tie = detectLayout(['Consequences'], layouts);
  assert.equal(tie.layout.id, 'nygard');
  assert.equal(tie.tie, true);
  assert.deepEqual(tie.scores, [{ id: 'nygard', count: 1 }, { id: 'madr', count: 1 }]);
  assert.equal(detectLayout(['Context', 'Context', 'Consequences', 'Decision Outcome', 'Considered Options'], layouts).layout.id, 'madr', 'a section is counted once');
  assert.equal(detectLayout(['Notes', 'Plan'], layouts).layout, null);
  assert.equal(detectLayout([], layouts).layout, null);
});

test('records: the title is the first heading at level 1, else the title of the front matter; the status heading does not decide the layout', () => {
  const n = readRecord('0001-a.md', nygard(), config);
  assert.equal(n.title.text, '1. Use a queue');
  assert.equal(n.layout, 'nygard');
  assert.deepEqual(n.sections.map((s) => s.status), ['found', 'found', 'found']);
  const m = readRecord('0002-b.md', madr(), config);
  assert.equal(m.layout, 'madr');
  assert.equal(m.status.word, 'accepted');
  assert.equal(m.status.from, 'front matter');
  assert.deepEqual(m.sections.filter((s) => s.status !== 'missing').map((s) => s.id), ['contextAndProblem', 'consideredOptions', 'decisionOutcome', 'consequences']);
  const fm = readRecord('0003-c.md', md('---', 'title: From the front matter', '---', '## Context', '', 'x'), config);
  assert.equal(fm.title.text, 'From the front matter');
  assert.equal(fm.title.from, 'front matter');
  const none = readRecord('0004-d.md', md('## Context', '', 'x'), config);
  assert.equal(none.title, null);
  const onlyStatus = readRecord('0005-e.md', md('# T', '', '## Status', '', 'Accepted'), config);
  assert.equal(onlyStatus.layout, null, 'a status heading alone gives no layout');
});

test('records: a layout set in the configuration is used for every record, and unknown-layout is not run', () => {
  const r = reportOf({ '0001-a.md': nygard() }, { layout: 'madr' });
  assert.equal(r.records[0].layout, 'madr');
  assert.deepEqual(findingsOf(r, 'missing-section').map((f) => f.found), ['required section Context and Problem Statement of the MADR layout is missing', 'required section Considered Options of the MADR layout is missing', 'required section Decision Outcome of the MADR layout is missing'], 'the Consequences heading of the record matches the MADR section of that name');
  assert.equal(findingsOf(reportOf({ '0001-a.md': md('# T', '', '## Notes', '', 'x') }, { layout: 'nygard' }), 'unknown-layout').length, 0);
  assert.match(configOf({ layout: 'madr' }).layout, /madr/);
});

test('records: a tie between layouts is read as the first layout and said in a note', () => {
  const r = reportOf({ '0001-a.md': md('# T', '', '## Status', '', 'Accepted', '', '## Consequences', '', 'x') });
  assert.equal(r.records[0].layout, 'nygard');
  assert.ok(r.notes.some((n) => n.includes('matches as many sections of nygard and madr; it is read as nygard')));
});

test('extents: a heading covers the headings below it up to the next heading at its level or above', () => {
  const hs = [1, 2, 3, 2, 1, 2].map((level) => ({ level }));
  assert.deepEqual(headingExtents(hs), [4, 3, 3, 4, 6, 6]);
  assert.deepEqual(headingExtents([]), []);
});
