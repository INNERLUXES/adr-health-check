// Reading an architecture decision record written in Markdown: the block structure of a subset of CommonMark (ATX and setext headings,
// thematic breaks, indented and fenced code blocks, HTML comments, block quotes, bullet and ordered lists, paragraphs) and
// the tables of GitHub Flavored Markdown. The reader only finds where blocks start and end; it does not build HTML. Every
// block keeps its lines, and every piece of text keeps its line and the column where it starts in the file, so a finding
// can name both.
//
// The reader reads; it never runs. A link is text: no address in the document is opened. Work stays bounded: every line is
// looked at a fixed number of times on each level of nesting, and nesting stops at MARKDOWN_LIMITS.maxDepth, past which
// the rest of a container is read as plain text and a note says so. docs/method.md lists where the reader is simpler than
// CommonMark.

export const MARKDOWN_LIMITS = { maxDepth: 16, maxLines: 200000 };

// The lines of a text. A line ends at LF, CR LF or CR. A tab is expanded to the next multiple of four columns, as
// CommonMark reads tabs for the block structure; map keeps, for each column of the expanded line, the index of the
// character in the line as written, so a column in a report is the column in the file. last is the index of the last
// character that is not a space, or -1 for a blank line.
export function splitLines(text) {
  const lines = [];
  let from = 0;
  const push = (end) => {
    const raw = text.slice(from, end);
    let expanded = raw;
    let map = null;
    if (raw.includes('\t')) {
      const out = [];
      const cols = [];
      for (let i = 0; i < raw.length; i += 1) {
        if (raw[i] === '\t') {
          const width = 4 - (out.length % 4);
          for (let k = 0; k < width; k += 1) {
            out.push(' ');
            cols.push(i);
          }
        } else {
          out.push(raw[i]);
          cols.push(i);
        }
      }
      cols.push(raw.length);
      expanded = out.join('');
      map = cols;
    }
    let last = expanded.length - 1;
    while (last >= 0 && expanded.charCodeAt(last) === 32) last -= 1;
    lines.push({ no: lines.length + 1, text: expanded, map, last });
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c === 10 || c === 13) {
      push(i);
      if (c === 13 && text.charCodeAt(i + 1) === 10) i += 1;
      from = i + 1;
    }
  }
  if (from < text.length) push(text.length);
  return lines;
}

// The column (from 1) in the file of the character at index k of an expanded line.
export function columnOf(line, k) {
  if (!line.map) return k + 1;
  return line.map[Math.min(Math.max(k, 0), line.map.length - 1)] + 1;
}

// A view is the part of a line that is left inside a container: the line, the index where the view starts in the
// expanded line, and the text from there.
const viewOf = (line) => ({ line, start: 0, s: line.text });
const cut = (v, n) => {
  const k = Math.min(n, v.s.length);
  return { line: v.line, start: v.start + k, s: v.s.slice(k) };
};
const isBlank = (v) => v.line.last < v.start;

// The spaces at the start of a text, counted up to cap.
function indentOf(s, cap = 64) {
  let i = 0;
  while (i < cap && s.charCodeAt(i) === 32) i += 1;
  return i;
}

// An ATX heading: { level, from, to }, the content being s.slice(from, to), or null.
export function atxHeading(s) {
  const ind = indentOf(s, 4);
  if (ind > 3 || s[ind] !== '#') return null;
  let j = ind;
  while (s[j] === '#') j += 1;
  const level = j - ind;
  if (level > 6) return null;
  if (j < s.length && s[j] !== ' ') return null;
  let from = j;
  while (s[from] === ' ') from += 1;
  let to = s.length;
  while (to > from && s[to - 1] === ' ') to -= 1;
  let c = to;
  while (c > from && s[c - 1] === '#') c -= 1;
  if (c < to && (c === from || s[c - 1] === ' ')) {
    to = c;
    while (to > from && s[to - 1] === ' ') to -= 1;
  }
  return { level, from, to };
}

// The opening fence of a fenced code block: { char, length }, or null.
export function fenceOpening(s) {
  const ind = indentOf(s, 4);
  if (ind > 3) return null;
  const ch = s[ind];
  if (ch !== '`' && ch !== '~') return null;
  let j = ind;
  while (s[j] === ch) j += 1;
  if (j - ind < 3) return null;
  if (ch === '`' && s.includes('`', j)) return null;
  return { char: ch, length: j - ind };
}

// True when s closes a fence opened with fence.
export function fenceCloses(s, fence) {
  const ind = indentOf(s, 4);
  if (ind > 3) return false;
  let j = ind;
  while (s[j] === fence.char) j += 1;
  if (j - ind < fence.length) return false;
  while (s[j] === ' ') j += 1;
  return j === s.length;
}

