// The configuration: the layouts with their sections, aliases and levels, the status words and the headings of the
// status section, the placeholders, the spec of a file name, the files that are not records, the levels of the rules and
// the fail level. Without a configuration file the defaults of src/defaults.js apply; a file changes them entry by entry
// (docs/inputs.md). Every key the tool does not know is an error, so a typo such as "aliasses" cannot silently leave the
// default in place, and an entry of a list that is removed but was never there is an error too. The file is read with
// the strict JSON reader of src/json.js, which refuses an object that names a key twice.

import { JsonError, jsonProblem, parseJson } from './json.js';
import { LEVELS, SECTION_LEVELS } from './data.js';
import { DEFAULT_FAIL_ON, DEFAULT_FILE_NAME, DEFAULT_IGNORE_FILES, DEFAULT_LAYOUTS, DEFAULT_PLACEHOLDERS, DEFAULT_RULES, DEFAULT_STATUS_HEADINGS, DEFAULT_STATUSES, DEFAULT_TEMPLATE_BRACES } from './defaults.js';
import { normalizeHeading } from './sections.js';
import { safeText } from './text.js';

export const CONFIG_LIMITS = { maxLayouts: 20, maxSections: 100, maxAliases: 50, maxPhrases: 500, maxString: 120, maxAfter: 100000 };

// The lists of the configuration, by their key, with their defaults and the kind of their entries.
export const LISTS = {
  statusHeadings: { defaults: DEFAULT_STATUS_HEADINGS, entry: 'phrase' },
  statuses: { defaults: DEFAULT_STATUSES, entry: 'statusWord' },
  placeholders: { defaults: DEFAULT_PLACEHOLDERS, entry: 'phrase' },
  ignoreFiles: { defaults: DEFAULT_IGNORE_FILES, entry: 'fileName' }
};

const LIST_KEYS = { replace: 'list', add: 'list', remove: 'list' };

// The keys of the configuration file, as a tree: what each level may hold.
export const KEYS = {
  name: 'string',
  layout: 'layoutChoice',
  useDefaultLayouts: 'boolean',
  layouts: 'layouts',
  statusHeadings: LIST_KEYS,
  statuses: LIST_KEYS,
  placeholders: LIST_KEYS,
  templateBraces: 'boolean',
  ignoreFiles: LIST_KEYS,
  fileName: { prefix: 'prefix', digits: 'digits', separator: 'separator', lowercase: 'boolean', extension: 'extension' },
  rules: {
    missingTitle: { level: 'ruleLevel' },
    unknownLayout: { level: 'ruleLevel' },
    missingSection: { required: 'ruleLevel', recommended: 'ruleLevel' },
    emptySection: { level: 'ruleLevel' },
    placeholder: { level: 'ruleLevel' },
    missingStatus: { level: 'ruleLevel' },
    unknownStatus: { level: 'ruleLevel' },
    staleProposed: { level: 'ruleLevel', after: 'count', pending: 'statusWord', decided: 'statusWords' },
    supersededLink: { level: 'ruleLevel', statuses: 'statusWords' },
    brokenLink: { level: 'ruleLevel' },
    duplicateNumber: { level: 'ruleLevel' },
    duplicateTitle: { level: 'ruleLevel' },
    numberingGap: { level: 'ruleLevel' },
    fileName: { level: 'ruleLevel' }
  },
  failOn: 'level'
};

// The keys of one layout in layouts, and of one section in the sections of a layout.
export const LAYOUT_KEYS = { title: 'string', requireStatus: 'boolean', sections: 'sections' };
export const SECTION_KEYS = { title: 'string', aliases: 'aliases', level: 'sectionLevel' };

export class ConfigError extends Error {
  constructor(problems) {
    super(problems.map((p) => p.text).join('\n'));
    this.problems = problems;
  }
}

