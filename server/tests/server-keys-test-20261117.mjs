// No key ever leaves the server (2026-11-17: /api/health once answered newCardsToday with the OpenAI key itself).
// Starts the real server module with fake keys and a throwaway data folder; no network, no AI, no money.
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'papermon-keys-test-'));
const FAKE = {claude: 'fake-claude-key-for-tests-0000', openai: 'fake-openai-key-for-tests-0000'};  // not key-shaped, so key scanners stay quiet
Object.assign(process.env, {
  PAPERMON_DATA: dir, PAPERMON_WRITER: 'claude',
  PAPER_GIRL_ANTHROPIC_API_KEY: FAKE.claude, PAPERMON_PATTY_OPENAI_API_KEY: FAKE.openai, PAPERGIRL_PATTY_OPENAI_API_KEY: '',
});
const {server} = await import('../papermon-server-20261114.mjs');
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => { server.close(); server.closeAllConnections?.(); try { rmSync(dir, {recursive: true, force: true}); } catch {} });

const leaks = text => Object.values(FAKE).filter(k => text.includes(k) || text.includes(k.slice(0, 15)));

test('the health check answers true/false, never a key', async () => {
  const text = await (await fetch(`${base}/api/health`)).text();
  assert.deepEqual(leaks(text), []);
  const h = JSON.parse(text);
  assert.equal(h.newCardsToday, true);
  assert.equal(h.catalog, false);
  for (const v of Object.values(h)) assert.ok(['boolean', 'number', 'string'].includes(typeof v));
  assert.ok(typeof h.writer === 'string' && h.writer.length < 10);
});

test('no public answer carries a key', async () => {
  const answers = await Promise.all([
    fetch(`${base}/api/catalog`), fetch(`${base}/owner`), fetch(`${base}/api/owner`), fetch(`${base}/nowhere`),
    fetch(`${base}/api/draw`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({reader: 'r-keys-test-reader', subject: 'Biology', lv: 1, have: []})}),
    fetch(`${base}/api/vote`, {method: 'POST', body: '{}'}),
  ]);
  for (const a of answers) assert.deepEqual(leaks(await a.text()), [], a.url);
});

test('through the tunnel, the owner page stays shut even with the right key', async () => {
  const r = await fetch(`${base}/api/owner?key=whatever`, {headers: {'Tailscale-Funnel-Request': '?1'}});
  assert.equal(r.status, 403);
});
