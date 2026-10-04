import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt, findPhrases, hasWordsOutside, isWordChar, lowerAscii, maskLine, preparePhrase } from '../src/index.js';

// Reading one line for words: what is masked, and where a phrase is found.

const found = (text, phrases) => findPhrases(text, phrases.map(preparePhrase)).map((h) => `${h.phrase}@${h.from}`);

test('mask: code spans, double-quoted text, link destinations, autolinks and HTML tags become spaces of the same length', () => {
  const line = 'Run `npm test` for the "Fast reorder" button, see [the guide](https://example.com/fast) or <https://example.com/x> and <b>bold</b>.';
  const m = maskLine(line);
  assert.equal(m.plain.length, line.length);
  for (const gone of ['npm test', 'Fast reorder', 'example.com', '<b>']) assert.ok(!m.plain.includes(gone), gone);
  for (const kept of ['Run', 'button', 'the guide', 'bold']) assert.ok(m.plain.includes(kept), kept);
  assert.equal(m.codeSpans, 1);
  assert.equal(m.quotes, 1);
  assert.ok(m.loose.includes('npm test') && m.loose.includes('Fast reorder'), 'loose keeps code spans and quotes');
  assert.ok(!m.loose.includes('example.com'), 'loose masks link destinations');
});

test('mask: a code span closes only with a run of the same length, unclosed openers stay text, and escapes are skipped', () => {
  assert.equal(maskLine('a ``x ` y`` b').plain, 'a           b');
  assert.equal(maskLine('a `x').plain, 'a `x');
  assert.equal(maskLine('say "fast').plain, 'say "fast');
  assert.equal(maskLine('a \\"fast" b').codeSpans, 0);
  assert.equal(maskLine('use \\`fast\\` here').plain, 'use \\`fast\\` here');
  const curly = maskLine(`the ${String.fromCharCode(0x201c)}Fast${String.fromCharCode(0x201d)} label`);
  assert.equal(curly.quotes, 1);
  assert.ok(!curly.plain.includes('Fast'));
  assert.equal(maskLine('a < b and c > d').plain, 'a < b and c > d', 'a < followed by a space is not a tag');
  assert.equal(maskLine('[x](no close').plain, '[x](no close');
});

test('phrases: found at word edges only, with a hyphen part of a word, and without case for A to Z unless written in capitals', () => {
  assert.deepEqual(found('Fast pages, fast-track and breakfast.', ['fast']), ['fast@0']);
  assert.deepEqual(found('a USER-FRIENDLY screen', ['user-friendly']), ['user-friendly@2']);
  assert.deepEqual(found('Dates TBD, tbd later, TBDs', ['TBD']), ['TBD@6']);
  assert.deepEqual(found('Books etc. and more', ['etc.']), ['etc.@6']);
  assert.deepEqual(found('see [...] here', ['[...]']), ['[...]@4']);
  assert.deepEqual(found('', ['fast']), []);
  assert.equal(preparePhrase('  best   effort ').phrase, 'best effort');
  assert.equal(preparePhrase('TBD').caseSensitive, true);
  assert.equal(preparePhrase('OpenAPI').caseSensitive, false);
  assert.equal(preparePhrase('[...]').caseSensitive, false);
});

test('phrases: where two phrases overlap, the first and then the longer one is kept, and a longer word is not a shorter phrase', () => {
  assert.deepEqual(found('in a best efforts way', ['best effort', 'best efforts']), ['best efforts@5']);
  assert.deepEqual(found('as soon as possible', ['as soon as possible', 'possible']), ['as soon as possible@0']);
  assert.deepEqual(found('quickly and quick', ['quick', 'quickly']), ['quickly@0', 'quick@12']);
});

test('helpers: lower case for A to Z only keeps the length, word characters, words outside spans, and excerpts', () => {
  const dotted = `${String.fromCharCode(0x130)}STANBUL`;
  assert.equal(lowerAscii(dotted).length, dotted.length);
  assert.equal(lowerAscii('ABC def'), 'abc def');
  assert.equal(lowerAscii('plain'), 'plain');
  assert.equal(isWordChar('a'), true);
  assert.equal(isWordChar('-'), true);
  assert.equal(isWordChar(String.fromCharCode(0xe9)), true);
  assert.equal(isWordChar('.'), false);
  assert.equal(isWordChar(undefined), false);
  assert.equal(hasWordsOutside('TBD.', [{ from: 0, to: 3 }]), false);
  assert.equal(hasWordsOutside('TBD soon', [{ from: 0, to: 3 }]), true);
  assert.equal(hasWordsOutside(`TBD ${String.fromCharCode(0xe9)}`, [{ from: 0, to: 3 }]), true);
  assert.equal(excerpt('short', 0, 1), 'short');
  const long = `${'a'.repeat(100)} fast ${'b'.repeat(100)}`;
  const e = excerpt(long, 101, 105, 40);
  assert.ok(e.startsWith('...') && e.endsWith('...') && e.includes('fast'));
  assert.ok(e.length <= 46);
});
