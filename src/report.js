// The three reports: text for a terminal, Markdown for a ticket or a pull request, and JSON for other tools. Every text
// from a record (a title, a heading, a piece of a line) was cleaned by safeText before it reached the report. The
// Markdown report also escapes each cell, so a title cannot break a table, make a link or be read as HTML, and a cell
// that starts with =, +, -, @, a tab or a carriage return gets a leading apostrophe, so a spreadsheet that the table is
// pasted into does not read it as a formula.

import { grouped, plural } from './size.js';

const FORMULA_START = new Set(['=', '+', '-', '@', '\t', '\r']);

// A cell that a spreadsheet would read as a formula, with a leading apostrophe.
export function guardFormula(t) {
  const s = String(t);
  return s.length && FORMULA_START.has(s[0]) ? `'${s}` : s;
}

export function mdCell(t) {
  return guardFormula(String(t))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[[\]`*_]/g, (c) => `\\${c}`)
    .replace(/\r?\n|\r/g, ' ');
}

function folderLine(r) {
  const f = r.folder;
  return `${f.path} (${plural(f.records, 'record')}, ${plural(f.otherFiles, 'other file')}, ${plural(f.subfolders, 'subfolder')}, ${plural(f.symbolicLinks, 'symbolic link')})`;
}

function configLine(r) {
  const c = r.config;
  const where = c.file ? `${c.file}${c.name ? ` (${c.name})` : ''}` : 'built-in defaults';
  const layouts = c.layouts.filter((l) => l.sections > 0).map((l) => `${l.title} (${plural(l.sections, 'section')}${l.requireStatus ? ', status required' : ''})`).join(', ');
  return `${where}: layouts ${layouts}${c.layout === 'detect' ? ', detected per record' : `, every record read as ${c.layout}`}; statuses ${c.statuses.join(', ')}; file names ${c.fileName}`;
}

function rulesLine(r) {
  return r.config.rules.map((x) => (x.id === 'missing-section' ? `${x.id} (required ${x.required}, recommended ${x.recommended})` : `${x.id} (${x.level})`)).join('; ');
}

function recordsLine(r) {
  const t = r.totals;
  const layouts = Object.entries(t.byLayout).filter(([k, n]) => n && k !== 'none').map(([k, n]) => `${grouped(n)} ${r.config.layouts.find((l) => l.id === k).title}`);
  if (t.byLayout.none) layouts.push(`${grouped(t.byLayout.none)} with no layout`);
  const statuses = Object.entries(t.byStatus).filter(([, n]) => n).map(([k, n]) => `${grouped(n)} ${k === 'none' ? 'with no status' : k === 'other' ? 'with another status' : k}`);
  return `${grouped(t.records)}${layouts.length ? `: ${layouts.join(', ')}` : ''}${statuses.length ? `; ${statuses.join(', ')}` : ''}`;
}

function linksLine(r) {
  const l = r.totals.links;
  return `${grouped(l.checked)} relative ${l.checked === 1 ? 'link' : 'links'} to the folder checked, ${grouped(l.broken)} broken; ${grouped(l.notFollowed)} leaving the folder not followed; ${grouped(l.web)} web ${l.web === 1 ? 'address' : 'addresses'} not fetched`;
}

function findingsLine(r) {
  const b = r.verdict.byLevel;
  const parts = ['error', 'warning', 'notice'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.findings.length)}${parts.length ? ` (${parts.join(', ')})` : ''}; fail level ${r.verdict.failOn}`;
}

const basisText = (b) => `"${b.text}" (${b.section}, ${b.page})`;
const statusText = (s) => (s ? s.word || '(no word)' : '-');
const sectionsText = (rec) => (rec.layout ? rec.sections.filter((s) => s.status === 'empty' || (s.status === 'missing' && s.level !== 'optional')).map((s) => `${s.title} ${s.status}`).join('; ') || 'none' : '-');

// Pads the columns of a table of text to their widths.
function table(rows, indent = '  ') {
  const widths = rows[0].map((_, i) => Math.min(60, Math.max(...rows.map((row) => String(row[i]).length))));
  return rows.map((row) => `${indent}${row.map((cell, i) => (i === row.length - 1 ? String(cell) : String(cell).padEnd(widths[i]))).join('  ')}`.trimEnd());
}

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`adr-health-check: ${r.folder.path}`);
  out.push(`folder: ${folderLine(r)}`);
  out.push(`config: ${configLine(r)}`);
  out.push(`rules: ${rulesLine(r)}`);
  out.push(`records: ${recordsLine(r)}`);
  out.push(`links: ${linksLine(r)}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const pad = ' '.repeat(11);
  for (const f of r.findings) {
    out.push(`  ${f.level.toUpperCase().padEnd(8)} ${f.rule.padEnd(16)}  ${f.at}`);
    out.push(`${pad}${f.found}`);
    if (explain) {
      out.push(`${pad}rule: ${r.config.rules.find((x) => x.id === f.rule).rule}`);
      for (const w of f.why) out.push(`${pad}why: ${w}`);
      for (const b of f.basis) out.push(`${pad}basis: ${basisText(b)}`);
      if (f.own) out.push(`${pad}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  out.push(`Records (${grouped(r.records.length)})`, '');
  if (r.records.length) {
    const rows = [['number', 'file', 'layout', 'status', 'sections missing or empty'], ...r.records.map((rec) => [rec.number === null ? '-' : String(rec.number), rec.file.split('/').at(-1), rec.layout ?? '-', statusText(rec.status), sectionsText(rec)])];
    out.push(...table(rows));
  } else out.push('  none');
  out.push('');
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.verdict.text}`);
  return `${out.join('\n')}\n`;
}

export function toMarkdown(r, { explain = false } = {}) {
  const lines = [`## adr-health-check: ${r.verdict.text}`, ''];
  lines.push(`- Folder: ${mdCell(folderLine(r))}`);
  lines.push(`- Config: ${mdCell(configLine(r))}`);
  lines.push(`- Rules: ${mdCell(rulesLine(r))}`);
  lines.push(`- Records: ${mdCell(recordsLine(r))}`);
  lines.push(`- Links: ${mdCell(linksLine(r))}`);
  lines.push(`- Findings: ${mdCell(findingsLine(r))}`);
  lines.push('', '### Findings', '');
  if (r.findings.length) {
    lines.push('| Level | Rule | Found | Where |', '| --- | --- | --- | --- |');
    for (const f of r.findings) lines.push(`| ${f.level === 'error' ? '**error**' : f.level} | ${f.rule} | ${mdCell(f.found)} | ${mdCell(f.at)} |`);
  } else lines.push('None.');
  if (explain) {
    for (const f of r.findings) {
      lines.push('', `#### ${f.rule}: ${mdCell(f.at)}`, '');
      lines.push(`- Rule: ${mdCell(r.config.rules.find((x) => x.id === f.rule).rule)}`);
      for (const w of f.why) lines.push(`- Why: ${mdCell(w)}`);
      for (const b of f.basis) lines.push(`- Basis: ${mdCell(basisText(b))}`);
      if (f.own) lines.push(`- The tool's own choice: ${mdCell(f.own)}`);
    }
  }
  lines.push('', '### Records', '');
  if (r.records.length) {
    lines.push('| Number | File | Layout | Status | Sections missing or empty |', '| --- | --- | --- | --- | --- |');
    for (const rec of r.records) lines.push(`| ${rec.number ?? '-'} | ${mdCell(rec.file)} | ${rec.layout ?? '-'} | ${mdCell(statusText(rec.status))} | ${mdCell(sectionsText(rec))} |`);
  } else lines.push('None.');
  if (r.notes.length) {
    lines.push('', '### Notes', '');
    for (const n of r.notes) lines.push(`- ${mdCell(n)}`);
  }
  lines.push('', mdCell(r.notice));
  return `${lines.join('\n')}\n`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, why: undefined, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}
