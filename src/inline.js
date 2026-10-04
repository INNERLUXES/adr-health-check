// Reading the text of one line for words: which parts are the author's own wording, and where a phrase of a list stands
// in them. Code spans, text in double quotes, link destinations, autolinks and inline HTML tags are not the author's
// wording: a code span names a command or a file, quoted text is a name or a quotation, and a link destination is an
// address. They are replaced by spaces, so every other character keeps its column. Nothing is opened or fetched.
//
// Every search runs once over the line, left to right: the closing backtick run, quote, parenthesis and angle bracket
// are found with positions that only move forward, so a line full of openers that never close still costs one pass.
// No regular expression is built from a phrase; phrases are found with indexOf.

const isDigit = (c) => c >= 48 && c <= 57;
const isAsciiLetter = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const WORD = /[\p{L}\p{N}_-]/u;
const LETTER = /[\p{L}\p{N}]/u;

// True when a character belongs to a word: a letter or a digit of any script, an underscore or a hyphen. A hyphen counts,
// so "fast" is not found in "fast-track".
export function isWordChar(ch) {
  return ch !== undefined && ch !== '' && WORD.test(ch);
}

// Lower case for the letters A to Z only, so the text keeps its length and its columns, and the result does not depend
// on the locale of the machine.
export function lowerAscii(s) {
  let out = '';
  let from = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) {
      out += s.slice(from, i) + String.fromCharCode(c + 32);
      from = i + 1;
    }
  }
  return from === 0 ? s : out + s.slice(from);
}

// The next index at or after from where ch stands, remembered so that a search never goes back.
function finder(s, ch) {
  let at = -2;
  return (from) => {
    if (at === -1) return -1;
    if (at < from) at = s.indexOf(ch, from);
    return at;
  };
}

const QUOTE_OPEN = String.fromCharCode(0x201c);
const QUOTE_CLOSE = String.fromCharCode(0x201d);

// Masks one line of text. Returns { plain, loose, codeSpans, quotes }:
// - plain: the line with code spans, quoted text, link destinations, autolinks and HTML tags replaced by spaces; the
//   author's own wording, read for vague words and placeholders;
// - loose: the line with only link destinations, autolinks and HTML tags replaced; read for the measurable elements of
//   an acceptance criterion, where a number or a name inside a code span or quotes counts;
// - codeSpans and quotes: how many of each the line holds.
export function maskLine(s) {
  const plain = s.split('');
  const loose = s.split('');
  const blank = (arr, a, b) => {
    for (let k = a; k < b; k += 1) arr[k] = ' ';
  };
  // The backtick runs of the line by their length, so the closing run of a code span is found without going back.
  const runs = new Map();
  for (let i = 0; i < s.length;) {
    if (s[i] === '`') {
      let j = i;
      while (s[j] === '`') j += 1;
      const n = j - i;
      if (!runs.has(n)) runs.set(n, { at: [], next: 0 });
      runs.get(n).at.push(i);
      i = j;
    } else i += 1;
  }
  const nextGt = finder(s, '>');
  const nextParen = finder(s, ')');
  const nextQuote = finder(s, '"');
  const nextClose = finder(s, QUOTE_CLOSE);
  let codeSpans = 0;
  let quotes = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length && !isAsciiLetter(s.charCodeAt(i + 1)) && !isDigit(s.charCodeAt(i + 1))) {
      i += 2;
      continue;
    }
    if (ch === '`') {
      let j = i;
      while (s[j] === '`') j += 1;
      const run = runs.get(j - i);
      while (run.next < run.at.length && run.at[run.next] <= i) run.next += 1;
      if (run.next < run.at.length) {
        const end = run.at[run.next] + (j - i);
        blank(plain, i, end);
        codeSpans += 1;
        i = end;
      } else i = j;
      continue;
    }
    if (ch === ']' && s[i + 1] === '(') {
      const end = nextParen(i + 2);
      if (end >= 0) {
        blank(plain, i + 1, end + 1);
        blank(loose, i + 1, end + 1);
        i = end + 1;
        continue;
      }
    }
    if (ch === '<') {
      const c = s.charCodeAt(i + 1);
      if (isAsciiLetter(c) || s[i + 1] === '/' || s[i + 1] === '!') {
        const end = nextGt(i + 1);
        if (end >= 0) {
          blank(plain, i, end + 1);
          blank(loose, i, end + 1);
          i = end + 1;
          continue;
        }
      }
    }
    if (ch === '"' || ch === QUOTE_OPEN) {
      const end = ch === '"' ? nextQuote(i + 1) : nextClose(i + 1);
      if (end > i + 1) {
        blank(plain, i, end + 1);
        quotes += 1;
        i = end + 1;
        continue;
      }
    }
    i += 1;
  }
  return { plain: plain.join(''), loose: loose.join(''), codeSpans, quotes };
}

// A phrase of a list, ready to be found: written in capitals only, it is found with case; otherwise without case for the
// letters A to Z. A phrase that starts or ends with a word character is found only where it starts or ends a word.
export function preparePhrase(phrase) {
  const p = phrase.trim().split(/\s+/).join(' ');
  const hasLower = p !== p.toUpperCase();
  const caseSensitive = !hasLower && p !== p.toLowerCase();
  return { phrase: p, needle: caseSensitive ? p : lowerAscii(p), caseSensitive, wordStart: isWordChar(p[0]), wordEnd: isWordChar(p[p.length - 1]) };
}

// Every place where a prepared phrase stands in a text: [{ phrase, from, to }], sorted by place. Where two phrases
// overlap, the one that starts first, and then the longer one, is kept.
export function findPhrases(text, prepared) {
  if (!text) return [];
  const lower = lowerAscii(text);
  const hits = [];
  for (const p of prepared) {
    const hay = p.caseSensitive ? text : lower;
    let at = hay.indexOf(p.needle);
    while (at >= 0) {
      const end = at + p.needle.length;
      const okStart = !p.wordStart || !isWordChar(text[at - 1]);
      const okEnd = !p.wordEnd || !isWordChar(text[end]);
      if (okStart && okEnd) hits.push({ phrase: p.phrase, from: at, to: end });
      at = hay.indexOf(p.needle, at + 1);
    }
  }
  hits.sort((a, b) => a.from - b.from || b.to - a.to);
  const kept = [];
  let reach = -1;
  for (const h of hits) {
    if (h.from >= reach) {
      kept.push(h);
      reach = h.to;
    }
  }
  return kept;
}

// True when a text has a letter or a digit outside the given spans: the test for a text that holds nothing but
// placeholders.
export function hasWordsOutside(text, spans) {
  let k = 0;
  const sorted = [...spans].sort((a, b) => a.from - b.from);
  for (let i = 0; i < text.length; i += 1) {
    while (k < sorted.length && sorted[k].to <= i) k += 1;
    if (k < sorted.length && sorted[k].from <= i && i < sorted[k].to) continue;
    const c = text.charCodeAt(i);
    if (c < 128 ? isAsciiLetter(c) || isDigit(c) : LETTER.test(text[i])) return true;
  }
  return false;
}

// A short piece of a line around a place, for a report: at most width characters, with "..." where it was cut.
export function excerpt(s, from, to, width = 90) {
  const t = s;
  if (t.length <= width) return t.trim();
  const room = Math.max(0, width - (to - from));
  let a = Math.max(0, from - Math.floor(room / 2));
  const b = Math.min(t.length, a + width);
  a = Math.max(0, b - width);
  return `${a > 0 ? '...' : ''}${t.slice(a, b).trim()}${b < t.length ? '...' : ''}`;
}
