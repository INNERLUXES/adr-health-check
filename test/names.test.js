import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FILE_NAME, NAME_LIMITS, asciiLower, fileNameProblem, hasExtension, isRecordFile, numberOf, specText, titleKey } from '../src/index.js';

const spec = { ...DEFAULT_FILE_NAME };

test('file name: NNNN-title-with-dashes.md passes, and every way to miss it is named', () => {
  assert.equal(fileNameProblem('0001-record-architecture-decisions.md', spec), null);
  assert.equal(fileNameProblem('0042-use-http2-for-the-api.md', spec), null);
  assert.equal(fileNameProblem('record-decisions.md', spec), 'the name does not start with a number');
  assert.equal(fileNameProblem('001-record.md', spec), 'the number has 3 digits, not 4');
  assert.equal(fileNameProblem('00001-record.md', spec), 'the number has 5 digits, not 4');
  assert.equal(fileNameProblem('1-record.md', spec), 'the number has 1 digit, not 4');
  assert.equal(fileNameProblem('0001.md', spec), 'there is no title after the number');
  assert.equal(fileNameProblem('0001_record.md', spec), 'the number is not followed by the separator "-"');
  assert.equal(fileNameProblem('0001--record.md', spec), 'there are two separators "-" in a row, or one at the end of the title');
  assert.equal(fileNameProblem('0001-record-.md', spec), 'there are two separators "-" in a row, or one at the end of the title');
  assert.match(fileNameProblem('0001-Record.md', spec), /the word "Record" holds an upper-case letter/);
  assert.match(fileNameProblem('0001-record_decisions.md', spec), /holds the character "_"/);
  assert.match(fileNameProblem('0001-caf\u00e9.md', spec), /holds the character/);
  assert.equal(fileNameProblem('0001-record.MD', spec), 'the extension is ".MD", not ".md"');
});

test('file name: a prefix, other digits, another separator and mixed case are part of the spec', () => {
  const nygard = { prefix: 'adr-', digits: 3, separator: '-', lowercase: false, extension: '.md' };
  assert.equal(fileNameProblem('adr-001-Deploy-On-Rails.md', nygard), null);
  assert.equal(fileNameProblem('001-deploy.md', nygard), 'the name does not start with the prefix "adr-"');
  assert.equal(fileNameProblem('adr-deploy.md', nygard), 'there is no number after the prefix "adr-"');
  const under = { prefix: '', digits: 2, separator: '_', lowercase: true, extension: '.markdown' };
  assert.equal(fileNameProblem('07_use_a_queue.markdown', under), null);
  assert.equal(fileNameProblem('07-use-a-queue.markdown', under), 'the number is not followed by the separator "_"');
  assert.equal(specText(spec), 'NNNN-title-with-dashes.md');
  assert.equal(specText(nygard), 'adr-NNN-Title-with-dashes.md');
  assert.equal(specText(under), 'NN_title_with_dashes.markdown');
});

test('numbers: the digits after the prefix or at the start, none, or too many', () => {
  assert.equal(numberOf('0007-use-a-queue.md', spec), 7);
  assert.equal(numberOf('08-Rename.md', spec), 8);
  assert.equal(numberOf('readme.md', spec), null);
  assert.equal(numberOf(`${'9'.repeat(NAME_LIMITS.maxNumberDigits + 1)}-x.md`, spec), null);
  assert.equal(numberOf('ADR-012-x.md', { ...spec, prefix: 'adr-' }), 12);
  assert.equal(numberOf('012-x.md', { ...spec, prefix: 'adr-' }), 12);
});

test('record files: the extension without case, and the ignored files without case', () => {
  const ignore = ['README.md', 'adr-template.md'];
  assert.equal(isRecordFile('0001-a.md', spec, ignore), true);
  assert.equal(isRecordFile('0001-a.MD', spec, ignore), true);
  assert.equal(isRecordFile('readme.md', spec, ignore), false);
  assert.equal(isRecordFile('ADR-TEMPLATE.MD', spec, ignore), false);
  assert.equal(isRecordFile('diagram.png', spec, ignore), false);
  assert.equal(hasExtension('.md', spec), false);
  assert.equal(asciiLower('ABC-\u00c4'), 'abc-\u00c4');
});

test('titles: a leading ADR number or plain number is left out, case and punctuation are ignored', () => {
  assert.equal(titleKey('ADR 9: LDAP for Multitenant Integration'), 'ldap for multitenant integration');
  assert.equal(titleKey('ADR-0009 - LDAP for multitenant integration'), 'ldap for multitenant integration');
  assert.equal(titleKey('9. LDAP, for multitenant integration!'), 'ldap for multitenant integration');
  assert.equal(titleKey('42'), '42');
  assert.equal(titleKey('Use HTTP 2'), 'use http 2');
});
