import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINK_LIMITS, adrNumbers, classifyLink, findLinks, maskCode } from '../src/index.js';
import { findingsOf, reportOf, nygard } from './helpers.js';

const dests = (s) => findLinks(s).map((l) => l.destination);

test('links: inline links, images, titles, pointy destinations and reference definitions, outside code spans', () => {
  assert.deepEqual(dests('See [ADR 2](0002-a.md) and ![diagram](img/flow.png).'), ['0002-a.md', 'img/flow.png']);
  assert.deepEqual(dests('[a](0002-a.md "the title") [b](<0003 b.md>)'), ['0002-a.md', '0003 b.md']);
  assert.deepEqual(dests('[x]: 0004-c.md "title"'), ['0004-c.md']);
  assert.deepEqual(dests('[x]: <0004 c.md>'), ['0004 c.md']);
  assert.deepEqual(dests('`[a](0002-a.md)` and ``[b](x.md)``'), []);
  assert.deepEqual(dests('\\[a\\](0002-a.md) [b] (c.md) [d](e.md'), []);
  const [l] = findLinks('Read [it](0002-a.md).');
  assert.equal('Read [it](0002-a.md).'.slice(l.from, l.to), '0002-a.md');
  assert.equal(maskCode('a `b` c'), 'a     c');
  assert.equal(maskCode('a `b c'), 'a `b c');
});

test('links: a destination stops at the first ) or space, and an overlong one is not read', () => {
  assert.deepEqual(dests('[a](file(1).md)'), ['file(1']);
  assert.deepEqual(dests(`[a](${'x'.repeat(LINK_LIMITS.maxDestination + 1)})`), []);
  assert.deepEqual(dests(`[a](${'x'.repeat(LINK_LIMITS.maxDestination)})`).map((d) => d.length), [LINK_LIMITS.maxDestination]);
});

test('links: relative files, anchors, web addresses, absolute paths, the folder, subfolders and paths outside the folder', () => {
  assert.deepEqual(classifyLink('0002-a.md'), { kind: 'file', target: '0002-a.md', anchor: null });
  assert.deepEqual(classifyLink('./0002-a.md#decision'), { kind: 'file', target: '0002-a.md', anchor: 'decision' });
  assert.deepEqual(classifyLink('sub/../0002-a.md?plain=1'), { kind: 'file', target: '0002-a.md', anchor: null });
  assert.equal(classifyLink('0002%20a.md').target, '0002 a.md');
  assert.equal(classifyLink('0002\\_a.md').target, '0002_a.md');
  assert.equal(classifyLink('100%.md').target, '100%.md');
  assert.equal(classifyLink('#decision').kind, 'anchor');
  assert.equal(classifyLink('?x#y').kind, 'anchor');
  for (const d of ['https://example.com/a.md', 'mailto:a@example.com', 'file:///etc/passwd', '//example.com/x']) assert.equal(classifyLink(d).kind, 'web', d);
  for (const d of ['/etc/passwd', '\\\\server\\share', 'C:/Windows/win.ini', 'C:\\x.md']) assert.equal(classifyLink(d).kind, 'absolute', d);
  for (const d of ['../README.md', '..\\README.md', '..%2FREADME.md', './a/../../x.md', '%2e%2e/x.md']) assert.equal(classifyLink(d).kind, 'outside', d);
  assert.equal(classifyLink('img/flow.png').kind, 'subfolder');
  assert.equal(classifyLink('./').kind, 'folder');
  assert.equal(classifyLink('  ').kind, 'empty');
});

test('links: ADR numbers in a status text', () => {
  assert.deepEqual(adrNumbers('superseded by ADR-0004, see also adr 7 and ADR12'), [4, 7, 12]);
  assert.deepEqual(adrNumbers('BADR-3 and ADR-x'), []);
});

test('broken-link: a link to a missing file is reported with its line and column, an existing one is not, and nothing outside is followed', () => {
  const text = nygard({ decision: 'We follow [ADR 2](0002-b.md), [the plan](0009-plan.md#top), [up](../README.md) and [web](https://example.com/x.md).' });
  const r = reportOf({ '0001-a.md': text, '0002-b.md': nygard() }, null, { otherFiles: ['diagram.png'] });
  const broken = findingsOf(r, 'broken-link');
  assert.equal(broken.length, 1);
  assert.match(broken[0].found, /the link 0009-plan\.md#top points to 0009-plan\.md, which is not in the folder/);
  const lines = text.split('\n');
  const row = lines.findIndex((l) => l.includes('0009-plan.md'));
  assert.equal(broken[0].line, row + 1);
  assert.equal(broken[0].column, lines[row].indexOf('0009-plan.md') + 1);
  assert.deepEqual(r.totals.links, { checked: 2, broken: 1, notFollowed: 1, web: 1, anchors: 0 });
  assert.ok(r.notes.some((n) => n.includes('leaves the folder and was not followed') && n.includes('../README.md')));
  assert.ok(r.notes.some((n) => n === '1 web address was not fetched'));
  const image = reportOf({ '0001-a.md': nygard({ decision: '![flow](diagram.png)' }) }, null, { otherFiles: ['diagram.png'] });
  assert.equal(findingsOf(image, 'broken-link').length, 0, 'an image in the folder resolves');
});

test('broken-link: a name that differs in case, a symbolic link and a subfolder', () => {
  const r = reportOf({ '0001-a.md': nygard({ decision: '[a](0002-B.md) [b](linked.md) [c](drafts) [d](drafts/x.md)' }), '0002-b.md': nygard() }, null, { folder: { links: ['linked.md'], folders: ['drafts'] } });
  const found = findingsOf(r, 'broken-link').map((f) => f.found);
  assert.equal(found.length, 2);
  assert.match(found[0], /differs in case/);
  assert.match(found[1], /linked\.md, which is a symbolic link, which is never followed/);
  assert.equal(r.totals.links.notFollowed, 2, 'the subfolder and the path into it are not followed');
});

test('broken-link: links inside block quotes, list items and tables are checked; links inside code are not', () => {
  const decision = ['> See [old](0007-old.md).', '', '- [item](0008-item.md)', '', '| a | b |', '| --- | --- |', '| [cell](0009-cell.md) | x |', '', '```', '[code](0010-code.md)', '```', '', '    [indented](0011-x.md)'].join('\n');
  const r = reportOf({ '0001-a.md': nygard({ decision }) });
  assert.deepEqual(findingsOf(r, 'broken-link').map((f) => f.found.split(' ')[2]), ['0007-old.md', '0008-item.md', '0009-cell.md']);
  const off = reportOf({ '0001-a.md': nygard({ decision }) }, { rules: { brokenLink: { level: 'off' } } });
  assert.equal(findingsOf(off, 'broken-link').length, 0);
});
