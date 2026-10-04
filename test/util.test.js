import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeText, displayPath, fileError, flat, grouped, isBinary, lineStarts, listText, plural, positionOf, readBounded, readTextFile, safeText, writeReport } from '../src/index.js';
import { withFiles } from './helpers.js';

// The small helpers: numbers and lists, text cleaning, lines and columns, and the files the tool reads and writes.

test('size: grouped numbers, lists and plurals', () => {
  assert.equal(grouped(1234567), '1,234,567');
  assert.equal(listText([]), '');
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd'], 2), 'a, b and 2 more');
  assert.equal(plural(1, 'day'), '1 day');
  assert.equal(plural(2, 'day'), '2 days');
  assert.equal(plural(2, 'domain alias', 'domain aliases'), '2 domain aliases');
});

test('text: control, line separator and direction characters become spaces; long text is cut; white space runs are one space', () => {
  assert.equal(safeText(`a${String.fromCharCode(27)}b${String.fromCharCode(0x202e)}c${String.fromCharCode(0x2028)}d${String.fromCharCode(0x9b)}e`), 'a b c d e');
  assert.equal(safeText('x'.repeat(20), 10), 'xxxxxxx...');
  assert.equal(flat(' a \n\t b '), 'a b');
});

test('lines: LF, CRLF and a lone CR each end a line; positions count from 1', () => {
  const starts = lineStarts('a\nb\r\nc\rd');
  assert.deepEqual(starts, [0, 2, 5, 7]);
  assert.deepEqual(positionOf(starts, 6), { line: 3, column: 2 });
});

test('files: a path relative to the base with forward slashes, and an error that names the file', async () => {
  const base = resolve('base');
  assert.equal(displayPath(resolve(base, 'a/b.md'), base), 'a/b.md');
  assert.equal(displayPath(base, base), '.');
  assert.ok(displayPath(resolve(base, '../x.md'), base).endsWith('/x.md'));
  assert.equal(fileError('a.md', 'why').message, 'a.md: why');
  assert.equal(fileError('a.md', 'why').reason, 'why');
  await withFiles({ 'a.txt': 'hello' }, async (dir) => {
    assert.equal((await readBounded(resolve(dir, 'a.txt'), 10)).toString(), 'hello');
    await assert.rejects(readBounded(resolve(dir, 'a.txt'), 2), /5 bytes is over the 2 byte limit/);
    await assert.rejects(readBounded(resolve(dir, 'a.txt'), 2), /a\.txt/);
    await assert.rejects(readBounded(resolve(dir, 'none.txt'), 2), /no such file/);
    await assert.rejects(readBounded(dir, 2), /not a regular file|cannot be read/);
  });
});

test('files: a text file is read as UTF-8 without its byte order mark; UTF-16 and binary files are refused', async () => {
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  assert.equal(decodeText(Buffer.concat([bom, Buffer.from('a,b')])), 'a,b');
  assert.equal(isBinary(Buffer.from([65, 0, 66])), true);
  assert.equal(isBinary(Buffer.from('plain')), false);
  assert.equal(decodeText(Buffer.from([0xc3, 0x28])), null, 'bytes that are not UTF-8');
  await withFiles({ 'u8.md': Buffer.concat([bom, Buffer.from('x\n')]), 'u16.md': Buffer.from([0xff, 0xfe, 0x61, 0]), 'bin.md': Buffer.from([0x61, 0, 0x62]), 'latin1.md': Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]) }, async (dir) => {
    const r = await readTextFile('u8.md', dir, 100);
    assert.deepEqual({ file: r.file, size: r.size, text: r.text }, { file: 'u8.md', size: 5, text: 'x\n' });
    await assert.rejects(readTextFile('u16.md', dir, 100), /u16.md: is UTF-16; only UTF-8 is read/);
    await assert.rejects(readTextFile('bin.md', dir, 100), /bin\.md: holds binary data \(a null byte\); only text is read/);
    await assert.rejects(readTextFile('u8.md', dir, 2), /u8.md: 5 bytes is over the 2 byte limit/);
    await assert.rejects(readTextFile('latin1.md', dir, 100), /latin1.md: is not valid UTF-8; only UTF-8 text is read/);
  });
});

test('files: writeReport writes the report where --out says, and refuses the configuration and any path inside the folder of records', async () => {
  await withFiles({ 'in.md': 'a\n', 'adr/0001-a.md': 'b\n' }, async (dir) => {
    const none = { folder: null, files: [] };
    assert.equal(await writeReport('out/../report.txt', 'hello\n', dir, { folder: 'adr', files: ['in.md'] }), 'report.txt');
    assert.equal(await readFile(resolve(dir, 'report.txt'), 'utf8'), 'hello\n');
    await writeReport('report.txt', 'again\n', dir, none);
    assert.equal(await readFile(resolve(dir, 'report.txt'), 'utf8'), 'again\n', 'a report file is replaced');
    await assert.rejects(writeReport('./in.md', 'x', dir, { folder: null, files: ['in.md'] }), /in.md: is one of the inputs/);
    assert.equal(await readFile(resolve(dir, 'in.md'), 'utf8'), 'a\n', 'the input is untouched');
    await assert.rejects(writeReport('adr/report.txt', 'x', dir, { folder: 'adr', files: [] }), /adr\/report.txt: is inside the folder of records/);
    await assert.rejects(writeReport('adr', 'x', dir, { folder: './adr/', files: [] }), /is inside the folder of records/);
    assert.equal(await writeReport('adr-report.txt', 'x', dir, { folder: 'adr', files: [] }), 'adr-report.txt', 'a name that only starts like the folder is outside it');
    await assert.rejects(writeReport('missing-folder/r.txt', 'x', dir, none), /cannot be written/);
    await assert.rejects(writeReport('.', 'x', dir, none), /cannot be written/);
  });
});
