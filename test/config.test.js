import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_LIMITS, ConfigError, DEFAULT_FILE_NAME, DEFAULT_IGNORE_FILES, DEFAULT_LAYOUTS, DEFAULT_PLACEHOLDERS, DEFAULT_RULES, DEFAULT_STATUSES, DEFAULT_STATUS_HEADINGS, DEFAULT_TEMPLATE_BRACES, DEFAULT_FAIL_ON, KEYS, LAYOUT_KEYS, LISTS, SECTION_KEYS, defaultConfig, defaultsAsConfig, distance, kindOf, readConfig, validateConfig } from '../src/index.js';
import { configOf, lineOf } from './helpers.js';

// The configuration file: every key, the defaults it changes, and the errors it gives.

const problemsOf = (text) => {
  try {
    readConfig(text, 'config.json');
  } catch (error) {
    assert.ok(error instanceof ConfigError, error.message);
    return error.problems.map((p) => p.text);
  }
  assert.fail('the configuration was accepted');
};
const problemOf = (object) => problemsOf(JSON.stringify(object, null, 2)).join('\n');

test('defaults: the two layouts, the lists and the rules, and the defaults written out read back to the same configuration', () => {
  const d = defaultConfig();
  assert.equal(d.defaults, true);
  assert.equal(d.layout, 'detect');
  assert.deepEqual(d.layouts.map((l) => l.id), DEFAULT_LAYOUTS.map((l) => l.id));
  assert.deepEqual(d.layouts.map((l) => l.requireStatus), [true, false]);
  assert.deepEqual(d.layouts[1].sections.filter((s) => s.level === 'required').map((s) => s.id), ['contextAndProblem', 'consideredOptions', 'decisionOutcome']);
  assert.deepEqual(d.statuses, DEFAULT_STATUSES);
  assert.deepEqual(d.statusHeadings, DEFAULT_STATUS_HEADINGS);
  assert.deepEqual(d.placeholders, DEFAULT_PLACEHOLDERS);
  assert.deepEqual(d.ignoreFiles, DEFAULT_IGNORE_FILES);
  assert.deepEqual(d.fileName, DEFAULT_FILE_NAME);
  assert.equal(d.templateBraces, DEFAULT_TEMPLATE_BRACES);
  assert.deepEqual(d.rules, DEFAULT_RULES);
  assert.equal(d.failOn, DEFAULT_FAIL_ON);
  const back = readConfig(JSON.stringify(defaultsAsConfig()), 'defaults.json');
  const shape = (c) => c.layouts.map((l) => ({ id: l.id, title: l.title, requireStatus: l.requireStatus, sections: l.sections.map(({ id, title, level, aliases }) => ({ id, title, level, aliases })) }));
  assert.deepEqual(shape(back), shape(d));
  for (const k of Object.keys(LISTS)) assert.deepEqual(back[k], d[k], k);
  assert.deepEqual(back.rules, d.rules);
  assert.deepEqual(back.fileName, d.fileName);
  assert.equal(back.name, 'default layouts');
  defaultConfig().rules.placeholder.level = 'off';
  defaultConfig().layouts[0].sections.pop();
  assert.equal(defaultConfig().rules.placeholder.level, 'warning', 'the defaults are copied, never shared');
  assert.equal(defaultConfig().layouts[0].sections.length, 3);
});

test('layouts: a default layout and its sections are changed key by key, a layout and a section are added, and useDefaultLayouts: false starts empty', () => {
  const c = configOf({ layouts: { nygard: { requireStatus: false, sections: { decision: { aliases: ['Decision', 'Resolution'] }, notes: { title: 'Notes', aliases: ['Notes'], level: 'optional' } } }, ytype: { title: 'Y-statement', sections: { statement: { title: 'Statement', aliases: ['Y-statement'], level: 'required' } } } } });
  const n = c.layouts.find((l) => l.id === 'nygard');
  assert.equal(n.requireStatus, false);
  const decision = n.sections.find((s) => s.id === 'decision');
  assert.deepEqual(decision.aliases, ['Decision', 'Resolution']);
  assert.deepEqual(decision.keys, ['decision', 'resolution']);
  assert.equal(decision.level, 'required', 'the keys not given keep their default');
  assert.equal(n.sections.at(-1).id, 'notes');
  assert.deepEqual(c.layouts.map((l) => l.id), ['nygard', 'madr', 'ytype']);
  assert.deepEqual(c.layouts[2].sections[0].keys, ['y statement']);
  const own = configOf({ useDefaultLayouts: false, layouts: { mine: { title: 'Mine', sections: { why: { title: 'Why', aliases: ['Why'], level: 'required' } } } } });
  assert.deepEqual(own.layouts.map((l) => l.id), ['mine']);
  assert.equal(configOf({ layout: 'madr' }).layout, 'madr');
});

