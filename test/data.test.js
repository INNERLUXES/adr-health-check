import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DEFAULT_LAYOUTS, FACTS, LEVELS, NOTICE, RULES, SECTION_LEVELS, SOURCES, factPage, flat, pageOf, source } from '../src/index.js';

// These tests read the saved pages again and compare them with src/data.js: every sentence that a rule, a section of a
// layout or a document quotes.

const text = async (id) => readFile(new URL(`../research/sources/${source(id).file}`, import.meta.url), 'utf8');
const has = (page, needle) => flat(page).includes(flat(needle));
// The words of a tool that wrote a text, built from pieces so that this file does not hold them.
const WRITTEN = new RegExp(`\\b(?:${['A', 'I'].join('')}|${['cha', 't'].join('')}|${['gene', 'rated'].join('')}|${['assis', 'tants?'].join('')}|${['g', 'pt'].join('')}|${['l', 'lms?'].join('')})\\b|${['clau', 'de'].join('')}|${['anthro', 'pic'].join('')}|${['ses', 'sion'].join('')}`, 'i');
const YEAR = /\b(?:19|20)\d{2}\b/;
const DOCS = ['docs/method.md', 'docs/rules-and-sources.md', 'docs/inputs.md', 'docs/limits.md', 'docs/threat-model.md', 'docs/secure-defaults.md', 'docs/decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md', 'docs/decisions/0002-never-follow-a-link-out-of-the-folder.md', 'README.md'];

test('sources: every saved page says on its first line where it comes from, as listed in src/data.js, and holds text', async () => {
  for (const s of SOURCES) {
    const page = await text(s.id);
    assert.equal(page.split('\n')[0].startsWith(`Source: ${pageOf(s.id)}`), true, s.file);
    if (s.url) {
      assert.equal(page.split('\n')[0], `Source: ${s.url}`, s.file);
      assert.match(s.url, /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9/._?=:#-]*$/);
    } else {
      assert.ok(s.ref.includes(s.host), `${s.id}: the reference names the host`);
      assert.doesNotMatch(s.ref, /https?:/, `${s.id}: no address`);
    }
    assert.ok(page.length > 1000, `${s.file} holds the page text`);
    assert.ok(s.label.length > 10, s.id);
  }
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => pageOf(s.id))).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.file)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.id)).size);
});

test('sources: every file in research/sources is listed in src/data.js, and the other way round', async () => {
  const files = (await readdir(new URL('../research/sources/', import.meta.url))).sort();
  assert.deepEqual(files, SOURCES.map((s) => s.file).sort());
});

test('sources: the post of Michael Nygard by title and host, MADR, the adr organization, CommonMark and the RFC Editor', () => {
  const hosts = SOURCES.map((s) => (s.url ? new URL(s.url).host : s.host));
  assert.deepEqual([...new Set(hosts)].sort(), ['adr.github.io', 'raw.githubusercontent.com', 'spec.commonmark.org', 'www.cognitect.com', 'www.rfc-editor.org']);
  assert.equal(source('nygard').url, null, 'the address of the post holds a date, so it is not kept');
});

test('sources: no saved page holds a year, a mention of a tool that wrote it, a control byte, a carriage return or a character that is not ASCII', async () => {
  for (const s of SOURCES) {
    const page = await text(s.id);
    assert.doesNotMatch(page, YEAR, s.file);
    assert.doesNotMatch(page, WRITTEN, s.file);
    assert.doesNotMatch(page, new RegExp(`[${String.fromCharCode(1)}-${String.fromCharCode(8)}]`), s.file);
    assert.ok(!page.includes('\r'), s.file);
    assert.ok([...page].every((c) => c.charCodeAt(0) < 128), s.file);
    assert.ok(page.endsWith('\n'), s.file);
  }
});

test('the saved pages hold what the tool reads: the parts of Nygard\'s format, the MADR headings and file names, and the definition of an ADR', async () => {
  const ny = await text('nygard');
  for (const s of ['Title These documents', 'Context This section', 'Decision This section', 'Status A decision', 'Consequences This section', 'Numbers will not\nbe reused.', '[...]']) assert.ok(ny.includes(s), s);
  const tpl = await text('madrTemplate');
  for (const s of ['## Context and Problem Statement', '## Decision Drivers', '## Considered Options', '## Decision Outcome', '### Consequences', '### Confirmation', '## Pros and Cons of the Options', '## More Information', 'status:']) assert.ok(tpl.includes(s), s);
  const about = await text('madr');
  for (const s of ['NNNN-title-with-dashes.md', 'dashes and lowercase', '[...]']) assert.ok(about.includes(s), s);
  assert.ok((await text('adrHome')).includes('decision log'));
  const links = await text('commonmarkLinks');
  for (const s of ['6.3 Links', '4.7 Link reference definitions']) assert.ok(links.includes(s), s);
});

