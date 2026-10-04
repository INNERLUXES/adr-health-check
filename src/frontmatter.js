// The front matter of a record: a block of "key: value" lines between a first line "---" and a closing line "---" or
// "...", as the MADR template opens with ("status:", "date:", "decision-makers:"). Only flat keys with one value on
// their line are read; a nested value, a list or a value over several lines is left out. The lines of the front matter
// are blanked in the text the Markdown reader gets, with their line ends kept, so every line and column of the rest of
// the record stays the line and column of the file. Without a closing line within FRONT_MATTER_LIMITS.maxLines, the
// first line is not front matter and the text is read as it is.

export const FRONT_MATTER_LIMITS = { maxLines: 200 };

const KEY = /^([A-Za-z][A-Za-z0-9_-]{0,63})[ \t]*:(?:[ \t]+|$)/;

// The lines of a text with the offsets where each starts and where its content ends. A line ends at LF, CR LF or CR.
function linesWithEnds(text, max) {
  const out = [];
  let from = 0;
  for (let i = 0; i < text.length && out.length < max; i += 1) {
    const c = text.charCodeAt(i);
    if (c === 10 || c === 13) {
      out.push({ from, end: i });
      if (c === 13 && text.charCodeAt(i + 1) === 10) i += 1;
      from = i + 1;
    }
  }
  if (out.length < max && from < text.length) out.push({ from, end: text.length });
  return out;
}

const isFence = (line, marks) => marks.includes(line.replace(/[ \t]+$/, ''));

// One value as written after "key:": a quoted value without its quotes, or a plain value up to a comment.
function valueOf(raw) {
  const t = raw.trim();
  if (t.length >= 2 && (t[0] === '"' || t[0] === "'")) {
    const close = t.lastIndexOf(t[0]);
    if (close > 0) return t.slice(1, close);
  }
  const comment = t.search(/[ \t]#/);
  return (comment >= 0 ? t.slice(0, comment) : t).trim();
}

// Splits the front matter off a text. Returns { text, fields, lines }: text with the front matter lines blanked, fields
// a Map from the lower-case key to every { value, line, column } it was given, and lines the number of lines of the
// front matter, 0 when there is none.
export function splitFrontMatter(text, limits = FRONT_MATTER_LIMITS) {
  const fields = new Map();
  const lines = linesWithEnds(text, limits.maxLines + 2);
  if (!lines.length || !isFence(text.slice(lines[0].from, lines[0].end), ['---'])) return { text, fields, lines: 0 };
  let close = -1;
  for (let k = 1; k < lines.length && k <= limits.maxLines + 1; k += 1) {
    if (isFence(text.slice(lines[k].from, lines[k].end), ['---', '...'])) {
      close = k;
      break;
    }
  }
  if (close < 0) return { text, fields, lines: 0 };
  for (let k = 1; k < close; k += 1) {
    const line = text.slice(lines[k].from, lines[k].end);
    const m = KEY.exec(line);
    if (!m) continue;
    const raw = line.slice(m[0].length);
    if (raw.trim() === '') continue;
    const key = m[1].toLowerCase();
    const lead = raw.length - raw.trimStart().length;
    const quoted = raw.trimStart()[0] === '"' || raw.trimStart()[0] === "'";
    if (!fields.has(key)) fields.set(key, []);
    fields.get(key).push({ value: valueOf(raw), line: k + 1, column: m[0].length + lead + (quoted ? 2 : 1) });
  }
  let out = '';
  let at = 0;
  for (let k = 0; k <= close; k += 1) {
    out += text.slice(at, lines[k].from);
    at = lines[k].end;
  }
  return { text: out + text.slice(at), fields, lines: close + 1 };
}
