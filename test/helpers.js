// Shared test helpers: records and configurations built inline, checked in memory or written into a temporary folder
// that is removed after the test. Paths are built with resolve() from forward-slash names, so the same test runs on
// Linux, macOS and Windows. The line a test expects is found with lineOf(), which counts lines the way the tool does, so
// a test never holds a line number worked out by hand for one system only; columnIn() does the same for a column. No
// test reads the clock, the time zone or the locale.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { buildReport, defaultConfig, lineStarts, main, positionOf, readConfig, readRecord } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'adr-health-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return positionOf(lineStarts(text), at).line;
}

// The column (from 1) of the n-th place where needle starts in text, in its line.
export function columnIn(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return positionOf(lineStarts(text), at).column;
}

// A text from lines.
export const md = (...lines) => `${lines.join('\n')}\n`;

// The configuration of a configuration object, through the real reader, or the defaults.
export const configOf = (object) => (object ? readConfig(JSON.stringify(object), 'config.json') : defaultConfig());

// A record in Nygard's format with every section, with parts replaced: a part set to null is left out.
export function nygard({ title = '# 1. Use a queue', status = 'Accepted', context = 'Orders arrive in bursts.', decision = 'We will use a queue.', consequences = 'The team runs one more system.' } = {}) {
  const parts = [];
  if (title !== null) parts.push(title, '');
  if (status !== null) parts.push('## Status', '', status, '');
  if (context !== null) parts.push('## Context', '', context, '');
  if (decision !== null) parts.push('## Decision', '', decision, '');
  if (consequences !== null) parts.push('## Consequences', '', consequences, '');
  return `${parts.join('\n')}`;
}

// A record in MADR with the required sections and a status in its front matter.
export function madr({ status = 'accepted', title = '# Use a queue', extra = '' } = {}) {
  return md('---', `status: ${status}`, '---', '', title, '', '## Context and Problem Statement', '', 'Orders arrive in bursts.', '', '## Considered Options', '', '* A queue', '* Polling', '', '## Decision Outcome', '', 'Chosen option: "A queue", because it smooths bursts.', '', '### Consequences', '', '* Good, because bursts are smoothed.', extra);
}

// A folder listing as src/files.js gives it, for buildReport in memory.
export const folderOf = (names, extra = {}) => ({ shown: 'adr', full: '/adr', files: [...names].sort(), folders: [], links: [], other: [], ignored: [], ...extra });

// The report of a set of records written as { name: text }, in memory.
export function reportOf(records, config = null, extra = {}) {
  const cfg = configOf(config);
  const names = Object.keys(records).sort();
  const read = names.map((n) => readRecord(n, records[n], cfg));
  return buildReport(folderOf([...names, ...(extra.otherFiles ?? [])], extra.folder ?? {}), read, cfg, {});
}

// The findings of a report, of one rule or of all.
export const findingsOf = (report, rule) => report.findings.filter((f) => !rule || f.rule === rule);

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err, dir };
  });
}

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// A healthy folder of three Nygard records.
export const GOOD = {
  'adr/0001-record-decisions.md': nygard({ title: '# 1. Record decisions' }),
  'adr/0002-use-a-queue.md': nygard({ title: '# 2. Use a queue' }),
  'adr/0003-cache-prices.md': nygard({ title: '# 3. Cache prices', decision: 'We will cache prices, as [ADR 2](0002-use-a-queue.md) planned.' })
};