test('layouts: a new layout or section without its keys, a shared alias, an alias that is a status heading, an alias with no letter, and no layout at all', () => {
  assert.match(problemOf({ layouts: { mine: { title: 'Mine' } } }), /config\.json:3: layouts\.mine: is a new layout and needs sections/);
  assert.match(problemOf({ useDefaultLayouts: false, layouts: { madr: { requireStatus: true } } }), /needs title and sections; it is a default layout, but useDefaultLayouts is false/);
  assert.match(problemOf({ layouts: { madr: { sections: { extra: { title: 'Extra' } } } } }), /layouts\.madr\.sections\.extra: is a new section and needs aliases, level/);
  assert.match(problemOf({ layouts: { nygard: { sections: { context: { aliases: ['Decision'] } } } } }), /the alias Decision is also an alias of /);
  assert.match(problemOf({ layouts: { nygard: { sections: { context: { aliases: ['Status'] } } } } }), /the alias Status is also a heading of the status section/);
  assert.match(problemOf({ layouts: { nygard: { sections: { context: { aliases: ['***'] } } } } }), /\*\*\* has no letter or digit/);
  assert.match(problemOf({ layouts: { nygard: { sections: { context: { aliases: [] } } } } }), /is an empty list; a section needs at least one alias/);
  assert.match(problemOf({ useDefaultLayouts: false }), /there is no layout with a section that is not off/);
  assert.match(problemOf({ layout: 'ytype' }), /layout: ytype is not a layout with a section that is not off; give detect or one of nygard, madr/);
  assert.match(problemOf({ layout: 'not an id' }), /must be detect or the id of a layout/);
  assert.match(problemOf({ layouts: { 'bad id': { title: 'x', sections: {} } } }), /an id is a letter followed by letters and digits/);
  assert.match(problemOf({ layouts: { nygard: { sections: { context: { level: 'sometimes' } } } } }), /must be one of required, recommended, optional, off/);
  assert.match(problemOf({ layouts: [] }), /must be an object that maps the id of a layout to its keys, not an array/);
});

test('lists: replace, add and remove; an entry added twice, removed but not there, named twice, or of the wrong form', () => {
  const c = configOf({ statuses: { add: ['draft'], remove: ['deprecated'] }, placeholders: { replace: ['XXX'] }, ignoreFiles: { add: ['CHANGELOG.md'] }, statusHeadings: { add: ['State'] } });
  assert.deepEqual(c.statuses, ['proposed', 'accepted', 'rejected', 'superseded', 'draft']);
  assert.deepEqual(c.placeholders, ['XXX']);
  assert.ok(c.ignoreFiles.includes('CHANGELOG.md'));
  assert.deepEqual(c.statusKeys, ['status', 'state']);
  assert.match(problemOf({ statuses: { add: ['accepted'] } }), /statuses\.add: accepted is already in the list/);
  assert.match(problemOf({ statuses: { remove: ['approved'] } }), /statuses\.remove: approved is not in the list/);
  assert.match(problemOf({ placeholders: { add: ['TBD', 'tbd'] } }), /tbd is named twice/);
  assert.match(problemOf({ statuses: { add: ['On Hold'] } }), /On Hold is not a status word/);
  assert.match(problemOf({ ignoreFiles: { add: ['docs/README.md'] } }), /is not a file name/);
  assert.match(problemOf({ statuses: { replace: [] }, rules: { staleProposed: { level: 'off' }, supersededLink: { level: 'off' } } }), /statuses: is empty/);
  assert.match(problemOf({ statusHeadings: { replace: [] }, }), /statusHeadings: is empty/);
  assert.match(problemOf({ placeholders: { add: 'TBD' } }), /must be a list of strings, not a string/);
  assert.match(problemOf({ placeholders: { add: [''] } }), /must be a string that is not empty/);
  assert.match(problemOf({ placeholders: { add: ['x'.repeat(CONFIG_LIMITS.maxString + 1)] } }), /at most 120 characters/);
  assert.match(problemOf({ placeholders: { add: Array.from({ length: CONFIG_LIMITS.maxPhrases + 1 }, (_, i) => `p${i}`) } }), /holds more than 500 entries/);
  assert.match(problemOf({ placeholders: { add: [`a${String.fromCharCode(0x202e)}b`] } }), /no control character/);
});

test('file name: each key of the spec, and the values it refuses', () => {
  assert.deepEqual(configOf({ fileName: { prefix: 'adr-', digits: 3, lowercase: false } }).fileName, { prefix: 'adr-', digits: 3, separator: '-', lowercase: false, extension: '.md' });
  assert.match(problemOf({ fileName: { digits: 0 } }), /must be a whole number from 1 to 9/);
  assert.match(problemOf({ fileName: { digits: 2.5 } }), /must be a whole number from 1 to 9/);
  assert.match(problemOf({ fileName: { separator: '+' } }), /must be one of "-", "_", "."/);
  assert.match(problemOf({ fileName: { prefix: 'adr1' } }), /at most 20 letters, hyphens or underscores, or empty/);
  assert.match(problemOf({ fileName: { extension: 'md' } }), /a dot followed by 1 to 10 letters or digits/);
  assert.match(problemOf({ fileName: { pattern: '^\\d+' } }), /fileName\.pattern: unknown key/);
  assert.equal(configOf({ fileName: { prefix: '' } }).fileName.prefix, '');
});