// A thematic break: three or more of the same character *, - or _, with spaces between them allowed.
export function isThematicBreak(s) {
  const ind = indentOf(s, 4);
  if (ind > 3) return false;
  const ch = s[ind];
  if (ch !== '*' && ch !== '-' && ch !== '_') return false;
  let count = 0;
  for (let i = ind; i < s.length; i += 1) {
    if (s[i] === ch) count += 1;
    else if (s[i] !== ' ') return false;
  }
  return count >= 3;
}

// A setext heading underline: 1 for =, 2 for -, or 0.
export function setextLevel(s) {
  const ind = indentOf(s, 4);
  if (ind > 3) return 0;
  const ch = s[ind];
  if (ch !== '=' && ch !== '-') return 0;
  let j = ind;
  while (s[j] === ch) j += 1;
  while (s[j] === ' ') j += 1;
  if (j !== s.length) return 0;
  return ch === '=' ? 1 : 2;
}

// The index after a block quote marker (> and one optional space), or -1.
export function quoteMarkerEnd(s) {
  const ind = indentOf(s, 4);
  if (ind > 3 || s[ind] !== '>') return -1;
  return s[ind + 1] === ' ' ? ind + 2 : ind + 1;
}

// A list item marker: { ordered, mark, number, width, empty }, where width is where the content of the item starts, or
// null. Up to nine digits for an ordered item, as CommonMark allows.
export function listMarker(s) {
  const ind = indentOf(s, 4);
  if (ind > 3) return null;
  let j = ind;
  let ordered = false;
  let mark;
  let number = null;
  if (s[j] === '-' || s[j] === '+' || s[j] === '*') {
    mark = s[j];
    j += 1;
  } else {
    while (j < s.length && j - ind < 10 && s.charCodeAt(j) >= 48 && s.charCodeAt(j) <= 57) j += 1;
    const digits = j - ind;
    if (digits === 0 || digits > 9 || (s[j] !== '.' && s[j] !== ')')) return null;
    ordered = true;
    number = Number(s.slice(ind, j));
    mark = s[j];
    j += 1;
  }
  if (j < s.length && s[j] !== ' ') return null;
  const spaces = indentOf(s.slice(j, j + 6), 6);
  const empty = j + spaces >= s.length;
  const width = empty || spaces > 4 ? j + 1 : j + spaces;
  return { ordered, mark, number, width, empty };
}

const startsComment = (s) => {
  const ind = indentOf(s, 4);
  return ind <= 3 && s.startsWith('<!--', ind);
};

// True when a line starts a block that ends a paragraph: an ATX heading, a fence, a block quote, a thematic break, an
// HTML comment, or a list item that is not empty (an ordered one only when it starts at 1).
export function interruptsParagraph(s) {
  if (atxHeading(s) || fenceOpening(s) || quoteMarkerEnd(s) >= 0 || isThematicBreak(s) || startsComment(s)) return true;
  const m = listMarker(s);
  return Boolean(m && !m.empty && (!m.ordered || m.number === 1));
}

// The cells of a table row: [{ from, to }] as indexes in s, split at each pipe that is not escaped with a backslash.
// A leading and a trailing pipe are left out.
export function tableCells(s) {
  let from = indentOf(s, s.length);
  let to = s.length;
  while (to > from && s[to - 1] === ' ') to -= 1;
  if (s[from] === '|') from += 1;
  if (to > from && s[to - 1] === '|' && s[to - 2] !== '\\') to -= 1;
  const cells = [];
  let start = from;
  for (let i = from; i < to; i += 1) {
    if (s[i] === '\\') i += 1;
    else if (s[i] === '|') {
      cells.push({ from: start, to: i });
      start = i + 1;
    }
  }
  cells.push({ from: start, to });
  return cells;
}

// True when s is the delimiter row of a table with this many cells.
function isDelimiterRow(s, count) {
  if (!s.includes('|')) return false;
  const cells = tableCells(s);
  if (cells.length !== count) return false;
  return cells.every(({ from, to }) => {
    const t = s.slice(from, to).trim();
    if (t === '') return false;
    let a = 0;
    let b = t.length;
    if (t[a] === ':') a += 1;
    if (b > a && t[b - 1] === ':') b -= 1;
    if (b <= a) return false;
    for (let i = a; i < b; i += 1) if (t[i] !== '-') return false;
    return true;
  });
}

// A segment is a piece of text with its place: the line, the index where it starts in the expanded line, and the text.
// Leading and trailing spaces are left out.
function segment(line, start, s) {
  let a = 0;
  let b = s.length;
  while (a < b && s.charCodeAt(a) === 32) a += 1;
  while (b > a && s.charCodeAt(b - 1) === 32) b -= 1;
  return { line, start: start + a, s: s.slice(a, b) };
}

const sameList = (a, b) => a.ordered === b.ordered && a.mark === b.mark;

