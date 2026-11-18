// Astra's mint pass (2026-11-17: "can you please open up unlimited mints for me?"): with the pass a draw has no daily
// limit and asks for a new card; without it (or with a wrong one) the five-a-day limit holds; the pass's spending is
// left out of friends' $2. Starts the real server module with the free dry writer in a throwaway data folder.
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openCatalog} from '../catalog-20261114.mjs';

const dir = mkdtempSync(join(tmpdir(), 'papermon-pass-test-'));
Object.assign(process.env, {PAPERMON_DATA: dir, PAPERMON_WRITER: 'dry'});
const {server} = await import('../papermon-server-20261114.mjs');
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const pass = JSON.parse(readFileSync(join(dir, 'papermon-server-20261114.json'), 'utf8')).mintPass;
const side = openCatalog(join(dir, 'papermon-catalog-20261114.sqlite'));   // a second door into the same catalog
after(() => { server.close(); server.closeAllConnections?.(); try { rmSync(dir, {recursive: true, force: true}); } catch {} });

const draw = (reader, headers = {}) => fetch(`${base}/api/draw`, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers},
  body: JSON.stringify({reader, subject: '', lv: 0, have: []})}).then(async r => ({http: r.status, ...(await r.json())}));
const health = () => fetch(`${base}/api/health`).then(r => r.json());
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Denver'}).format(new Date());

test('the server makes a mint pass and never shows it', async () => {
  assert.match(pass, /^[A-Za-z0-9_-]{20,}$/);
  for (const path of ['/api/health', '/api/catalog', '/nowhere']) assert.ok(!(await (await fetch(base + path)).text()).includes(pass), path);
});

test('without the pass the five-a-day limit holds; with it there is none', async () => {
  const reader = 'r-pass-test-limited';
  for (let i = 0; i < 5; i++) assert.equal((await draw(reader)).http, 200, `draw ${i + 1}`);
  const sixth = await draw(reader);
  assert.equal(sixth.http, 429);
  assert.equal(sixth.limit, true);
  assert.equal((await draw(reader, {'X-Papermon-Pass': pass.slice(0, -1) + (pass.endsWith('A') ? 'B' : 'A')})).http, 429, 'a wrong pass');
  const minted = await draw(reader, {'X-Papermon-Pass': pass});
  assert.equal(minted.http, 200);
  assert.equal(minted.need, 'paper', 'with the pass, a draw mints a new card instead of handing out a catalog card');
});

test('a page on the site may send the pass header', async () => {
  const r = await fetch(`${base}/api/draw`, {method: 'OPTIONS', headers: {Origin: 'https://findastra.github.io',
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-papermon-pass'}});
  assert.equal(r.status, 204);
  assert.match(r.headers.get('access-control-allow-headers') || '', /X-Papermon-Pass/i);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://findastra.github.io');
});

test("the pass's spending leaves friends' $2 alone, and the pass has its own stop", async () => {
  side.addSpend(today, 24.8, 'pass: words for PMC0000001');
  assert.equal((await health()).newCardsToday, true, "friends still have their $2");
  assert.equal((await draw('r-pass-test-spender', {'X-Papermon-Pass': pass})).need, undefined, 'the pass stopped at its own $25');
  side.addSpend(today, 1.9, 'words for PMC0000002');
  assert.equal((await health()).newCardsToday, false, "friends' $2 is spent");
  assert.equal(side.passSpentOn(today), 24.8);
});
