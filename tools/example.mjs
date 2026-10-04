// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// folders of records to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const TROUBLED = ['examples/troubled', '--config', 'examples/config.json'];
export const HEALTHY = ['examples/healthy', '--config', 'examples/config.json'];

// Runs the tool on folders of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the troubled folder: the counts, one finding of every kind it shows, and the result.
export const EXPECTED = [
  'records: 9: 8 Nygard, 1 with no layout; 1 proposed, 5 accepted, 1 superseded, 1 with another status, 1 with no status',
  'findings: 13 (8 error, 4 warning, 1 notice); fail level warning',
  'the record is superseded, but its status names no record that replaces it',
  'the status "approved" is not one of proposed, accepted, rejected, deprecated, superseded and draft',
  'the number 5 is used by 2 records: 0005-cache-prices-in-memory.md and 0005-use-feature-flags.md',
  'the link 0010-search-index.md points to 0010-search-index.md, which is not in the folder',
  'the record is still proposed while 4 later records are accepted or rejected',
  'no record has the number 6, between 0005-cache-prices-in-memory.md and 0007-move-search-to-a-separate-service.md',
  'note: 1 link leaves the folder and was not followed: examples/troubled/0007-move-search-to-a-separate-service.md:15 ../../handbook/README.md',
  'RESULT: FAIL - 12 findings at or above warning'
];
export const UNWANTED = ['RESULT: PASS', '0001-record-architecture-decisions.md:', 'README.md:'];

const problems = [];
function expect(name, result, code, expected, unwanted) {
  const missing = expected.filter((e) => !result.out.includes(e));
  const wrong = unwanted.filter((e) => result.out.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const troubled = await run(TROUBLED);
  process.stdout.write(troubled.out);
  expect('troubled folder', troubled, 1, EXPECTED, UNWANTED);

  const healthy = await run(HEALTHY);
  expect('healthy folder', healthy, 0, ['records: 5: 5 MADR; 1 proposed, 3 accepted, 1 superseded', 'findings: 0; fail level warning', 'RESULT: PASS - no finding at or above warning'], ['  WARNING  ', '  ERROR  ', '  NOTICE  ', 'RESULT: FAIL']);

  // With the fail level at notice, the troubled folder still fails; the healthy one still passes.
  const strict = await run([...HEALTHY, '--fail-on', 'notice']);
  expect('healthy, fail on notice', strict, 0, ['RESULT: PASS - no finding at or above notice'], []);

  // The built-in configuration alone: the status "approved" is still unknown, and a proposed record with three later
  // accepted records is stale.
  const builtIn = await run(['examples/troubled']);
  expect('built-in configuration', builtIn, 1, ['config: built-in defaults:', 'stale-proposed', 'unknown-status'], ['draft']);

  // The README shows the whole report of the troubled folder, the --explain lines of one finding, and the report of the
  // healthy one.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  if (!readme.includes(troubled.out)) problems.push('README: the sample output of the troubled folder differs from a real run');
  if (!readme.includes(healthy.out)) problems.push('README: the sample output of the healthy folder differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/troubled.txt'), troubled.out);
  await writeFile(resolve(root, 'examples/output/healthy.txt'), healthy.out);
  const explain = await run([...TROUBLED, '--explain']);
  if (explain.code !== 1) problems.push(`explain: exit code ${explain.code}, expected 1`);
  const lines = explain.out.split('\n');
  const at = lines.findIndex((l) => l.includes('stale-proposed') && l.includes('0002-use-a-message-queue-for-orders.md:'));
  const sample = lines.slice(at, at + 9).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the --explain sample of the stale record differs from a real run');
  await writeFile(resolve(root, 'examples/output/troubled-explain.txt'), explain.out);
  for (const [format, name] of [['markdown', 'troubled.md'], ['json', 'troubled.json']]) {
    const r = await run([...TROUBLED, '--format', format, '--explain']);
    if (r.code !== 1) problems.push(`${format}: exit code ${r.code}, expected 1`);
    await writeFile(resolve(root, 'examples/output', name), r.out);
  }
  const defaults = await run(['--print-defaults']);
  if (defaults.code !== 0) problems.push(`--print-defaults: exit code ${defaults.code}, expected 0`);
  await writeFile(resolve(root, 'examples/output/defaults.json'), defaults.out);

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