// Reads the blocks of a run of views at a level of nesting. ctx collects what the whole document needs to know: the
// fences that are not closed, and whether nesting went past the limit.
function readBlocks(vs, depth, ctx) {
  const blocks = [];
  const nested = (inner) => {
    if (depth + 1 >= ctx.maxDepth) {
      ctx.tooDeep = ctx.tooDeep ?? inner.find((v) => !isBlank(v))?.line.no ?? null;
      const segments = inner.filter((v) => !isBlank(v)).map((v) => segment(v.line, v.start, v.s));
      return segments.length ? [{ type: 'paragraph', segments, deep: true }] : [];
    }
    return readBlocks(inner, depth + 1, ctx);
  };
  let i = 0;
  while (i < vs.length) {
    const v = vs[i];
    const s = v.s;
    if (isBlank(v)) {
      i += 1;
      continue;
    }
    if (indentOf(s, 4) >= 4) {
      let end = i;
      let j = i + 1;
      while (j < vs.length && (isBlank(vs[j]) || indentOf(vs[j].s, 4) >= 4)) {
        if (!isBlank(vs[j])) end = j;
        j += 1;
      }
      blocks.push({ type: 'code', kind: 'indented', line: v.line.no, lines: end - i + 1 });
      i = end + 1;
      continue;
    }
    const fence = fenceOpening(s);
    if (fence) {
      let j = i + 1;
      while (j < vs.length && !fenceCloses(vs[j].s, fence)) j += 1;
      if (j >= vs.length) ctx.unclosed.push(v.line.no);
      blocks.push({ type: 'code', kind: 'fenced', line: v.line.no, lines: Math.min(j, vs.length - 1) - i + 1, closed: j < vs.length });
      i = j + 1;
      continue;
    }
    const atx = atxHeading(s);
    if (atx) {
      blocks.push({ type: 'heading', level: atx.level, setext: false, line: v.line.no, segments: [segment(v.line, v.start + atx.from, s.slice(atx.from, atx.to))] });
      i += 1;
      continue;
    }
    if (startsComment(s)) {
      let j = i;
      let at = s.indexOf('<!--') + 4;
      while (j < vs.length && !vs[j].s.includes('-->', at)) {
        j += 1;
        at = 0;
      }
      blocks.push({ type: 'html', line: v.line.no });
      i = j + 1;
      continue;
    }
    if (isThematicBreak(s)) {
      blocks.push({ type: 'break', line: v.line.no });
      i += 1;
      continue;
    }
    if (quoteMarkerEnd(s) >= 0) {
      const inner = [];
      let j = i;
      while (j < vs.length) {
        const q = quoteMarkerEnd(vs[j].s);
        if (q >= 0) inner.push(cut(vs[j], q));
        // A lazy line: it continues the text of the quote without a marker.
        else if (!isBlank(vs[j]) && inner.length && !isBlank(inner[inner.length - 1]) && !interruptsParagraph(vs[j].s) && setextLevel(vs[j].s) === 0) inner.push(vs[j]);
        else break;
        j += 1;
      }
      blocks.push({ type: 'quote', line: v.line.no, children: nested(inner) });
      i = j;
      continue;
    }
    const first = listMarker(s);
    if (first) {
      const items = [];
      let j = i;
      while (j < vs.length) {
        const m = listMarker(vs[j].s);
        if (!m || !sameList(m, first) || isThematicBreak(vs[j].s)) break;
        const inner = [cut(vs[j], m.empty ? vs[j].s.length : m.width)];
        let last = j;
        let k = j + 1;
        while (k < vs.length) {
          const t = vs[k];
          if (isBlank(t)) {
            if (m.empty && k === j + 1) break;
            inner.push(cut(t, m.width));
          } else if (indentOf(t.s, m.width) >= m.width) {
            inner.push(cut(t, m.width));
            last = k;
          } else if (!isBlank(vs[k - 1]) && !interruptsParagraph(t.s) && !listMarker(t.s) && setextLevel(t.s) === 0 && !m.empty) {
            // A lazy line continues the paragraph of the item.
            inner.push(cut(t, indentOf(t.s)));
            last = k;
          } else break;
          k += 1;
        }
        inner.length = last - j + 1;
        items.push({ line: vs[j].line.no, children: nested(inner) });
        j = last + 1;
        let b = j;
        while (b < vs.length && isBlank(vs[b])) b += 1;
        const next = b < vs.length ? listMarker(vs[b].s) : null;
        if (next && sameList(next, first) && !isThematicBreak(vs[b].s)) j = b;
        else break;
      }
      blocks.push({ type: 'list', ordered: first.ordered, line: v.line.no, items });
      i = j;
      continue;
    }
    if (s.includes('|') && i + 1 < vs.length) {
      const header = tableCells(s);
      if (isDelimiterRow(vs[i + 1].s, header.length)) {
        const rows = [header.map((c) => segment(v.line, v.start + c.from, s.slice(c.from, c.to)))];
        let j = i + 2;
        while (j < vs.length && !isBlank(vs[j]) && !interruptsParagraph(vs[j].s)) {
          const r = vs[j];
          rows.push(tableCells(r.s).map((c) => segment(r.line, r.start + c.from, r.s.slice(c.from, c.to))));
          j += 1;
        }
        blocks.push({ type: 'table', line: v.line.no, rows });
        i = j;
        continue;
      }
    }
    const lines = [v];
    let j = i + 1;
    let level = 0;
    while (j < vs.length) {
      const t = vs[j];
      if (isBlank(t)) break;
      level = setextLevel(t.s);
      if (level) {
        j += 1;
        break;
      }
      if (interruptsParagraph(t.s)) break;
      lines.push(t);
      j += 1;
    }
    const segments = lines.map((x) => segment(x.line, x.start, x.s));
    if (level) blocks.push({ type: 'heading', level, setext: true, line: v.line.no, segments });
    else blocks.push({ type: 'paragraph', line: v.line.no, segments });
    i = j;
  }
  return blocks;
}

