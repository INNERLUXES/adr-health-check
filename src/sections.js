// Matching the headings of a record to the sections of a layout, and finding the layout of a record. A heading and an
// alias are put in one normal form, and a heading matches a section when its normal form is the normal form of one of
// the aliases of the section: the whole heading, not a part of it. So "Decision Outcome" is the MADR section and not
// Nygard's "Decision", and "Context and Problem Statement" is not "Context". Nothing is matched by similarity.

// The words of a heading that number it: "4.2", "1.", "A)", "iv.", "Section 3:".
const NUMBERED_PART = /^(?:section|part|appendix|annex|chapter)\s+(?:\d+(?:\.\d+)*|[a-z]|[ivxlcdm]+)\b\s*[-:.)]*\s*(?=\S)/i;
const NUMBER = /^(?:\d+(?:\.\d+)*[.)]?|[a-z][.)]|[ivxlcdm]+[.)])\s+(?=\S)/i;
const LINK_DESTINATION = /\]\([^)]*\)/g;
const MARKUP = /[*_`[\]<>#\\]/g;
const NOT_WORD = /[^\p{L}\p{N}]+/gu;

export const SECTION_LIMITS = { maxHeadingChars: 1000 };

// The normal form of a text: lower case, "&" read as "and", every run of characters that are not letters or digits read
// as one space. With numbered: true the numbering at the start of a heading is left out first.
export function normalizeHeading(text, { numbered = true } = {}) {
  let t = String(text).slice(0, SECTION_LIMITS.maxHeadingChars).replace(LINK_DESTINATION, ']').replace(MARKUP, ' ').trim();
  if (numbered) {
    const stripped = t.replace(NUMBERED_PART, '').replace(NUMBER, '');
    if (/[\p{L}\p{N}]/u.test(stripped)) t = stripped;
  }
  return t.toLowerCase().replace(/&/g, ' and ').replace(NOT_WORD, ' ').trim();
}

// The section of a layout that a heading matches, or null. layout.sections each carry keys: the normal forms of their
// aliases. A section that is off is never matched.
export function matchHeading(text, layout) {
  const key = normalizeHeading(text);
  if (key === '') return null;
  return layout.sections.find((s) => s.level !== 'off' && s.keys.includes(key)) ?? null;
}

// True when a heading is one of the headings of the status section.
export function isStatusHeading(text, statusKeys) {
  const key = normalizeHeading(text);
  return key !== '' && statusKeys.includes(key);
}

// The layout of a record from its headings (the title left out): for each layout, the number of its sections, other than
// those that are off, that a heading matches, each section counted once. The layout with the most wins; on a tie, the
// layout that comes first in the configuration. With no match at all, there is no layout. Returns
// { layout, scores: [{ id, count }], tie }.
export function detectLayout(headingTexts, layouts) {
  const scores = layouts.map((layout) => {
    const found = new Set();
    for (const text of headingTexts) {
      const s = matchHeading(text, layout);
      if (s) found.add(s.id);
    }
    return { id: layout.id, count: found.size };
  });
  const best = Math.max(0, ...scores.map((s) => s.count));
  if (best === 0) return { layout: null, scores, tie: false };
  const winners = scores.filter((s) => s.count === best);
  return { layout: layouts.find((l) => l.id === winners[0].id), scores, tie: winners.length > 1 };
}

// The extent of every heading: the index of the next heading at its level or above, so heading h covers the headings
// h + 1 up to end - 1 and everything under them.
export function headingExtents(headings) {
  const ends = new Array(headings.length).fill(headings.length);
  const open = [];
  headings.forEach((h, i) => {
    while (open.length && headings[open[open.length - 1]].level >= h.level) ends[open.pop()] = i;
    open.push(i);
  });
  return ends;
}