// The edit distance of two short words, for the "did you mean" of an unknown key.
export function distance(a, b) {
  if (a.length > 40 || b.length > 40) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

export const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : typeof v === 'string' ? 'a string' : typeof v === 'number' ? 'a number' : 'a boolean');
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/;
const ID = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const STATUS_WORD = /^[a-z][a-z-]{0,39}$/;
const PREFIX = /^[A-Za-z_-]{0,20}$/;
const EXTENSION = /^\.[A-Za-z0-9]{1,10}$/;
const SEPARATORS = ['-', '_', '.'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fold = (s) => s.trim().split(/\s+/).join(' ').toLowerCase();

// A section in its normal form: the normal forms of its aliases are its keys.
function sectionOf(s) {
  return { id: s.id, title: s.title, level: s.level, aliases: [...s.aliases], keys: s.aliases.map((a) => normalizeHeading(a, { numbered: false })), basis: [...(s.basis ?? [])] };
}

function layoutOf(l) {
  return { id: l.id, title: l.title, requireStatus: Boolean(l.requireStatus), basis: [...(l.basis ?? [])], sections: l.sections.map(sectionOf) };
}

// The configuration that applies without a file.
export function defaultConfig() {
  return {
    name: '',
    defaults: true,
    layout: 'detect',
    layouts: DEFAULT_LAYOUTS.map(layoutOf),
    ...Object.fromEntries(Object.entries(LISTS).map(([k, list]) => [k, [...list.defaults]])),
    statusKeys: DEFAULT_STATUS_HEADINGS.map((h) => normalizeHeading(h, { numbered: false })),
    templateBraces: DEFAULT_TEMPLATE_BRACES,
    fileName: { ...DEFAULT_FILE_NAME },
    rules: JSON.parse(JSON.stringify(DEFAULT_RULES)),
    failOn: DEFAULT_FAIL_ON
  };
}

// The defaults written out as a configuration file, for --print-defaults: every layout with every section and key, every
// list in full, every rule. useDefaultLayouts is false, so the file holds the whole set and can be edited on its own.
export function defaultsAsConfig() {
  return {
    name: 'default layouts',
    layout: 'detect',
    useDefaultLayouts: false,
    layouts: Object.fromEntries(DEFAULT_LAYOUTS.map((l) => [l.id, { title: l.title, requireStatus: l.requireStatus, sections: Object.fromEntries(l.sections.map((s) => [s.id, { title: s.title, aliases: s.aliases, level: s.level }])) }])),
    ...Object.fromEntries(Object.entries(LISTS).map(([k, list]) => [k, { replace: list.defaults }])),
    templateBraces: DEFAULT_TEMPLATE_BRACES,
    fileName: DEFAULT_FILE_NAME,
    rules: DEFAULT_RULES,
    failOn: DEFAULT_FAIL_ON
  };
}

// Checks the value of a configuration file against KEYS and builds the normal form over the defaults.
export function validateConfig(value, lines = new Map(), file = 'config') {
  const problems = [];
  const lim = CONFIG_LIMITS;
  const at = (path) => (path === '' ? file : `${file}${lines.has(path) ? `:${lines.get(path)}` : ''}: ${path}`);
  const bad = (path, message) => {
    problems.push({ path, text: `${at(path)}: ${message}` });
    return undefined;
  };

  const text = (v, path) => {
    if (typeof v !== 'string' || v.trim() === '') return bad(path, `must be a string that is not empty, not ${kindOf(v)}`);
    if (v.length > lim.maxString || CONTROL.test(v)) return bad(path, `must be at most ${lim.maxString} characters with no control character`);
    return v.trim();
  };
  const entryCheck = {
    phrase: (t) => t,
    statusWord: (t, p) => (STATUS_WORD.test(t) ? t : bad(p, `${safeText(t, 60)} is not a status word: lowercase letters a to z and hyphens, starting with a letter`)),
    fileName: (t, p) => (/[\\/]/.test(t) || t === '.' || t === '..' ? bad(p, `${safeText(t, 60)} is not a file name; give a name in the folder, with no / or \\`) : t)
  };
  const strings = (v, path, max, entry) => {
    if (!Array.isArray(v)) return bad(path, `must be a list of strings, not ${kindOf(v)}`);
    if (v.length > max) return bad(path, `holds more than ${max} entries`);
    const out = [];
    const seen = new Set();
    let ok = true;
    v.forEach((item, i) => {
      const p = `${path}[${i}]`;
      const t = text(item, p);
      if (t === undefined) {
        ok = false;
        return;
      }
      const k = fold(t);
      if (seen.has(k)) {
        bad(p, `${safeText(t, 60)} is named twice`);
        ok = false;
        return;
      }
      if (entryCheck[entry](t, p) === undefined) {
        ok = false;
        return;
      }
      seen.add(k);
      out.push(t);
    });
    return ok ? out : undefined;
  };

  const check = (kind, v, p, entry) => {
    if (kind === 'string') return text(v, p);
    if (kind === 'boolean') return typeof v === 'boolean' ? v : bad(p, `must be true or false, not ${kindOf(v)}`);
    if (kind === 'level') return typeof v === 'string' && LEVELS.includes(v) ? v : bad(p, `must be one of ${LEVELS.join(', ')}`);
    if (kind === 'ruleLevel') return typeof v === 'string' && (LEVELS.includes(v) || v === 'off') ? v : bad(p, `must be one of ${LEVELS.join(', ')}, or off`);
    if (kind === 'sectionLevel') return typeof v === 'string' && SECTION_LEVELS.includes(v) ? v : bad(p, `must be one of ${SECTION_LEVELS.join(', ')}`);
    if (kind === 'layoutChoice') return typeof v === 'string' && (v === 'detect' || ID.test(v)) ? v : bad(p, 'must be detect or the id of a layout, such as madr');
    if (kind === 'statusWord') return typeof v === 'string' && STATUS_WORD.test(v) ? v : bad(p, 'must be a status word: lowercase letters a to z and hyphens, starting with a letter');
    if (kind === 'statusWords') {
      const list = strings(v, p, lim.maxPhrases, 'statusWord');
      if (list && list.length === 0) return bad(p, 'is an empty list; name at least one status');
      return list;
    }
    if (kind === 'count') return Number.isInteger(v) && v >= 1 && v <= lim.maxAfter ? v : bad(p, `must be a whole number from 1 to ${lim.maxAfter.toLocaleString('en-US')}`);
    if (kind === 'digits') return Number.isInteger(v) && v >= 1 && v <= 9 ? v : bad(p, 'must be a whole number from 1 to 9');
    if (kind === 'separator') return typeof v === 'string' && SEPARATORS.includes(v) ? v : bad(p, `must be one of ${SEPARATORS.map((s) => `"${s}"`).join(', ')}`);
    if (kind === 'prefix') return typeof v === 'string' && PREFIX.test(v) ? v : bad(p, 'must be at most 20 letters, hyphens or underscores, or empty');
    if (kind === 'extension') return typeof v === 'string' && EXTENSION.test(v) ? v : bad(p, 'must be a dot followed by 1 to 10 letters or digits, such as .md');
    if (kind === 'list') return strings(v, p, lim.maxPhrases, entry);
    if (kind === 'aliases') {
      const list = strings(v, p, lim.maxAliases, 'phrase');
      if (!list) return undefined;
      if (list.length === 0) return bad(p, 'is an empty list; a section needs at least one alias');
      for (const [i, a] of list.entries()) if (normalizeHeading(a, { numbered: false }) === '') return bad(`${p}[${i}]`, `${safeText(a, 60)} has no letter or digit, so no heading can match it`);
      return list;
    }
    if (kind === 'sections' || kind === 'layouts') {
      const max = kind === 'sections' ? lim.maxSections : lim.maxLayouts;
      if (!isObject(v)) return bad(p, `must be an object that maps the id of a ${kind === 'sections' ? 'section' : 'layout'} to its keys, not ${kindOf(v)}`);
      const ids = Object.keys(v);
      if (ids.length > max) return bad(p, `holds more than ${max} entries`);
      const out = [];
      for (const id of ids) {
        const q = `${p}.${id}`;
        if (!ID.test(id)) {
          bad(q, 'an id is a letter followed by letters and digits, at most 40 characters, such as decisionOutcome');
          continue;
        }
        const s = walk(v[id], kind === 'sections' ? SECTION_KEYS : LAYOUT_KEYS, q);
        if (s) out.push({ id, ...s });
      }
      return out;
    }
    return bad(p, 'cannot be read');
  };

  // Walks a level of the configuration against its allowed keys; returns the checked values by key.
  const walk = (obj, spec, path) => {
    if (!isObject(obj)) return bad(path, `must be an object, not ${kindOf(obj)}`) ?? null;
    const out = {};
    for (const key of Object.keys(obj)) {
      const p = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(spec, key)) {
        const near = Object.keys(spec).map((k) => [k, distance(k.toLowerCase(), key.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
        bad(p, `unknown key${near && near[1] <= 3 ? `; did you mean ${near[0]}?` : `; the keys here are ${Object.keys(spec).join(', ')}`}`);
        continue;
      }
      const kind = spec[key];
      const entry = Object.hasOwn(LISTS, path) ? LISTS[path].entry : undefined;
      out[key] = typeof kind === 'object' ? walk(obj[key], kind, p) : check(kind, obj[key], p, entry);
    }
    return out;
  };

  if (!isObject(value)) {
    bad('', `the configuration must be one JSON object, not ${kindOf(value)}`);
    throw new ConfigError(problems);
  }
  const top = walk(value, KEYS, '');
  if (problems.length) throw new ConfigError(problems);

  const config = defaultConfig();
  config.defaults = false;
  config.name = top.name ? safeText(top.name, 120) : '';

  // The layouts: the defaults unless useDefaultLayouts is false, each changed by the keys given for its id; an id that is
  // not a default adds a layout, which needs a title and sections; a section id that is new in a layout adds a section,
  // which needs a title, aliases and a level.
  const layouts = top.useDefaultLayouts === false ? [] : config.layouts;
  for (const given of top.layouts ?? []) {
    const p = `layouts.${given.id}`;
    const known = layouts.find((l) => l.id === given.id);
    if (!known) {
      const missing = ['title', 'sections'].filter((k) => given[k] === undefined);
      if (missing.length) {
        const def = DEFAULT_LAYOUTS.some((l) => l.id === given.id) ? '; it is a default layout, but useDefaultLayouts is false' : '';
        bad(p, `is a new layout and needs ${missing.join(' and ')}${def}`);
        continue;
      }
    }
    const layout = known ?? { id: given.id, title: given.title, requireStatus: false, basis: [], sections: [] };
    if (given.title) layout.title = given.title;
    if (given.requireStatus !== undefined) layout.requireStatus = given.requireStatus;
    for (const s of given.sections ?? []) {
      const q = `${p}.sections.${s.id}`;
      const old = layout.sections.find((x) => x.id === s.id);
      if (old) {
        layout.sections[layout.sections.indexOf(old)] = sectionOf({ ...old, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) });
        continue;
      }
      const missing = ['title', 'aliases', 'level'].filter((k) => s[k] === undefined);
      if (missing.length) {
        bad(q, `is a new section and needs ${missing.join(', ')}`);
        continue;
      }
      layout.sections.push(sectionOf({ ...s, basis: [] }));
    }
    if (!known) layouts.push(layout);
  }
  if (layouts.length > lim.maxLayouts) bad('layouts', `there are more than ${lim.maxLayouts} layouts`);
  config.layouts = layouts;

  // The lists: replace, then add, then remove.
  for (const key of Object.keys(LISTS)) {
    const spec = top[key];
    if (!spec) continue;
    let list = spec.replace ? [...spec.replace] : [...config[key]];
    for (const t of spec.add ?? []) {
      if (list.some((x) => fold(x) === fold(t))) bad(`${key}.add`, `${safeText(t, 60)} is already in the list`);
      else list.push(t);
    }
    for (const t of spec.remove ?? []) {
      if (!list.some((x) => fold(x) === fold(t))) bad(`${key}.remove`, `${safeText(t, 60)} is not in the list`);
      list = list.filter((x) => fold(x) !== fold(t));
    }
    if (list.length > lim.maxPhrases) bad(key, `holds more than ${lim.maxPhrases} entries`);
    config[key] = list;
  }
  if (!config.statuses.length) bad('statuses', 'is empty; a record could then never have a known status');
  if (!config.statusHeadings.length) bad('statusHeadings', 'is empty; name at least one heading of the status section, such as Status');
  config.statusKeys = config.statusHeadings.map((h) => normalizeHeading(h, { numbered: false }));
  config.statusKeys.forEach((k, i) => {
    if (k === '') bad(`statusHeadings`, `${safeText(config.statusHeadings[i], 60)} has no letter or digit, so no heading can match it`);
  });

  // Every heading matches at most one section of a layout, and no section shares a heading with the status section.
  for (const layout of layouts) {
    const owner = new Map();
    for (const s of layout.sections) {
      if (s.level === 'off') continue;
      s.keys.forEach((key, i) => {
        const other = owner.get(key);
        if (other && other !== s.id) bad(`layouts.${layout.id}.sections.${s.id}`, `the alias ${safeText(s.aliases[i], 60)} is also an alias of ${other}; a heading would match both`);
        else owner.set(key, s.id);
        if (config.statusKeys.includes(key)) bad(`layouts.${layout.id}.sections.${s.id}`, `the alias ${safeText(s.aliases[i], 60)} is also a heading of the status section`);
      });
    }
  }
  const active = layouts.filter((l) => l.sections.some((s) => s.level !== 'off'));
  if (!active.length) bad('layouts', 'there is no layout with a section that is not off; no record could have a layout');
  if (top.layout) config.layout = top.layout;
  if (config.layout !== 'detect' && !active.some((l) => l.id === config.layout)) bad('layout', `${config.layout} is not a layout with a section that is not off; give detect or one of ${active.map((l) => l.id).join(', ') || 'none'}`);

  if (top.templateBraces !== undefined) config.templateBraces = top.templateBraces;
  if (top.fileName) Object.assign(config.fileName, Object.fromEntries(Object.entries(top.fileName).filter(([, v]) => v !== undefined)));

  // The rules and the fail level. The status words a rule names must be status words of the configuration.
  for (const [key, given] of Object.entries(top.rules ?? {})) Object.assign(config.rules[key], Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)));
  const stale = config.rules.staleProposed;
  if (stale.level !== 'off') {
    if (!config.statuses.includes(stale.pending)) bad('rules.staleProposed.pending', `${stale.pending} is not one of the statuses; set the rule to off or add it`);
    for (const w of stale.decided) if (!config.statuses.includes(w)) bad('rules.staleProposed.decided', `${w} is not one of the statuses; set the rule to off or add it`);
    if (stale.decided.includes(stale.pending)) bad('rules.staleProposed', `${stale.pending} is both pending and decided`);
  }
  if (config.rules.supersededLink.level !== 'off') {
    for (const w of config.rules.supersededLink.statuses) if (!config.statuses.includes(w)) bad('rules.supersededLink.statuses', `${w} is not one of the statuses; set the rule to off or add it`);
  }
  if (top.failOn) config.failOn = top.failOn;
  if (problems.length) throw new ConfigError(problems);
  return config;
}

// Reads the text of a configuration file into the normal form. file is the path shown. Throws ConfigError with every
// problem.
export function readConfig(text, file = 'config') {
  let parsed;
  try {
    parsed = parseJson(text);
  } catch (error) {
    if (error instanceof JsonError) throw new ConfigError([{ path: '', text: `${file}: ${jsonProblem(error, text)}` }]);
    throw error;
  }
  return validateConfig(parsed.value, parsed.lines, file);
}
