import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atxHeading, columnOf, fenceCloses, fenceOpening, interruptsParagraph, isThematicBreak, listMarker, quoteMarkerEnd, readMarkdown, setextLevel, splitLines, tableCells, textOf } from '../src/index.js';
import { columnIn, lineOf, md } from './helpers.js';

// The Markdown reader: where headings, code blocks, lists, tables and block quotes start and end, and the line and column
// of every piece of text. Lines and columns are worked out from the text with lineOf() and columnIn().

const headingsOf = (text) => readMarkdown(text).headings.map((h) => `${h.level} ${h.text}`);
const unitsOf = (text, kind) => readMarkdown(text).units.filter((u) => !kind || u.kind === kind);

test('lines: LF, CRLF and CR end a line, a tab is expanded to the next multiple of four, and columns map back to the file', () => {
  const lines = splitLines('a\r\nb\rc\nd');
  assert.deepEqual(lines.map((l) => l.text), ['a', 'b', 'c', 'd']);
  assert.deepEqual(lines.map((l) => l.no), [1, 2, 3, 4]);
  const [tab] = splitLines('a\tb');
  assert.equal(tab.text, 'a   b');
  assert.equal(columnOf(tab, 4), 3, 'the b after the tab is the third character of the line');
  assert.equal(columnOf(tab, 2), 2, 'a column inside the tab is the column of the tab');
  assert.equal(columnOf(splitLines('plain')[0], 2), 3);
  assert.equal(splitLines('   ')[0].last, -1);
  assert.equal(splitLines('').length, 0);
  assert.equal(splitLines('a\n').length, 1, 'a final line end does not start a line');
});

test('ATX headings: one to six #, a space or the end of the line after them, up to three spaces before, and the closing sequence left out', () => {
  assert.deepEqual(atxHeading('# Scope'), { level: 1, from: 2, to: 7 });
  assert.equal(atxHeading('###### Six').level, 6);
  assert.equal(atxHeading('####### Seven'), null, 'seven # is not a heading');
  assert.equal(atxHeading('#Scope'), null, 'a space is needed after the #');
  assert.equal(atxHeading('   # Three spaces').level, 1);
  assert.equal(atxHeading('    # Four spaces'), null);
  const closed = atxHeading('## Scope ##   ');
  assert.equal('## Scope ##   '.slice(closed.from, closed.to), 'Scope');
  const kept = atxHeading('# C# and F#');
  assert.equal('# C# and F#'.slice(kept.from, kept.to), 'C# and F#', 'a # with no space before it is part of the text');
  const empty = atxHeading('#');
  assert.equal(empty.to - empty.from, 0, 'an ATX heading can be empty');
  assert.equal(atxHeading('\\# not a heading'), null);
  assert.deepEqual(headingsOf(md('# One', '## Two ##', 'text', '### Three')), ['1 One', '2 Two', '3 Three']);
});

test('setext headings: = makes level 1 and - level 2, the text may span lines, and a blank line before the underline makes no heading', () => {
  assert.equal(setextLevel('==='), 1);
  assert.equal(setextLevel('---   '), 2);
  assert.equal(setextLevel('   -'), 2);
  assert.equal(setextLevel('    ---'), 0, 'four spaces is too many');
  assert.equal(setextLevel('- - -'), 0, 'an underline has no inner spaces');
  assert.deepEqual(headingsOf(md('Statement', 'of work', '===', '', 'Scope', '-----')), ['1 Statement of work', '2 Scope']);
  assert.deepEqual(headingsOf(md('Text', '', '---')), [], 'after a blank line, --- is a thematic break');
  assert.deepEqual(headingsOf(md('===')), [], 'an underline with no text before it is a paragraph');
  const doc = md('intro', '', 'Pricing', '-------', 'A fixed price.');
  const [h] = readMarkdown(doc).headings;
  assert.equal(h.line, lineOf(doc, 'Pricing'));
  assert.equal(h.column, 1);
});

