// Puts the parts together: lists the folder, reads every record, finds its title, its layout, its sections, its status
// and its links, runs the rules over the records one by one and over the folder as a whole, and builds the report. This
// is the only place that knows every part. An input that cannot be read stops the run with an InputError that names
// every problem; there is then no verdict.

import { join } from 'node:path';
import { ConfigError, defaultConfig, readConfig } from './config.js';
import { FILE_LIMITS, displayPath, listFolder, readText, readTextFile } from './files.js';
import { splitFrontMatter } from './frontmatter.js';
import { MARKDOWN_LIMITS, columnOf, readMarkdown, textOf } from './markdown.js';
import { excerpt, findPhrases, hasWordsOutside, maskLine, preparePhrase } from './inline.js';
import { adrNumbers, classifyLink, findLinks } from './links.js';
import { asciiLower, fileNameProblem, isRecordFile, numberOf, specText, titleKey } from './names.js';
import { detectLayout, headingExtents, isStatusHeading, matchHeading } from './sections.js';
import { RULES, decide, ruleById } from './rules.js';
import { FACTS, LEVELS, NOTICE, factPage } from './data.js';
import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';

// maxFindingsPerRule keeps a report readable: past it, the findings of a rule are counted in a note, not listed.
export const LIMITS = { ...FILE_LIMITS, ...MARKDOWN_LIMITS, maxFindingsPerRule: 500 };

// At most this many problems of the input are listed; the rest are counted.
export const MAX_PROBLEMS = 20;

export class InputError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.problems = problems;
  }
}

const RULE_ORDER = RULES.map((r) => r.id);
const quoteOf = (t) => safeText(t, 80);
const STATUS_LINE = /^[*_\s]*status[*_\s]*:[*_\s]*/i;
const STATUS_WORD = /^[A-Za-z][A-Za-z-]*/;

