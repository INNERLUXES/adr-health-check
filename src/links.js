// Finding the links of a record and deciding what each one points at. A link is text: nothing is opened, fetched or
// looked up on the disk here. A relative link is resolved against the names of the folder that were listed once, in
// src/check.js; a link that leaves the folder, to a parent folder, a subfolder or an absolute path, is never followed.
//
// Inline links and images ([text](destination), ![alt](destination)) and link reference definitions ([label]:
// destination) are found within one line, outside code spans. Where the reader is simpler than CommonMark: a destination
// ends at the first ")" or the first space, so a destination with parentheses inside it is cut at the first ")", and a
// link whose text or destination runs over two lines is not found. Every search runs once over the line: the next ")",
// ">" and space are found with positions that only move forward.

export const LINK_LIMITS = { maxDestination: 4000 };

// The next index at or after from where ch stands, remembered so that a search never goes back.
function finder(s, test) {
  let at = -2;
  return (from) => {
    if (at === -1) return -1;
    if (at < from) {
      at = -1;
      for (let i = from; i < s.length; i += 1) {
        if (test(s.charCodeAt(i))) {
          at = i;
          break;
        }
      }
    }
    return at;
  };
}

// The line with its code spans replaced by spaces, so every other character keeps its place.
export function maskCode(s) {
  const out = s.split('');
  const runs = new Map();
  for (let i = 0; i < s.length;) {
    if (s[i] === '`') {
      let j = i;
      while (s[j] === '`') j += 1;
      if (!runs.has(j - i)) runs.set(j - i, { at: [], next: 0 });
      runs.get(j - i).at.push(i);
      i = j;
    } else i += 1;
  }
  for (let i = 0; i < s.length;) {
    if (s[i] === '\\') {
      i += 2;
      continue;
    }
    if (s[i] !== '`') {
      i += 1;
      continue;
    }
    let j = i;
    while (s[j] === '`') j += 1;
    const run = runs.get(j - i);
    while (run.next < run.at.length && run.at[run.next] <= i) run.next += 1;
    if (run.next < run.at.length) {
      const end = run.at[run.next] + (j - i);
      for (let k = i; k < end; k += 1) out[k] = ' ';
      i = end;
    } else i = j;
  }
  return out.join('');
}

const DEFINITION = /^ {0,3}\[([^\]\\]|\\.){1,999}\]:[ \t]*/;
const isSpace = (c) => c === 32 || c === 9 || c < 32;

// Every link of one line of text: [{ destination, from, to, kind }], from and to being the place of the destination in
// the line; kind is "link" or "definition".
export function findLinks(s, limits = LINK_LIMITS) {
  const m = maskCode(s);
  const links = [];
  const def = DEFINITION.exec(m);
  if (def) {
    let from = def[0].length;
    let to = from;
    if (m[from] === '<') {
      const close = m.indexOf('>', from + 1);
      if (close > from) {
        links.push({ destination: s.slice(from + 1, close), from: from + 1, to: close, kind: 'definition' });
        return links;
      }
    }
    while (to < m.length && !isSpace(m.charCodeAt(to))) to += 1;
    if (to > from && to - from <= limits.maxDestination) links.push({ destination: s.slice(from, to), from, to, kind: 'definition' });
    return links;
  }
  const nextParen = finder(m, (c) => c === 41);
  const nextSpace = finder(m, isSpace);
  const nextGt = finder(m, (c) => c === 62);
  for (let i = 0; i + 1 < m.length; i += 1) {
    if (m[i] !== ']' || m[i + 1] !== '(' || (i > 0 && m[i - 1] === '\\')) continue;
    let from = i + 2;
    while (from < m.length && (m[from] === ' ' || m[from] === '\t')) from += 1;
    if (m[from] === '<') {
      const close = nextGt(from + 1);
      if (close < 0) continue;
      const after = nextParen(close + 1);
      if (after < 0) continue;
      links.push({ destination: s.slice(from + 1, close), from: from + 1, to: close, kind: 'link' });
      i = close;
      continue;
    }
    const paren = nextParen(from);
    if (paren < 0) continue;
    const space = nextSpace(from);
    const to = space >= 0 && space < paren ? space : paren;
    if (to - from > limits.maxDestination) continue;
    links.push({ destination: s.slice(from, to), from, to, kind: 'link' });
    i = to - 1;
  }
  return links;
}

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]{1,31}:/;
const DRIVE = /^[A-Za-z]:[\\/]/;
const ESCAPED = /\\([!-/:-@[-`{-~])/g;

// What a destination points at: { kind, target, anchor }.
// - web: an address with a scheme (https:, mailto:, file:) or starting with //; never fetched;
// - anchor: a place in the same record (#...); not checked;
// - absolute: a path from the root of a disk or a site (/..., C:\...); not followed;
// - outside: a relative path that leaves the folder through ..; not followed;
// - subfolder: a relative path into a folder below this one; not followed;
// - folder: the folder itself (./); not followed;
// - file: a name in this folder, target; the part after # is anchor, not checked;
// - empty: no destination.
// Backslash escapes and percent escapes are read before the path is resolved, and a backslash counts as a separator, so
// ..%2F and ..\ leave the folder too.
export function classifyLink(destination) {
  const d = String(destination).trim();
  if (d === '') return { kind: 'empty', target: null, anchor: null };
  if (DRIVE.test(d)) return { kind: 'absolute', target: d, anchor: null };
  if (SCHEME.test(d) || d.startsWith('//')) return { kind: 'web', target: d, anchor: null };
  if (d[0] === '#') return { kind: 'anchor', target: null, anchor: d.slice(1) };
  const hash = d.indexOf('#');
  let path = hash >= 0 ? d.slice(0, hash) : d;
  const anchor = hash >= 0 ? d.slice(hash + 1) : null;
  const query = path.indexOf('?');
  if (query >= 0) path = path.slice(0, query);
  path = path.replace(ESCAPED, '$1');
  try {
    path = decodeURIComponent(path);
  } catch {
    // A percent sign that starts no escape stays as it is written.
  }
  if (path === '') return { kind: 'anchor', target: null, anchor };
  if (path[0] === '/' || path[0] === '\\' || DRIVE.test(path)) return { kind: 'absolute', target: path, anchor };
  const stack = [];
  for (const part of path.split(/[\\/]/)) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (!stack.length) return { kind: 'outside', target: path, anchor };
      stack.pop();
    } else stack.push(part);
  }
  if (!stack.length) return { kind: 'folder', target: path, anchor };
  if (stack.length > 1) return { kind: 'subfolder', target: stack.join('/'), anchor };
  return { kind: 'file', target: stack[0], anchor };
}

// The numbers a text names in the form "ADR-0005", "ADR 5" or "ADR5", in order.
const ADR_REFERENCE = /\badr[\s-]?0*(\d{1,9})\b/gi;
export function adrNumbers(text) {
  return [...String(text).matchAll(ADR_REFERENCE)].map((m) => Number(m[1]));
}
