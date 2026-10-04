// Command line: adr-health-check <folder> [--config <file>] [options]

import { readFileSync } from 'node:fs';
import { InputError, LIMITS, checkPaths } from './check.js';
import { defaultsAsConfig } from './config.js';
import { writeReport } from './files.js';
import { toText, toMarkdown, toJson } from './report.js';
import { RULES } from './rules.js';
import { LEVELS } from './data.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson };

export const USAGE = `Usage: adr-health-check <folder> [--config <file>] [options]

Checks the health of a folder of architecture decision records written in Markdown, in Michael Nygard's format or in
MADR: sections of the layout that are missing, headings with no text or nothing but placeholders, placeholders such as
TBD, a status that is missing or not one of the status words, records left proposed while later records were accepted,
superseded records that do not name the record that replaces them, relative links to files that are not in the
folder, numbers used twice, titles used twice, gaps in the numbers, and file names that do not follow the spec. It
reads no clock and no date: the age of a proposed record is its place in the numbered sequence. It opens no network
connection, follows no link out of the folder and no symbolic link, and writes nothing to disk but the file --out names.

Options:
  --config <file>           a configuration file (JSON) that changes the layouts, the status words, the placeholders,
                            the file-name spec or the rules (default: the built-in configuration; --print-defaults
                            shows it)
  --format <name>           text, markdown or json (default: text)
  --explain                 show the rule, the reasons and the sentences behind each finding
  --fail-on <level>         the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: failOn of
                            the configuration, else warning)
  --out <file>              write the report to this file instead of the screen
  --print-defaults          print the built-in configuration as a configuration file and exit
  --help                    show this text
  --version                 show the version

Rules: ${RULES.map((r) => `${r.id} (rules.${r.key})`).join(', ')}.

Exit codes: 0 no finding at or above the fail level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { folder: null, config: null, format: 'text', explain: false, failOn: null, out: null, printDefaults: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  let format = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--print-defaults') o.printDefaults = true;
    else if (a === '--config') o.config = once(a, o.config, next());
    else if (a === '--out') o.out = once(a, o.out, next());
    else if (a === '--format') format = once(a, format, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '-') throw new Error('reading from standard input is not supported; give a folder');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else if (o.folder !== null) throw new Error(`one folder at a time; ${a} is a second one`);
    else o.folder = a;
  }
  if (format !== null) o.format = format;
  if (!o.help && !o.version && !o.printDefaults) {
    if (!o.folder) throw new Error('give the folder of records to check, such as adr-health-check docs/decisions');
    for (const p of [o.folder, o.config, o.out].filter(Boolean)) if (isUrl(p)) throw new Error('give a local path; the tool never fetches a URL');
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown or json)`);
    if (o.failOn !== null && !LEVELS.includes(o.failOn)) throw new Error(`unknown level ${o.failOn} (${LEVELS.join(', ')})`);
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`adr-health-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.printDefaults) {
    io.out(`${JSON.stringify(defaultsAsConfig(), null, 2)}\n`);
    return 0;
  }
  let report;
  try {
    report = await checkPaths({ folder: o.folder, config: o.config, failOn: o.failOn, version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`adr-health-check: no verdict, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`adr-health-check: ${clean(error.message)}\n`);
    return 2;
  }
  const text = FORMATS[o.format](report, { explain: o.explain });
  if (o.out) {
    try {
      const shown = await writeReport(o.out, text, base, { folder: o.folder, files: o.config ? [o.config] : [] });
      io.err(`adr-health-check: the report is in ${clean(shown)}; ${report.verdict.text}\n`);
    } catch (error) {
      io.err(`adr-health-check: ${clean(error.message)}\n`);
      return 2;
    }
  } else io.out(text);
  return report.verdict.pass ? 0 : 1;
}