test('code blocks: a fenced or indented block is never read as headings, a fence closes only with the same character and length, and an unclosed fence runs to the end', () => {
  const doc = md('# Real', '', '```md', '# Not a heading', 'TBD', '```', '', '    # Indented, not a heading', '', '~~~~', '## Also not', '~~~', '~~~~', '## After');
  assert.deepEqual(headingsOf(doc), ['1 Real', '2 After']);
  const r = readMarkdown(doc);
  assert.equal(r.counts.codeBlocks, 3);
  assert.deepEqual(r.unclosed, []);
  assert.deepEqual(fenceOpening('```js'), { char: '`', length: 3 });
  assert.equal(fenceOpening('``` a`b'), null, 'a backtick fence has no backtick in its info string');
  assert.equal(fenceOpening('``'), null);
  assert.equal(fenceOpening('    ```'), null);
  assert.equal(fenceCloses('````', { char: '`', length: 3 }), true);
  assert.equal(fenceCloses('``', { char: '`', length: 3 }), false);
  assert.equal(fenceCloses('~~~', { char: '`', length: 3 }), false);
  assert.equal(fenceCloses('``` x', { char: '`', length: 3 }), false);
  const open = md('# Top', '', '```', '## Hidden', 'text');
  const o = readMarkdown(open);
  assert.deepEqual(o.headings.map((h) => h.text), ['Top']);
  assert.deepEqual(o.unclosed, [lineOf(open, '```')]);
  assert.deepEqual(headingsOf(md('para', '    # still the paragraph')), [], 'an indented line cannot interrupt a paragraph');
});

test('thematic breaks: three or more of *, - or _, with spaces between, and not a list item', () => {
  assert.equal(isThematicBreak('***'), true);
  assert.equal(isThematicBreak(' - - -'), true);
  assert.equal(isThematicBreak('___ _'), true);
  assert.equal(isThematicBreak('--'), false);
  assert.equal(isThematicBreak('-*-'), false);
  assert.equal(isThematicBreak('    ***'), false);
  const r = readMarkdown(md('- a', '* * *', '- b'));
  assert.deepEqual(r.blocks.map((b) => b.type), ['list', 'break', 'list']);
});

test('block quotes: their text, headings inside them included, is not a section heading, and is kept as units marked quoted', () => {
  assert.equal(quoteMarkerEnd('> a'), 2);
  assert.equal(quoteMarkerEnd('>a'), 1);
  assert.equal(quoteMarkerEnd('    > a'), -1);
  const doc = md('# Scope', '', '> ## Quoted heading', '> fast and TBD', 'lazy line', '', 'after');
  const r = readMarkdown(doc);
  assert.deepEqual(r.headings.map((h) => h.text), ['Scope']);
  assert.equal(r.counts.quotes, 1);
  assert.deepEqual(r.units.map((u) => u.kind), ['heading', 'quote', 'paragraph', 'paragraph', 'paragraph']);
  assert.deepEqual(r.units.map((u) => u.quoted), [false, false, true, true, false]);
  assert.equal(textOf(r.units[2].segments), 'Quoted heading');
  assert.equal(textOf(r.units[3].segments), 'fast and TBD lazy line');
  assert.equal(textOf(r.units[4].segments), 'after');
});

test('lists: bullets and ordered items, nested items, lazy lines, items that end at a blank line followed by text, and leaf items', () => {
  assert.deepEqual(listMarker('- item'), { ordered: false, mark: '-', number: null, width: 2, empty: false });
  assert.deepEqual(listMarker('12) item'), { ordered: true, mark: ')', number: 12, width: 4, empty: false });
  assert.equal(listMarker('1234567890. ten digits'), null);
  assert.equal(listMarker('-item'), null);
  assert.equal(listMarker('-').empty, true);
  assert.equal(listMarker('-      far').width, 2, 'more than four spaces: the content starts after one');
  const doc = md('- one', '  continued', '- two', '  - two a', '  - two b', 'lazy for two b', '', '1. first', '2. second', '', 'paragraph');
  const items = unitsOf(doc, 'item');
  assert.deepEqual(items.map((u) => [textOf(u.segments), u.leaf, u.ordered]), [
    ['one continued', true, false],
    ['two', false, false],
    ['two a', true, false],
    ['two b lazy for two b', true, false],
    ['first', true, true],
    ['second', true, true]
  ]);
  const [last] = unitsOf(doc, 'paragraph');
  assert.equal(textOf(last.segments), 'paragraph');
  assert.equal(items[2].segments[0].line.no, lineOf(doc, '  - two a'));
  assert.equal(columnOf(items[2].segments[0].line, items[2].segments[0].start), columnIn(doc, 'two a'));
  const r = readMarkdown(md('- a', '+ b', '1. c', '1) d'));
  assert.equal(r.counts.lists, 4, 'a new marker kind starts a new list');
});