test('facts: every quoted sentence is on its saved page, word for word, with its section, no year and no mention of a tool that wrote it', async () => {
  for (const [key, fact] of Object.entries(FACTS)) {
    assert.ok(SOURCES.some((s) => s.id === fact.source), key);
    const page = await text(fact.source);
    assert.ok(has(page, fact.text), `${key}: "${fact.text}"`);
    assert.ok(has(page, fact.section), `${key}: the section ${fact.section} is on the page`);
    assert.doesNotMatch(fact.text, YEAR, key);
    assert.doesNotMatch(fact.text, WRITTEN, key);
    assert.ok(fact.text.length <= 360, `${key} is short`);
    assert.equal(factPage(key), pageOf(fact.source));
  }
});

test('facts: every rule and every default layout and section rests on sentences of src/data.js, and every page is quoted', () => {
  for (const r of RULES) for (const k of r.facts) assert.ok(FACTS[k], `${r.id}: ${k}`);
  for (const l of DEFAULT_LAYOUTS) {
    assert.ok(l.basis.length, l.id);
    for (const k of l.basis) assert.ok(FACTS[k], `${l.id}: ${k}`);
    for (const s of l.sections) {
      assert.ok(s.basis.length, `${l.id}.${s.id}`);
      for (const k of s.basis) assert.ok(FACTS[k], `${l.id}.${s.id}: ${k}`);
      assert.ok(SECTION_LEVELS.includes(s.level), s.id);
    }
  }
  const quoted = new Set(Object.values(FACTS).map((f) => f.source));
  for (const s of SOURCES) assert.ok(quoted.has(s.id), s.id);
});

test('lists: the levels of a finding and of a section, and the notice of every report', () => {
  assert.deepEqual(LEVELS, ['notice', 'warning', 'error']);
  assert.deepEqual(SECTION_LEVELS, ['required', 'recommended', 'optional', 'off']);
  assert.match(NOTICE, /It does not judge whether a decision is right\.$/);
});

test('src writes no quoted sentence outside src/data.js', async () => {
  for (const file of (await readdir(new URL('../src/', import.meta.url))).filter((f) => f !== 'data.js')) {
    const code = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const fact of Object.values(FACTS)) if (fact.text.length > 40) assert.ok(!code.includes(fact.text.slice(0, 40)), `${file} writes "${fact.text.slice(0, 40)}" itself`);
  }
});

test('docs: every sentence that the documents quote from a saved page is on a saved page', async () => {
  const pages = (await Promise.all(SOURCES.map((s) => text(s.id)))).map(flat).join(' ');
  let checked = 0;
  for (const file of DOCS) {
    const doc = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    // Code blocks and inline code hold file contents and reports, not quotes.
    const prose = doc.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const m of prose.matchAll(/"([^"\n]{30,400})"/g)) {
      assert.ok(pages.includes(flat(m[1])), `${file}: ${m[1]}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 12, `${checked} quotes checked`);
});

test('docs: docs/rules-and-sources.md names every saved page, every quoted sentence, every rule and every section of the default layouts', async () => {
  const doc = await readFile(new URL('../docs/rules-and-sources.md', import.meta.url), 'utf8');
  for (const s of SOURCES) {
    assert.ok(doc.includes(s.file), s.file);
    assert.ok(doc.includes(pageOf(s.id)), pageOf(s.id));
  }
  for (const [key, fact] of Object.entries(FACTS)) assert.ok(doc.includes(`| \`${key}\` |`) && doc.includes(flat(fact.text).replace(/\|/g, '\\|')), key);
  for (const r of RULES) {
    assert.ok(doc.includes(`| \`${r.id}\` | \`rules.${r.key}\` |`), r.id);
    assert.ok(doc.includes(`(method.md#${r.id})`), r.id);
    for (const k of r.facts) assert.ok(new RegExp(`\\| \`${k}\` \\| [^|]*\`${r.id}\``).test(doc), `${k} is used by ${r.id}`);
  }
  for (const l of DEFAULT_LAYOUTS) {
    for (const s of l.sections) {
      const row = doc.split('\n').find((line) => line.startsWith(`| \`${l.id}.${s.id}\` |`));
      assert.ok(row, `the row of ${l.id}.${s.id}`);
      for (const k of s.basis) assert.ok(row.includes(`\`${k}\``), `${l.id}.${s.id}: ${k}`);
    }
  }
  assert.match(doc, /title and (?:its )?host/);
});
