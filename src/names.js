// File names and titles of records. A file name is checked against a simple spec, never against a pattern the user
// writes: an optional fixed prefix, a number of exactly `digits` digits, the separator, and words of letters and digits
// joined by the separator, then the extension. The default is NNNN-title-with-dashes.md, as the MADR page writes it.
// The spec is read character by character, so no regular expression is built from the configuration.

export const NAME_LIMITS = { maxNumberDigits: 9 };

const isDigit = (c) => c >= 48 && c <= 57;
const isLower = (c) => c >= 97 && c <= 122;
const isUpper = (c) => c >= 65 && c <= 90;

// Lower case for the letters A to Z only, so the result does not depend on the locale of the machine.
export function asciiLower(s) {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    out += isUpper(c) ? String.fromCharCode(c + 32) : s[i];
  }
  return out;
}

// True when a name ends with the extension of the spec, compared without case: the files that are read as records.
export const hasExtension = (name, spec) => name.length > spec.extension.length && asciiLower(name).endsWith(asciiLower(spec.extension));

// True when a file of the folder is read as a record: it has the extension, and it is not one of the ignored files.
export function isRecordFile(name, spec, ignoreFiles) {
  if (!hasExtension(name, spec)) return false;
  const lower = asciiLower(name);
  return !ignoreFiles.some((f) => asciiLower(f) === lower);
}

// The number of a record from its file name: the digits right after the prefix (compared without case), or right at the
// start when the name does not start with the prefix. null when there is no digit there, or more digits than
// NAME_LIMITS.maxNumberDigits.
export function numberOf(name, spec) {
  let i = 0;
  if (spec.prefix && asciiLower(name.slice(0, spec.prefix.length)) === asciiLower(spec.prefix)) i = spec.prefix.length;
  let j = i;
  while (j < name.length && isDigit(name.charCodeAt(j))) j += 1;
  if (j === i || j - i > NAME_LIMITS.maxNumberDigits) return null;
  return Number(name.slice(i, j));
}

// The file name as the spec writes it, for a report: NNNN-title-with-dashes.md for the default spec.
export function specText(spec) {
  const word = spec.lowercase ? 'title' : 'Title';
  return `${spec.prefix}${'N'.repeat(spec.digits)}${spec.separator}${[word, 'with', 'dashes'].join(spec.separator)}${spec.extension}`;
}

// Why a file name does not follow the spec, or null when it does. The first reason found is given.
export function fileNameProblem(name, spec) {
  let i = 0;
  if (spec.prefix) {
    if (name.slice(0, spec.prefix.length) !== spec.prefix) return `the name does not start with the prefix "${spec.prefix}"`;
    i = spec.prefix.length;
  }
  let j = i;
  while (j < name.length && isDigit(name.charCodeAt(j))) j += 1;
  const digits = j - i;
  if (digits === 0) return spec.prefix ? `there is no number after the prefix "${spec.prefix}"` : 'the name does not start with a number';
  if (digits !== spec.digits) return `the number has ${digits} ${digits === 1 ? 'digit' : 'digits'}, not ${spec.digits}`;
  if (!name.endsWith(spec.extension)) return `the extension is "${name.slice(name.length - spec.extension.length)}", not "${spec.extension}"`;
  const rest = name.slice(j, name.length - spec.extension.length);
  if (rest === '') return 'there is no title after the number';
  if (rest[0] !== spec.separator) return `the number is not followed by the separator "${spec.separator}"`;
  const words = rest.slice(1).split(spec.separator);
  for (const word of words) {
    if (word === '') return `there are two separators "${spec.separator}" in a row, or one at the end of the title`;
    for (let k = 0; k < word.length; k += 1) {
      const c = word.charCodeAt(k);
      if (isLower(c) || isDigit(c)) continue;
      if (isUpper(c)) {
        if (spec.lowercase) return `the word "${word}" holds an upper-case letter; the title is written in lowercase`;
        continue;
      }
      return `the word "${word}" holds the character "${word[k]}"; a title holds only the letters a to z, digits and the separator "${spec.separator}"`;
    }
  }
  return null;
}

// The title of a record in the form two titles are compared in: a leading "ADR 9:", "ADR-0009 -" or "9." left out, then
// lower case, with every run of characters that are not letters or digits read as one space.
const ADR_NUMBER = /^\s*adr[\s-]*\d{1,9}\s*[:.)-]*\s*/i;
const PLAIN_NUMBER = /^\s*\d{1,9}\s*[:.)-]+\s*/;
const NOT_WORD = /[^\p{L}\p{N}]+/gu;

export function titleKey(title) {
  let t = String(title).slice(0, 1000);
  const stripped = t.replace(ADR_NUMBER, '').replace(PLAIN_NUMBER, '');
  if (/[\p{L}\p{N}]/u.test(stripped)) t = stripped;
  return t.toLowerCase().replace(NOT_WORD, ' ').trim();
}
