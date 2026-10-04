// The fourteen rules and the verdict. Each rule names the sentences of the saved pages it rests on (src/data.js), and
// says where it is the tool's own choice; docs/method.md says exactly what each rule looks at and what it cannot see. A
// rule whose level is "off" is not run.

import { LEVELS } from './data.js';
import { specText } from './names.js';
import { grouped, listText, plural } from './size.js';

const active = (config) => config.layouts.filter((l) => l.sections.some((s) => s.level !== 'off'));

export const RULES = [
  {
    id: 'missing-title',
    key: 'missingTitle',
    title: 'a record with no title',
    facts: ['nyTitle'],
    own: null,
    rule: () => 'a record whose first heading is not a level 1 heading and whose front matter has no title'
  },
  {
    id: 'unknown-layout',
    key: 'unknownLayout',
    title: 'a record that follows none of the layouts',
    facts: ['nyFewParts', 'madrStreamlined'],
    own: 'a record must match at least one section of a layout before its sections can be checked',
    rule: (r, config) => (config.layout === 'detect' ? `a record in which no heading matches a section of any layout (${active(config).map((l) => l.title).join(', ')})` : `not run: every record is read as ${config.layout}`)
  },
  {
    id: 'missing-section',
    key: 'missingSection',
    title: 'a section of the layout that no heading matches',
    facts: ['nyFewParts', 'madrStreamlined'],
    own: null,
    rule: (r) => `a section of the layout of a record at level required (finding at ${r.required}) or recommended (finding at ${r.recommended}) for which no heading matches one of its aliases`
  },
  {
    id: 'empty-section',
    key: 'emptySection',
    title: 'a heading with no text under it, or nothing but placeholders',
    facts: ['nyUpToDate'],
    own: 'a heading with nothing under it says that a part of the record was never written',
    rule: () => 'a heading other than the title under which, down to the next heading at its level or above, there is no paragraph, list, table, code block or block quote, or where every piece of text is nothing but placeholders'
  },
  {
    id: 'placeholder',
    key: 'placeholder',
    title: 'text that marks a part of a record as not written yet',
    facts: ['madrPlaceholders'],
    own: 'the list of placeholders is the tool\'s own',
    rule: (r, config) => `a placeholder of the list (${plural(config.placeholders.length, 'phrase')})${config.templateBraces ? ', or text in curly braces as the MADR template writes the parts to fill in,' : ''} in a heading or in text of any section, outside code, quotes and links`
  },
  {
    id: 'missing-status',
    key: 'missingStatus',
    title: 'a record with no status, in a layout that needs one',
    facts: ['nyStatus'],
    own: null,
    rule: (r, config) => `a record of a layout that needs a status (${active(config).filter((l) => l.requireStatus).map((l) => l.title).join(', ') || 'none'}) with no status in its front matter, in a section headed ${listText(config.statusHeadings, 4)}, or on a "Status:" line before its first section`
  },
  {
    id: 'unknown-status',
    key: 'unknownStatus',
    title: 'a status that is not one of the status words',
    facts: ['nyStatus', 'tplStatus'],
    own: null,
    rule: (r, config) => `a status whose first word is not one of ${listText(config.statuses, 12)}, or a status given more than once in the front matter`
  },
  {
    id: 'stale-proposed',
    key: 'staleProposed',
    title: 'a record still pending while later records were decided',
    facts: ['nyStatus', 'nyNumbered'],
    own: 'the number of later decided records that makes a pending record stale is the tool\'s own; the tool reads no clock and no date, so the place of a record in the numbered sequence is the only measure of its age',
    rule: (r) => `a record with the status ${r.pending} and a number n, when at least ${grouped(r.after)} records with a number greater than n have the status ${listText(r.decided, 6).replace(/ and /g, ' or ')}`
  },
  {
    id: 'superseded-link',
    key: 'supersededLink',
    title: 'a superseded record that does not name the record that replaces it',
    facts: ['nyReplacement', 'nySuperseded'],
    own: null,
    rule: (r) => `a record with the status ${listText(r.statuses, 6).replace(/ and /g, ' or ')} whose status holds neither a relative link to another record of the folder nor an ADR number ("ADR-0005", "ADR 5") of another record of the folder`
  },
  {
    id: 'broken-link',
    key: 'brokenLink',
    title: 'a relative link to a file that is not in the folder',
    facts: ['tplLinks', 'linkInline'],
    own: null,
    rule: () => 'an inline link, an image or a link reference definition outside code whose destination is a relative path to a name in the folder, and no regular file of the folder has that name; links that leave the folder are never followed, and web addresses are never fetched'
  },
  {
    id: 'duplicate-number',
    key: 'duplicateNumber',
    title: 'two records with the same number',
    facts: ['nyNumbered', 'madrConsecutive'],
    own: null,
    rule: (r, config) => `two or more records whose file names give the same number (the digits after the prefix "${config.fileName.prefix}", or at the start of the name)`
  },
  {
    id: 'duplicate-title',
    key: 'duplicateTitle',
    title: 'two records with the same title',
    facts: ['nyTitle'],
    own: 'two records with one title make a link or a mention by title ambiguous',
    rule: () => 'two or more records whose titles are the same once a leading "ADR 9:" or "9." is left out, case is ignored and punctuation is read as a space'
  },
  {
    id: 'numbering-gap',
    key: 'numberingGap',
    title: 'a number missing between the lowest and the highest number',
    facts: ['nyNumbered', 'madrNext'],
    own: null,
    rule: () => 'a run of whole numbers between the lowest and the highest record number that no record has'
  },
  {
    id: 'file-name',
    key: 'fileName',
    title: 'a file name that does not follow the spec',
    facts: ['madrPattern', 'madrLowercase'],
    own: null,
    rule: (r, config) => `a record whose file name does not follow ${specText(config.fileName)}: ${config.fileName.prefix ? `the prefix "${config.fileName.prefix}", ` : ''}exactly ${plural(config.fileName.digits, 'digit')}, the separator "${config.fileName.separator}", words of ${config.fileName.lowercase ? 'lowercase letters a to z' : 'letters a to z'} and digits joined by "${config.fileName.separator}", and the extension ${config.fileName.extension}`
  }
];

export const ruleById = (id) => RULES.find((r) => r.id === id);

// True when a level is the fail level or above it.
export const atOrAbove = (level, failOn) => LEVELS.indexOf(level) >= LEVELS.indexOf(failOn);

// The verdict: { pass, failOn, failing, byLevel, text }.
export function decide(findings, failOn) {
  const byLevel = { error: 0, warning: 0, notice: 0 };
  for (const f of findings) byLevel[f.level] += 1;
  const failing = findings.filter((f) => atOrAbove(f.level, failOn)).length;
  const text = failing ? `FAIL - ${plural(failing, 'finding')} at or above ${failOn}` : `PASS - no finding at or above ${failOn}${findings.length ? ` (${grouped(findings.length)} below it)` : ''}`;
  return { pass: failing === 0, failOn, failing, byLevel, text };
}