test('rules: levels, the limit and words of stale-proposed, the words of superseded-link, and the fail level', () => {
  const c = configOf({ rules: { staleProposed: { after: 5, decided: ['accepted', 'rejected'] }, supersededLink: { statuses: ['superseded', 'deprecated'] }, numberingGap: { level: 'off' } }, failOn: 'error' });
  assert.deepEqual(c.rules.staleProposed, { level: 'warning', after: 5, pending: 'proposed', decided: ['accepted', 'rejected'] });
  assert.deepEqual(c.rules.supersededLink.statuses, ['superseded', 'deprecated']);
  assert.equal(c.rules.numberingGap.level, 'off');
  assert.equal(c.failOn, 'error');
  assert.match(problemOf({ rules: { staleProposed: { after: 0 } } }), /must be a whole number from 1 to 100,000/);
  assert.match(problemOf({ rules: { staleProposed: { pending: 'draft' } } }), /draft is not one of the statuses; set the rule to off or add it/);
  assert.match(problemOf({ rules: { staleProposed: { decided: ['proposed'] } } }), /proposed is both pending and decided/);
  assert.match(problemOf({ rules: { staleProposed: { decided: [] } } }), /is an empty list; name at least one status/);
  assert.match(problemOf({ rules: { supersededLink: { statuses: ['replaced'] } } }), /replaced is not one of the statuses/);
  assert.equal(configOf({ rules: { supersededLink: { level: 'off', statuses: ['replaced'] } } }).rules.supersededLink.level, 'off', 'a rule that is off is not held to the status words');
  assert.match(problemOf({ rules: { brokenLink: { level: 'fatal' } } }), /must be one of notice, warning, error, or off/);
  assert.match(problemOf({ failOn: 'off' }), /failOn: must be one of notice, warning, error/);
  assert.match(problemOf({ rules: { missingSection: { level: 'error' } } }), /rules\.missingSection\.level: unknown key; the keys here are required, recommended/);
});

test('strict reading: unknown keys with a suggestion and their line, a key named twice, JSON that is not JSON, not an object', () => {
  const text = '{\n  "name": "x",\n  "layuot": "madr"\n}\n';
  assert.deepEqual(problemsOf(text), [`config.json:${lineOf(text, '"layuot"')}: layuot: unknown key; did you mean layout?`]);
  assert.match(problemOf({ zzzzzzzz: 1 }), /unknown key; the keys here are name, layout,/);
  assert.match(problemsOf('{"name": "a", "name": "b"}')[0], /config\.json: line 1, column 15: the name "name" appears twice in one object; RFC 8259 says/);
  assert.match(problemsOf('{"name": "a",}')[0], /JSON has no trailing comma/);
  assert.match(problemsOf('// c\n{}')[0], /a comment; JSON has no comments/);
  assert.match(problemsOf('[]')[0], /the configuration must be one JSON object, not an array/);
  assert.match(problemOf({ name: 3 }), /name: must be a string that is not empty, not a number/);
  assert.match(problemOf({ templateBraces: 'yes' }), /must be true or false, not a string/);
  assert.match(problemOf({ rules: 'strict' }), /rules: must be an object, not a string/);
  const many = problemsOf(JSON.stringify({ a: 1, b: 2, c: 3 }));
  assert.equal(many.length, 3, 'every problem is listed');
  assert.equal(configOf({ name: '__proto__' }).name, '__proto__');
  assert.match(problemsOf('{"__proto__": {"failOn": "notice"}}')[0], /__proto__: unknown key/);
  assert.equal({}.failOn, undefined);
});

test('helpers: the keys of the tree, the distance of two words, and the kind of a value', () => {
  assert.ok(Object.hasOwn(KEYS.rules, 'staleProposed'));
  assert.deepEqual(Object.keys(LAYOUT_KEYS), ['title', 'requireStatus', 'sections']);
  assert.deepEqual(Object.keys(SECTION_KEYS), ['title', 'aliases', 'level']);
  assert.equal(distance('layuot', 'layout'), 2);
  assert.equal(distance('x'.repeat(41), 'x'), 99);
  assert.deepEqual([null, [], {}, 's', 1, true].map(kindOf), ['null', 'an array', 'an object', 'a string', 'a number', 'a boolean']);
  assert.throws(() => validateConfig(null), ConfigError);
});
