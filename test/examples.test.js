import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECTED, HEALTHY, TROUBLED, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');

test('examples: the troubled folder fails with the report that is saved in examples/output', async () => {
  const r = await run(TROUBLED);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('troubled.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the healthy MADR folder passes with the report that is saved', async () => {
  const r = await run(HEALTHY);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('healthy.txt'));
  assert.match(r.out, /findings: 0; fail level warning/);
});

test('examples: --explain, Markdown, JSON and the defaults are the reports that are saved', async () => {
  assert.equal((await run([...TROUBLED, '--explain'])).out, await saved('troubled-explain.txt'));
  assert.equal((await run([...TROUBLED, '--format', 'markdown', '--explain'])).out, await saved('troubled.md'));
  assert.equal((await run([...TROUBLED, '--format', 'json', '--explain'])).out, await saved('troubled.json'));
  assert.equal((await run(['--print-defaults'])).out, await saved('defaults.json'));
});

test('examples: every rule but the ones the README names as absent fires on the troubled folder, each on the record built for it', async () => {
  const report = JSON.parse((await run([...TROUBLED, '--format', 'json'])).out);
  const byRule = {};
  for (const f of report.findings) (byRule[f.rule] ??= []).push(f.at.split('/').at(-1).split(':')[0]);
  assert.deepEqual(byRule, {
    'superseded-link': ['0003-deploy-on-virtual-machines.md'],
    'unknown-status': ['0004-cache-prices-in-memory.md'],
    'duplicate-title': ['0005-cache-prices-in-memory.md'],
    'duplicate-number': ['0005-use-feature-flags.md'],
    'missing-section': ['0007-move-search-to-a-separate-service.md'],
    'broken-link': ['0007-move-search-to-a-separate-service.md'],
    'unknown-layout': ['0009-notes-from-the-planning-meeting.md'],
    'missing-title': ['08-Rename-Customer-Tables.md'],
    'stale-proposed': ['0002-use-a-message-queue-for-orders.md'],
    'empty-section': ['0004-cache-prices-in-memory.md'],
    placeholder: ['0007-move-search-to-a-separate-service.md'],
    'file-name': ['08-Rename-Customer-Tables.md'],
    'numbering-gap': ['troubled']
  });
});

test('examples: the same folders written with CRLF line ends give the same reports', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'adr-health-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    for (const sub of ['examples/troubled', 'examples/healthy']) {
      for (const f of await readdir(resolve(dir, sub))) {
        const text = (await readFile(resolve(dir, sub, f), 'utf8')).split('\r\n').join('\n');
        await writeFile(resolve(dir, sub, f), text.split('\n').join('\r\n'));
      }
    }
    assert.equal((await run([...TROUBLED, '--explain'], dir)).out, await saved('troubled-explain.txt'));
    assert.equal((await run(HEALTHY, dir)).out, await saved('healthy.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