test('lists: a list item only interrupts a paragraph when it has text, and an ordered one only when it starts at 1', () => {
  assert.equal(interruptsParagraph('- x'), true);
  assert.equal(interruptsParagraph('-'), false);
  assert.equal(interruptsParagraph('2. x'), false);
  assert.equal(interruptsParagraph('1. x'), true);
  assert.equal(interruptsParagraph('# x'), true);
  assert.equal(interruptsParagraph('<!-- note -->'), true);
  assert.equal(interruptsParagraph('plain'), false);
  assert.deepEqual(unitsOf(md('The fee is', '2. not a list'), 'item'), []);
});

test('tables: a header row, a delimiter row with as many cells, and the rows up to a blank line; each cell keeps its column', () => {
  assert.deepEqual(tableCells('| a | b \\| c |').map((c) => '| a | b \\| c |'.slice(c.from, c.to).trim()), ['a', 'b \\| c']);
  const doc = md('| ID | Deliverable |', '| :-- | --: |', '| D1 | Portal |', 'D2 | Guide', '', 'after');
  const r = readMarkdown(doc);
  assert.equal(r.counts.tables, 1);
  const rows = r.units.filter((u) => u.kind === 'row');
  assert.deepEqual(rows.map((u) => u.segments.map((g) => g.s)), [['ID', 'Deliverable'], ['D1', 'Portal'], ['D2', 'Guide']]);
  assert.equal(rows[0].header, true);
  const cell = rows[1].segments[1];
  assert.equal(columnOf(cell.line, cell.start), columnIn(doc, 'Portal'));
  assert.equal(readMarkdown(md('| a | b |', '| --- |')).counts.tables, 0, 'the header must match the delimiter row in the number of cells');
  assert.equal(readMarkdown(md('| a |', '---')).counts.tables, 0, 'a delimiter row without a pipe is a setext underline');
  assert.equal(readMarkdown(md('| a | b |', '| -x- | --- |')).counts.tables, 0);
});

test('HTML comments are skipped as one block, and paragraphs keep every line', () => {
  const doc = md('<!-- a note', '# not a heading', '-->', 'one', 'two');
  const r = readMarkdown(doc);
  assert.deepEqual(r.headings, []);
  assert.deepEqual(r.units.map((u) => u.kind), ['html', 'paragraph']);
  assert.deepEqual(r.units[1].segments.map((g) => g.line.no), [lineOf(doc, 'one'), lineOf(doc, 'two')]);
});

test('headings inside a list item are text of the item, not section headings', () => {
  const r = readMarkdown(md('# Top', '', '- ## Inside', '  text'));
  assert.deepEqual(r.headings.map((h) => h.text), ['Top']);
  assert.equal(textOf(r.units.find((u) => u.kind === 'item').segments), 'Inside text');
});

test('nesting past the limit is read as plain text and noted, and units carry the heading they are under', () => {
  const deep = md('# Top', '', ...Array.from({ length: 30 }, (_, i) => `${'  '.repeat(i)}- level ${i}`));
  const r = readMarkdown(deep, { maxDepth: 4 });
  assert.equal(r.tooDeep, lineOf(deep, '      - level 3'));
  assert.ok(r.units.some((u) => textOf(u.segments).includes('level 29')), 'the deeper lines are still read as text');
  assert.ok(r.units.every((u) => u.heading === 0));
  assert.equal(readMarkdown(md('para')).units[0].heading, -1);
  assert.throws(() => readMarkdown('a\n'.repeat(11), { maxLines: 10 }), /more than 10 lines/);
});