// The status word of a status text: its first word, in lower case, after any markup, quote or bracket.
export function statusWord(text) {
  const t = String(text).replace(/^[\s*_`"'[(]+/, '');
  const m = STATUS_WORD.exec(t);
  return m ? asciiLower(m[0]).replace(/-+$/, '') : '';
}

// Every place of text in curly braces that holds a letter or a digit, on a masked line, as placeholders.
export function braceSpans(plain) {
  const spans = [];
  let close = -1;
  for (let i = 0; i < plain.length; i += 1) {
    if (plain[i] !== '{') continue;
    if (close < i) close = plain.indexOf('}', i + 1);
    if (close < 0) break;
    const inner = plain.slice(i + 1, close);
    if (/[\p{L}\p{N}]/u.test(inner) && !inner.includes('{')) {
      spans.push({ phrase: 'text in curly braces', from: i, to: close + 1 });
      i = close;
    }
  }
  return spans;
}

// Reads one record: its title, layout, sections, status, links and placeholders. name is the file name, text its
// content; the result holds no finding yet.
export function readRecord(name, text, config, limits = LIMITS) {
  const fm = splitFrontMatter(text);
  const doc = readMarkdown(fm.text, { maxDepth: limits.maxDepth, maxLines: limits.maxLines });
  const { headings, units } = doc;
  const prepared = config.placeholders.map(preparePhrase);

  // The title: the first heading when it is a level 1 heading, else the title of the front matter.
  let title = null;
  let titleIndex = -1;
  if (headings.length && headings[0].level === 1 && headings[0].text) {
    titleIndex = 0;
    title = { text: headings[0].text, line: headings[0].line, column: headings[0].column, from: 'heading' };
  } else if (fm.fields.has('title') && fm.fields.get('title')[0].value) {
    const f = fm.fields.get('title')[0];
    title = { text: f.value, line: f.line, column: f.column, from: 'front matter' };
  }

  // The layout, from the headings other than the title and the status headings.
  const sectionHeads = headings.filter((h, i) => i !== titleIndex && !isStatusHeading(h.text, config.statusKeys));
  const detected = config.layout === 'detect' ? detectLayout(sectionHeads.map((h) => h.text), config.layouts) : { layout: config.layouts.find((l) => l.id === config.layout), scores: [], tie: false };
  const layout = detected.layout;
  const matches = headings.map((h, i) => {
    if (i === titleIndex) return { kind: 'title' };
    if (isStatusHeading(h.text, config.statusKeys)) return { kind: 'status' };
    const s = layout ? matchHeading(h.text, layout) : null;
    return s ? { kind: 'section', section: s } : { kind: 'other' };
  });

  // The units under each heading.
  const ends = headingExtents(headings);
  const firstUnit = new Array(headings.length + 1).fill(units.length);
  for (let u = units.length - 1; u >= 0; u -= 1) if (units[u].heading >= 0) firstUnit[units[u].heading] = u;
  for (let h = headings.length - 1; h >= 0; h -= 1) if (firstUnit[h] > firstUnit[h + 1]) firstUnit[h] = firstUnit[h + 1];
  const extent = (h) => [firstUnit[h], firstUnit[ends[h]]];

  // Placeholders in every unit with text outside block quotes, and whether the unit holds nothing but placeholders.
  for (const unit of units) {
    unit.placeholders = [];
    unit.onlyPlaceholders = false;
    if (!unit.segments.length || unit.quoted) continue;
    const masks = unit.segments.map((g) => maskLine(g.s));
    masks.forEach((m, g) => {
      const hits = [...findPhrases(m.plain, prepared), ...(config.templateBraces ? braceSpans(m.plain) : [])].sort((a, b) => a.from - b.from);
      for (const hit of hits) unit.placeholders.push({ ...hit, segment: g });
    });
    unit.onlyPlaceholders = unit.placeholders.length > 0 && !masks.some((m, g) => hasWordsOutside(m.plain, unit.placeholders.filter((p) => p.segment === g)));
  }

  // The state of every heading: body, empty (nothing under it) or placeholder (nothing but placeholders).
  const states = headings.map((h, i) => {
    const [a, b] = extent(i);
    const body = units.slice(a, b).filter((u) => u.kind !== 'heading');
    if (!body.length) return { state: 'empty', placeholders: [] };
    if (body.every((u) => u.segments.length && u.onlyPlaceholders)) return { state: 'placeholder', placeholders: [...new Set(body.flatMap((u) => u.placeholders.map((p) => p.phrase)))] };
    return { state: 'body', placeholders: [] };
  });

  // The sections of the layout with the headings that match them.
  const sections = layout
    ? layout.sections.filter((s) => s.level !== 'off').map((s) => {
      const found = [];
      headings.forEach((h, i) => {
        if (matches[i].kind === 'section' && matches[i].section.id === s.id) found.push({ index: i, line: h.line, text: quoteOf(h.text), state: states[i].state });
      });
      const status = !found.length ? 'missing' : found.some((f) => f.state === 'body') ? 'found' : 'empty';
      return { id: s.id, title: s.title, level: s.level, status, headings: found, aliases: s.aliases, basis: s.basis };
    })
    : [];

  // The status: the front matter, else the first text under a status heading, else a "Status:" line before the first
  // section. refs holds every text that may name the record that replaces this one.
  let status = null;
  const fmStatus = fm.fields.get('status') ?? [];
  const textUnit = (u) => u.segments.length && (u.kind === 'paragraph' || u.kind === 'item' || u.kind === 'row');
  if (fmStatus.length) {
    const f = fmStatus[0];
    status = { text: f.value, line: f.line, column: f.column, from: 'front matter', repeated: fmStatus.map((x) => x.line), refs: [{ text: f.value, line: f.line, segment: null }] };
  } else {
    const at = headings.findIndex((h, i) => matches[i].kind === 'status');
    if (at >= 0) {
      const [a, b] = extent(at);
      const inside = units.slice(a, b).filter((u) => u.kind !== 'heading' && textUnit(u));
      if (inside.length) {
        const seg = inside[0].segments[0];
        status = { text: textOf(inside[0].segments), line: seg.line.no, column: columnOf(seg.line, seg.start), from: `the section "${quoteOf(headings[at].text)}"`, repeated: [], refs: inside.flatMap((u) => u.segments.map((g) => ({ text: g.s, line: g.line.no, segment: g }))) };
      }
      // A status heading with no text under it gives no status; empty-section reports the heading.
    } else {
      const firstSection = headings.findIndex((h, i) => i !== titleIndex);
      for (const u of units) {
        if (firstSection >= 0 && u.heading >= firstSection) break;
        if (!textUnit(u) || u.quoted) continue;
        const seg = u.segments[0];
        const m = STATUS_LINE.exec(seg.s);
        if (!m) continue;
        status = { text: seg.s.slice(m[0].length), line: seg.line.no, column: columnOf(seg.line, seg.start + m[0].length), from: 'a "Status:" line', repeated: [], refs: [{ text: seg.s.slice(m[0].length), line: seg.line.no, segment: seg }] };
        break;
      }
    }
  }
  if (status) status.word = statusWord(status.text);

  // The links of every piece of text, block quotes included, code left out.
  const links = [];
  for (const unit of units) {
    for (const seg of unit.segments) {
      for (const link of findLinks(seg.s)) links.push({ ...link, ...classifyLink(link.destination), line: seg.line.no, column: columnOf(seg.line, seg.start + link.from) });
    }
  }

  return {
    name,
    number: numberOf(name, config.fileName),
    lines: doc.lines,
    frontMatter: fm.lines,
    title,
    titleIndex,
    layout: layout ? layout.id : null,
    detection: detected,
    headings,
    units,
    matches,
    states,
    ends,
    extent,
    sections,
    status,
    links,
    unclosed: doc.unclosed,
    tooDeep: doc.tooDeep
  };
}

// The heading of a unit as a report names it.
const headingName = (rec, index) => (index < 0 ? 'the text before the first heading' : rec.headings[index].text ? `"${quoteOf(rec.headings[index].text)}"` : `the heading on line ${rec.headings[index].line}`);

// Builds the report from the listed folder and the read records. folder: { shown, files, folders, links, other, ignored,
// notRecords }; meta: { version, configFile, maxFindingsPerRule }.
export function buildReport(folder, records, config, meta = {}) {
  const maxPerRule = meta.maxFindingsPerRule ?? LIMITS.maxFindingsPerRule;
  const rules = config.rules;
  const findings = [];
  const counts = new Map();
  const notes = [];
  const pathOf = (name) => safeText(folder.shown === '.' ? name : `${folder.shown}/${name}`, 300);
  const push = (f) => {
    const n = (counts.get(f.rule) ?? 0) + 1;
    counts.set(f.rule, n);
    if (n <= maxPerRule) findings.push({ ...f, at: f.file ? `${pathOf(f.file)}${f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : ''}` : safeText(folder.shown, 300) });
  };
  const on = (key) => rules[key].level !== 'off';
  const fileSet = new Set(folder.files);
  const linkSet = new Set(folder.links);
  const folderSet = new Set(folder.folders);
  const recordNames = new Set(records.map((r) => r.name));
  const byNumber = new Map();
  for (const r of records) if (r.number !== null) byNumber.set(r.number, [...(byNumber.get(r.number) ?? []), r]);

  for (const rec of records) {
    const f = (o) => push({ file: rec.name, line: null, column: null, ...o });

    if (on('fileName')) {
      const problem = fileNameProblem(rec.name, config.fileName);
      if (problem) f({ rule: 'file-name', level: rules.fileName.level, found: `the file name ${quoteOf(rec.name)} does not follow ${specText(config.fileName)}: ${safeText(problem, 200)}`, why: [`the spec of a file name is ${specText(config.fileName)}`] });
    }

    if (on('missingTitle') && !rec.title) {
      const first = rec.headings[0];
      f({ rule: 'missing-title', level: rules.missingTitle.level, line: first?.line ?? null, column: first?.column ?? null, found: first ? `the record has no title: its first heading "${quoteOf(first.text)}" is a level ${first.level} heading` : 'the record has no title: it has no heading and no title in its front matter', why: ['the title is the first heading of the record when it is a level 1 heading, or the title key of its front matter'] });
    }

    if (!rec.layout) {
      if (on('unknownLayout') && config.layout === 'detect') {
        f({ rule: 'unknown-layout', level: rules.unknownLayout.level, found: `no heading of the record matches a section of ${listText(config.layouts.filter((l) => l.sections.some((s) => s.level !== 'off')).map((l) => l.title), 6)}, so its sections are not checked`, why: [`the headings of the record are ${rec.headings.length ? listText(rec.headings.map((h) => `"${quoteOf(h.text)}"`), 8) : 'none'}`, 'a layout is chosen by the number of its sections that the headings match; here every layout matches none'] });
      }
    } else {
      if (rec.detection.tie) notes.push(`${pathOf(rec.name)} matches as many sections of ${listText(rec.detection.scores.filter((s) => s.count === Math.max(...rec.detection.scores.map((x) => x.count))).map((s) => s.id), 6)}; it is read as ${rec.layout}, the first of them in the configuration`);
      if (on('missingSection')) {
        for (const s of rec.sections) {
          if (s.status !== 'missing' || (s.level !== 'required' && s.level !== 'recommended')) continue;
          const level = rules.missingSection[s.level];
          if (level === 'off') continue;
          const layout = config.layouts.find((l) => l.id === rec.layout);
          f({ rule: 'missing-section', level, found: `${s.level} section ${s.title} of the ${layout.title} layout is missing`, why: [`no heading matches one of its aliases: ${listText(s.aliases, 8)}`, rec.detection.scores.length ? `the record is read as ${layout.title} because ${plural(rec.detection.scores.find((x) => x.id === rec.layout).count, 'heading')} of it match${rec.detection.scores.find((x) => x.id === rec.layout).count === 1 ? 'es' : ''} sections of that layout` : `every record is read as ${layout.title}, as the configuration says`, ...s.basis.map((k) => `the layout has this section because of "${FACTS[k].text}"`)] });
        }
      }
    }

    // empty-section, for every heading other than the title; a heading with headings under it that are all empty is
    // reported through them.
    const coveredByEmpty = new Set();
    if (on('emptySection')) {
      rec.headings.forEach((h, i) => {
        if (i === rec.titleIndex) return;
        const st = rec.states[i];
        if (st.state === 'body') return;
        const [a, b] = rec.extent(i);
        for (let u = a; u < b; u += 1) coveredByEmpty.add(u);
        if (rec.ends[i] > i + 1) return;
        const m = rec.matches[i];
        const what = m.kind === 'section' ? `the heading matches the section ${m.section.title} of the ${config.layouts.find((l) => l.id === rec.layout).title} layout` : m.kind === 'status' ? 'the heading is the heading of the status section' : 'the heading matches no section of the layout';
        f({ rule: 'empty-section', level: rules.emptySection.level, line: h.line, column: h.column, found: st.state === 'empty' ? `the heading ${headingName(rec, i)} has no text under it` : `the heading ${headingName(rec, i)} holds nothing but ${listText(st.placeholders.map((p) => safeText(p, 30)), 3)}`, why: [what, st.state === 'empty' ? 'there is no paragraph, list, table, code block or block quote before the next heading at its level or above' : 'every piece of text under it is a placeholder once the placeholders are taken out'] });
      });
    }

    if (on('placeholder')) {
      rec.units.forEach((unit, u) => {
        if (coveredByEmpty.has(u)) return;
        for (const p of unit.placeholders) {
          const g = unit.segments[p.segment];
          const column = columnOf(g.line, g.start + p.from);
          const shown = p.phrase === 'text in curly braces' ? safeText(g.s.slice(p.from, p.to), 40) : safeText(p.phrase, 40);
          f({ rule: 'placeholder', level: rules.placeholder.level, line: g.line.no, column, found: `placeholder ${shown} in ${headingName(rec, unit.heading)}: ${safeText(excerpt(g.s, p.from, p.to), 120)}`, why: [p.phrase === 'text in curly braces' ? 'text in curly braces is how the MADR template writes a part to fill in' : `${safeText(p.phrase, 40)} is on the list of placeholders; the text around it is not written yet`] });
        }
      });
    }

    const layout = config.layouts.find((l) => l.id === rec.layout);
    if (on('missingStatus') && layout && layout.requireStatus && !rec.status) {
      f({ rule: 'missing-status', level: rules.missingStatus.level, found: `the record has no status, and the ${layout.title} layout needs one`, why: [`no front matter key status, no section headed ${listText(config.statusHeadings, 4)} and no "Status:" line before the first section`] });
    }

    if (on('unknownStatus') && rec.status) {
      const s = rec.status;
      if (s.repeated.length > 1) f({ rule: 'unknown-status', level: rules.unknownStatus.level, line: s.line, column: s.column, found: `the status is given ${plural(s.repeated.length, 'time')} in the front matter, on lines ${listText(s.repeated.map(String), 6)}`, why: ['a record has one status; when it is given twice, which one holds cannot be told'] });
      else if (!config.statuses.includes(s.word)) f({ rule: 'unknown-status', level: rules.unknownStatus.level, line: s.line, column: s.column, found: s.word ? `the status "${safeText(s.word, 40)}" is not one of ${listText(config.statuses, 12)}` : `the status in ${s.from} holds no status word${s.text ? `: ${safeText(s.text, 80)}` : ''}`, why: [`the status is read from ${s.from}: ${s.text ? `"${safeText(s.text, 80)}"` : 'nothing'}`, `its first word is ${s.word ? `"${safeText(s.word, 40)}"` : 'missing'}`] });
    }

    if (on('supersededLink') && rec.status && rules.supersededLink.statuses.includes(rec.status.word)) {
      const named = [];
      for (const ref of rec.status.refs) {
        for (const link of ref.segment ? findLinks(ref.segment.s) : findLinks(ref.text)) {
          const c = classifyLink(link.destination);
          if (c.kind === 'file') named.push({ how: `the link ${safeText(link.destination, 80)}`, ok: c.target !== rec.name && recordNames.has(c.target) });
        }
        for (const n of adrNumbers(ref.text)) named.push({ how: `ADR ${n}`, ok: n !== rec.number && byNumber.has(n) });
      }
      if (!named.some((x) => x.ok)) {
        f({ rule: 'superseded-link', level: rules.supersededLink.level, line: rec.status.line, column: rec.status.column, found: named.length ? `the record is ${rec.status.word}, but ${listText(named.map((x) => x.how), 4)} ${named.length === 1 ? "names" : "name"} no other record of the folder` : `the record is ${rec.status.word}, but its status names no record that replaces it`, why: [`the status is read from ${rec.status.from}: "${safeText(rec.status.text, 80)}"`, 'the status of a replaced record links to the record that replaces it, or names its number, such as ADR-0005'] });
      }
    }

    for (const link of rec.links) {
      if (link.kind !== 'file') continue;
      if (fileSet.has(link.target)) continue;
      if (folderSet.has(link.target)) {
        link.kind = 'subfolder';
        continue;
      }
      if (!on('brokenLink')) continue;
      const near = folder.files.find((n) => asciiLower(n) === asciiLower(link.target));
      const reason = linkSet.has(link.target) ? 'is a symbolic link, which is never followed' : near ? `is not in the folder; the folder holds ${quoteOf(near)}, which differs in case` : 'is not in the folder';
      f({ rule: 'broken-link', level: rules.brokenLink.level, line: link.line, column: link.column, found: `the link ${safeText(link.destination, 80)} points to ${quoteOf(link.target)}, which ${reason}`, why: [`the destination is a relative path to a name in the folder ${folder.shown}`, `the folder was listed once; the link is resolved against that list, and nothing is opened`] });
    }
  }

  // stale-proposed: a pending record with at least `after` decided records later in the numbered sequence.
  if (on('staleProposed')) {
    const r = rules.staleProposed;
    const numbered = records.filter((x) => x.number !== null).sort((x, y) => x.number - y.number);
    const decided = (x) => Boolean(x.status && r.decided.includes(x.status.word));
    // suffix[i]: the decided records at places i and after in the numbered sequence.
    const suffix = new Array(numbered.length + 1).fill(0);
    for (let i = numbered.length - 1; i >= 0; i -= 1) suffix[i] = suffix[i + 1] + (decided(numbered[i]) ? 1 : 0);
    numbered.forEach((rec, i) => {
      if (!rec.status || rec.status.word !== r.pending) return;
      let k = i;
      while (k + 1 < numbered.length && numbered[k + 1].number === rec.number) k += 1;
      const count = suffix[k + 1];
      if (count < r.after) return;
      const first = [];
      for (let j = k + 1; j < numbered.length && first.length < 3; j += 1) if (decided(numbered[j])) first.push(quoteOf(numbered[j].name));
      const words = listText(r.decided, 6).replace(/ and /g, ' or ');
      push({ rule: 'stale-proposed', level: r.level, file: rec.name, line: rec.status.line, column: rec.status.column, found: `the record is still ${r.pending} while ${plural(count, 'later record')} ${count === 1 ? 'is' : 'are'} ${words}: ${count > first.length ? `${first.join(', ')} and ${grouped(count - first.length)} more` : listText(first, 3)}`, why: [`its number is ${grouped(rec.number)}, and ${plural(count, 'record')} with a greater number ${count === 1 ? 'has' : 'have'} the status ${words}`, `the limit is ${grouped(r.after)}: the tool reads no date, so the place in the numbered sequence measures how long a decision has waited`] });
    });
  }

  // duplicate-number and numbering-gap, over the whole folder.
  const numbers = [...byNumber.keys()].sort((a, b) => a - b);
  if (on('duplicateNumber')) {
    for (const n of numbers) {
      const list = byNumber.get(n);
      if (list.length < 2) continue;
      push({ rule: 'duplicate-number', level: rules.duplicateNumber.level, file: list[1].name, line: null, column: null, found: `the number ${grouped(n)} is used by ${plural(list.length, 'record')}: ${listText(list.map((x) => quoteOf(x.name)), 4)}`, why: ['the number of a record is read from its file name', 'a link or a mention by number such as ADR-0005 cannot tell these records apart'] });
    }
  }
  if (on('numberingGap')) {
    for (let i = 1; i < numbers.length; i += 1) {
      const a = numbers[i - 1];
      const b = numbers[i];
      if (b <= a + 1) continue;
      push({ rule: 'numbering-gap', level: rules.numberingGap.level, file: null, line: null, column: null, found: b === a + 2 ? `no record has the number ${grouped(a + 1)}, between ${quoteOf(byNumber.get(a)[0].name)} and ${quoteOf(byNumber.get(b)[0].name)}` : `no record has a number from ${grouped(a + 1)} to ${grouped(b - 1)}, between ${quoteOf(byNumber.get(a)[0].name)} and ${quoteOf(byNumber.get(b)[0].name)}`, why: [`the numbers of the records run from ${grouped(numbers[0])} to ${grouped(numbers.at(-1))}`, 'a missing number can be a record that was deleted, renamed or never added'] });
    }
  }
  if (on('duplicateTitle')) {
    const byTitle = new Map();
    for (const rec of records) {
      if (!rec.title) continue;
      const key = titleKey(rec.title.text);
      if (key) byTitle.set(key, [...(byTitle.get(key) ?? []), rec]);
    }
    for (const list of byTitle.values()) {
      if (list.length < 2) continue;
      push({ rule: 'duplicate-title', level: rules.duplicateTitle.level, file: list[1].name, line: list[1].title.line, column: list[1].title.column, found: `the title "${quoteOf(list[1].title.text)}" is the title of ${plural(list.length, 'record')}: ${listText(list.map((x) => quoteOf(x.name)), 4)}`, why: ['titles are compared once a leading "ADR 9:" or "9." is left out, case is ignored and punctuation is read as a space'] });
    }
  }

  // Notes: what was not read or not followed.
  const allLinks = records.flatMap((rec) => rec.links.map((l) => ({ ...l, file: rec.name })));
  const notFollowed = allLinks.filter((l) => ['outside', 'subfolder', 'absolute', 'folder'].includes(l.kind));
  const web = allLinks.filter((l) => l.kind === 'web');
  for (const [rule, n] of counts) if (n > maxPerRule) notes.push(`${rule}: ${plural(n, 'finding')}; the first ${grouped(maxPerRule)} are listed`);
  if (notFollowed.length) notes.push(`${plural(notFollowed.length, 'link')} ${notFollowed.length === 1 ? 'leaves' : 'leave'} the folder and ${notFollowed.length === 1 ? 'was' : 'were'} not followed: ${listText(notFollowed.map((l) => `${pathOf(l.file)}:${l.line} ${safeText(l.destination, 60)}`), 3)}`);
  if (web.length) notes.push(`${plural(web.length, 'web address', 'web addresses')} ${web.length === 1 ? 'was' : 'were'} not fetched`);
  if (folder.links.length) notes.push(`${plural(folder.links.length, 'entry', 'entries')} of the folder ${folder.links.length === 1 ? 'is a symbolic link' : 'are symbolic links'} and ${folder.links.length === 1 ? 'was' : 'were'} not followed: ${listText(folder.links.map(quoteOf), 3)}`);
  if (folder.folders.length) notes.push(`${plural(folder.folders.length, 'subfolder')} ${folder.folders.length === 1 ? 'was' : 'were'} not read: ${listText(folder.folders.map(quoteOf), 3)}`);
  if (folder.other.length) notes.push(`${plural(folder.other.length, 'entry', 'entries')} of the folder ${folder.other.length === 1 ? 'is' : 'are'} neither a file, a folder nor a link and ${folder.other.length === 1 ? 'was' : 'were'} passed over: ${listText(folder.other.map(quoteOf), 3)}`);
  if (folder.ignored.length) notes.push(`not read as records: ${listText(folder.ignored.map(quoteOf), 4)}`);
  if (!records.length) notes.push(`the folder holds no record: no file name ends with ${config.fileName.extension} other than the ignored files`);
  for (const rec of records) {
    for (const line of rec.unclosed) notes.push(`${pathOf(rec.name)}: a code fence opened on line ${grouped(line)} is never closed, so the rest of its container is read as code and not checked`);
    if (rec.tooDeep !== null) notes.push(`${pathOf(rec.name)}: lists or block quotes are nested more than ${LIMITS.maxDepth} deep from line ${grouped(rec.tooDeep)}; the deeper text is read as plain paragraphs`);
  }

  const levelRank = (l) => LEVELS.length - LEVELS.indexOf(l);
  const byUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  findings.sort((a, b) => levelRank(a.level) - levelRank(b.level) || byUnits(a.file ?? '', b.file ?? '') || (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0) || RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule));

  const verdict = decide(findings, config.failOn);
  const ruleLevels = (key) => (key === 'missingSection' ? { required: rules.missingSection.required, recommended: rules.missingSection.recommended } : { level: rules[key].level });
  const byLayout = {};
  for (const l of config.layouts) byLayout[l.id] = records.filter((r) => r.layout === l.id).length;
  byLayout.none = records.filter((r) => !r.layout).length;
  const byStatus = {};
  for (const w of config.statuses) byStatus[w] = records.filter((r) => r.status?.word === w).length;
  byStatus.other = records.filter((r) => r.status && !config.statuses.includes(r.status.word)).length;
  byStatus.none = records.filter((r) => !r.status).length;
  const links = { checked: allLinks.filter((l) => l.kind === 'file').length, broken: counts.get('broken-link') ?? 0, notFollowed: notFollowed.length, web: web.length, anchors: allLinks.filter((l) => l.kind === 'anchor').length };

  return {
    tool: 'adr-health-check',
    version: meta.version ?? '',
    folder: { path: safeText(folder.shown, 300), records: records.length, otherFiles: folder.files.length - records.length, subfolders: folder.folders.length, symbolicLinks: folder.links.length },
    config: {
      file: meta.configFile ?? null,
      name: config.name,
      failOn: config.failOn,
      layout: config.layout,
      layouts: config.layouts.map((l) => ({ id: l.id, title: l.title, requireStatus: l.requireStatus, sections: l.sections.filter((s) => s.level !== 'off').length })),
      statuses: [...config.statuses],
      placeholders: config.placeholders.length,
      templateBraces: config.templateBraces,
      fileName: specText(config.fileName),
      rules: RULES.map((r) => ({ id: r.id, ...ruleLevels(r.key), rule: r.rule(rules[r.key], config) }))
    },
    totals: { records: records.length, byLayout, byStatus, links },
    records: records.map((rec) => ({
      file: pathOf(rec.name),
      number: rec.number,
      layout: rec.layout,
      title: rec.title ? quoteOf(rec.title.text) : null,
      status: rec.status ? { word: rec.status.word, text: safeText(rec.status.text, 120), line: rec.status.line, from: rec.status.from } : null,
      sections: rec.sections.map(({ headings: hs, basis, aliases, ...s }) => ({ ...s, headings: hs.map(({ index, ...h }) => h) }))
    })),
    findings: findings.map((f) => ({ ...f, basis: ruleById(f.rule).facts.map((k) => ({ ...FACTS[k], page: factPage(k) })), own: ruleById(f.rule).own })),
    verdict,
    notes,
    notice: NOTICE
  };
}

// Reads the folder and the configuration and gives the report. o: { folder, config, failOn, base, limits, version }.
export async function checkPaths(o) {
  const base = o.base ?? process.cwd();
  const limits = { ...LIMITS, ...(o.limits ?? {}) };
  const problems = [];
  let config = defaultConfig();
  let configFile = null;
  if (o.config) {
    try {
      const read = await readTextFile(o.config, base, limits.maxConfigBytes);
      configFile = read.file;
      config = readConfig(read.text, read.file);
    } catch (error) {
      if (error instanceof ConfigError) problems.push(...error.problems.map((p) => p.text));
      else problems.push(error.message);
    }
  }
  let folder = null;
  try {
    folder = await listFolder(o.folder, base, limits.maxEntries);
  } catch (error) {
    problems.push(error.message);
  }
  const records = [];
  if (folder && !problems.length) {
    const names = folder.files.filter((n) => isRecordFile(n, config.fileName, config.ignoreFiles));
    folder.ignored = folder.files.filter((n) => !names.includes(n) && asciiLower(n).endsWith(asciiLower(config.fileName.extension)));
    let total = 0;
    for (const name of names) {
      const shown = folder.shown === '.' ? name : `${folder.shown}/${name}`;
      try {
        const read = await readText(join(folder.full, name), shown, limits.maxRecordBytes);
        total += read.size;
        if (total > limits.maxTotalBytes) {
          problems.push(`${folder.shown}: the records together are over the ${grouped(limits.maxTotalBytes / 1048576)} MB limit; check a smaller folder`);
          break;
        }
        records.push(readRecord(name, read.text, config, limits));
      } catch (error) {
        problems.push(error.reason ? error.message : `${shown}: ${error.message}`);
      }
    }
  }
  if (problems.length) {
    const shown = problems.slice(0, MAX_PROBLEMS).map((p) => safeText(p, 1500));
    if (problems.length > MAX_PROBLEMS) shown.push(`and ${grouped(problems.length - MAX_PROBLEMS)} more`);
    throw new InputError(shown);
  }
  if (o.failOn) config.failOn = o.failOn;
  return buildReport(folder, records, config, { version: o.version, configFile, maxFindingsPerRule: limits.maxFindingsPerRule });
}
