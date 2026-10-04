import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRONT_MATTER_LIMITS, readMarkdown, splitFrontMatter } from '../src/index.js';
import { lineOf, md } from './helpers.js';

test('front matter: flat keys are read with their line and column, quotes and comments are taken off', () => {
  const text = md('---', 'status: "superseded by ADR-0004"', 'Title: Use a queue   # the title', "deciders: 'Ana, Tom'", 'nested:', '  - a', '---', '', '# Use a queue');
  const r = splitFrontMatter(text);
  assert.equal(r.lines, 7);
  assert.deepEqual(r.fields.get('status'), [{ value: 'superseded by ADR-0004', line: 2, column: 10 }]);
  assert.equal(r.fields.get('title')[0].value, 'Use a queue');
  assert.equal(r.fields.get('deciders')[0].value, 'Ana, Tom');
  assert.equal(r.fields.has('nested'), false, 'a key with no value on its line is left out');
  assert.equal(r.text.split('\n').length, text.split('\n').length, 'the lines are kept');
  const doc = readMarkdown(r.text);
  assert.deepEqual(doc.headings.map((h) => [h.text, h.line]), [['Use a queue', lineOf(text, '# Use a queue')]]);
});

test('front matter: a repeated key keeps every value, so the status rule can see it', () => {
  const r = splitFrontMatter(md('---', 'status: accepted', 'status: proposed', '...', 'text'));
  assert.deepEqual(r.fields.get('status').map((f) => [f.value, f.line]), [['accepted', 2], ['proposed', 3]]);
});

test('front matter: CRLF and CR line ends give the same fields and keep the line ends of the rest', () => {
  const lf = md('---', 'status: accepted', '---', '# T');
  for (const eol of ['\r\n', '\r']) {
    const text = lf.split('\n').join(eol);
    const r = splitFrontMatter(text);
    assert.deepEqual(r.fields.get('status'), splitFrontMatter(lf).fields.get('status'));
    assert.ok(r.text.endsWith(`# T${eol}`));
  }
});

test('front matter: no closing line, a first line that is not ---, or a closing line past the limit means no front matter', () => {
  for (const text of [md('---', 'status: accepted', '# T'), md('status: accepted', '---'), md(' ---', 'a: b', '---'), '']) {
    const r = splitFrontMatter(text);
    assert.equal(r.lines, 0);
    assert.equal(r.text, text);
    assert.equal(r.fields.size, 0);
  }
  const long = md('---', ...Array.from({ length: FRONT_MATTER_LIMITS.maxLines + 1 }, (_, i) => `k${i}: v`), '---');
  assert.equal(splitFrontMatter(long).lines, 0);
  const fits = md('---', ...Array.from({ length: FRONT_MATTER_LIMITS.maxLines }, (_, i) => `k${i}: v`), '---');
  assert.equal(splitFrontMatter(fits).lines, FRONT_MATTER_LIMITS.maxLines + 2);
});