// The text of a heading or a paragraph: its segments joined with one space.
export const textOf = (segments) => segments.map((g) => g.s).join(' ').trim();

// Reads a whole document. Returns { lines, blocks, headings, units, counts, unclosed, tooDeep }:
// - headings: the headings that are not inside a list or a block quote, in order, with their level, text, line and
//   column; these are the headings that make the sections;
// - units: every piece of the document in order, each with the index of the heading it is under (-1 before the first):
//   heading (the text of a heading), paragraph, item (the text of a list item; leaf is true for an item with no list
//   inside it), row (a table row, one segment for each cell), and code, html and quote, which count as text of a
//   section but are never read for words;
// - counts of headings, tables, code blocks, lists and block quotes.
export function readMarkdown(text, limits = MARKDOWN_LIMITS) {
  const lim = { ...MARKDOWN_LIMITS, ...limits };
  const lines = splitLines(text);
  if (lines.length > lim.maxLines) throw new Error(`more than ${lim.maxLines.toLocaleString('en-US')} lines`);
  const ctx = { unclosed: [], tooDeep: null, maxDepth: lim.maxDepth };
  const blocks = readBlocks(lines.map(viewOf), 0, ctx);
  const headings = [];
  const units = [];
  const counts = { headings: 0, tables: 0, codeBlocks: 0, lists: 0, quotes: 0 };
  let current = -1;
  let quoted = false;
  const add = (unit) => units.push({ ...unit, heading: current, quoted });
  const walk = (list, inside) => {
    for (const b of list) {
      if (b.type === 'heading') {
        if (inside) {
          add({ kind: 'paragraph', line: b.line, segments: b.segments });
          continue;
        }
        const first = b.segments[0];
        headings.push({ index: headings.length, level: b.level, setext: b.setext, text: textOf(b.segments), line: b.line, column: first ? columnOf(first.line, first.start) : 1 });
        current = headings.length - 1;
        add({ kind: 'heading', line: b.line, segments: b.segments });
      } else if (b.type === 'paragraph') add({ kind: 'paragraph', line: b.line, segments: b.segments });
      else if (b.type === 'table') {
        counts.tables += 1;
        b.rows.forEach((cells, r) => add({ kind: 'row', line: cells[0]?.line.no ?? b.line, header: r === 0, segments: cells.filter((c) => c.s !== '') }));
      } else if (b.type === 'code') {
        counts.codeBlocks += 1;
        add({ kind: 'code', line: b.line, segments: [] });
      } else if (b.type === 'html') add({ kind: 'html', line: b.line, segments: [] });
      else if (b.type === 'quote') {
        counts.quotes += 1;
        add({ kind: 'quote', line: b.line, segments: [] });
        // The text of a block quote is kept as units marked quoted: its links are checked, its words are not read.
        const outer = quoted;
        quoted = true;
        walk(b.children, true);
        quoted = outer;
      } else if (b.type === 'list') {
        counts.lists += 1;
        for (const item of b.items) {
          const own = item.children.filter((c) => c.type === 'paragraph' || c.type === 'heading');
          const leaf = !item.children.some((c) => c.type === 'list');
          add({ kind: 'item', line: item.line, leaf, ordered: b.ordered, segments: own.flatMap((c) => c.segments) });
          walk(item.children.filter((c) => c.type !== 'paragraph' && c.type !== 'heading'), true);
        }
      }
    }
  };
  walk(blocks, false);
  counts.headings = headings.length;
  return { lines: lines.length, blocks, headings, units, counts, unclosed: ctx.unclosed, tooDeep: ctx.tooDeep };
}
