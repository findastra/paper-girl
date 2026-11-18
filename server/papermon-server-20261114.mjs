// Papermon's card server (Astra, 2026-11-14: "I want to send this link to my friends so they can start generating cards
// and then tell me if these cards are good or bad. And I want to see these cards that my friends generate.")
//
// - Friends keep using the normal Papermon page. When it can reach this server, Draw Card asks here first: a card from
//   the Card Catalog that fits and that the friend doesn't have yet (free), or a brand-new card made from a fresh paper
//   (Claude writes, OpenAI draws), up to the day's budget. Five draws a day per person, counted here too.
// - Every card goes into the Card Catalog (catalog-20261114.mjs), the library of every card ever made.
// - Thumbs, reasons, notes, "Report a problem" and "I wrote this paper" land here instead of staying in one browser.
// - Astra's own page, /owner, shows everything; it opens only on this PC, with the owner key.
//
// Listens on 127.0.0.1 only. A tunnel (deck Q1) carries friends' requests here; nothing else on the PC is reachable.
//   Start: npm start (in this folder), with the keys in the environment. docs/card-server-20261114.md has the details.
import http from 'node:http';
import {readFileSync, writeFileSync, existsSync, createReadStream, mkdirSync} from 'node:fs';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';
import {openCatalog, cardNumber, numberOf} from './catalog-20261114.mjs';
import {makeCard, writeWithClaude, drawWithOpenAI, CardError, CARD_ESTIMATE_USD, SUBJECTS, WRITER_MODEL, ARTIST_MODEL} from './card-maker-20261114.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const env = process.env;
// Astra's PC data folder (never the repo). The catalog, the card pictures and the owner key live here.
const DATA = env.PAPERMON_DATA || join(env.USERPROFILE || env.HOME || '.', 'Documents', "Astra's PetOS Data", 'papermon');
const CONFIG = {
  port: Number(env.PAPERMON_PORT || 8830),
  draws: Number(env.PAPERMON_DRAWS_PER_DAY || 5),             // decided: five draws a day per person
  drawsPerNetwork: Number(env.PAPERMON_DRAWS_PER_NETWORK || 15), // one household or a person clearing their browser
  budget: Number(env.PAPERMON_DAILY_BUDGET_USD || 2),          // Astra, 2026-11-14: $2 a day to start (about 8 new cards)
  writer: env.PAPERMON_WRITER || 'claude',                     // 'claude' (decided) or 'dry' for local tests only
  // Astra, 2026-11-14: friends see only the cards they drew or were traded, so the full list is hers alone unless set to 1
  publicCatalog: env.PAPERMON_PUBLIC_CATALOG === '1',
  origins: (env.PAPERMON_ORIGINS || 'https://findastra.github.io,http://127.0.0.1:8813').split(',').map(s => s.trim()).filter(Boolean),
  timeZone: 'America/Denver',
};
// The OpenAI key's new name (PR #19's rename) first, then the name API Fairy filed it under.
const KEYS = {anthropic: env.PAPER_GIRL_ANTHROPIC_API_KEY || '', openai: env.PAPERMON_PATTY_OPENAI_API_KEY || env.PAPERGIRL_PATTY_OPENAI_API_KEY || ''};

mkdirSync(DATA, {recursive: true});
const ART = join(DATA, 'art');
const local = loadLocalConfig();
const catalog = openCatalog(join(DATA, 'papermon-catalog-20261114.sqlite'));
seedStarters();

// ---------------------------------------------------------------------------------------------------------------

function loadLocalConfig() {
  const file = join(DATA, 'papermon-server-20261114.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  // The owner key opens /owner; the salt makes network hashes useless outside this PC. Neither goes anywhere else.
  const fresh = {ownerKey: randomBytes(18).toString('base64url'), salt: randomBytes(18).toString('base64url')};
  writeFileSync(file, JSON.stringify(fresh, null, 2));
  return fresh;
}

/** The starter cards (made by hand on 2026-11-14; ten since PR #21) keep their numbers, so new cards follow them. */
function seedStarters() {
  if (catalog.count()) return;
  const starters = JSON.parse(readFileSync(join(HERE, '..', 'lib', 'data', 'sample-deck-20261114.json'), 'utf8'));
  for (const c of starters) catalog.add({...c, no: numberOf(c.no)}, {writer: 'starter', artist: 'gpt-image-2', cost: 0, reader: null});
}

const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: CONFIG.timeZone}).format(new Date());
const spentToday = () => catalog.spentOn(today());
const budgetLeft = () => Math.max(0, CONFIG.budget - spentToday());
// Always a real true/false: `a && b` hands back b itself, and /api/health is public, so a key must never be the answer
// (2026-11-17: before this, the health check sent the OpenAI key to anyone who asked).
const haveKeys = () => Boolean(KEYS.anthropic) && Boolean(KEYS.openai);
const canMakeNew = () => budgetLeft() >= CARD_ESTIMATE_USD && (CONFIG.writer === 'dry' || haveKeys());

function networkOf(req) {
  // Behind the tunnel the visitor's address arrives in X-Forwarded-For; only a salted hash is kept.
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  return createHash('sha256').update(local.salt + ip).digest('hex').slice(0, 24);
}

/** True only for a request typed on this PC (not one that came through the tunnel). */
function fromThisPC(req) {
  const host = String(req.headers.host || '');
  const addr = req.socket.remoteAddress || '';
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) && /^(::ffff:)?127\.0\.0\.1$|^::1$/.test(addr)
    && !req.headers['x-forwarded-for'] && !req.headers['tailscale-funnel-request'];
}

function ownerOK(req, url) {
  const given = Buffer.from(String(url.searchParams.get('key') || req.headers['x-papermon-owner'] || ''));
  const want = Buffer.from(local.ownerKey);
  return fromThisPC(req) && given.length === want.length && timingSafeEqual(given, want);
}

// ---------------------------------------------------------------------------------------------------------------
// New cards: one job each, so the page can show the steps while Claude writes and OpenAI draws (about a minute).

const jobs = new Map();
let making = 0;
const MAX_AT_ONCE = 2;

function startJob({pmcid, reader, who}) {
  const id = randomBytes(9).toString('base64url');
  const job = {id, status: 'working', step: 'Starting…', reader, pmcid, created: Date.now()};
  jobs.set(id, job);
  making++;
  // The number is taken when the card is saved, so two cards made at once never share one.
  const write = CONFIG.writer === 'dry' ? dryWrite : paper => writeWithClaude(paper, {apiKey: KEYS.anthropic});
  const draw = CONFIG.writer === 'dry' ? dryDraw : drawing => drawWithOpenAI(drawing, {apiKey: KEYS.openai});
  let cost = 0;
  makeCard(pmcid, {
    number: catalog.nextNumber() + making - 1, artDir: ART, today: today(), write, draw,
    spend: (usd, what) => { if (usd > 0) { cost += usd; catalog.addSpend(today(), usd, what); } },
    step: text => { job.step = text; },
  }).then(({card}) => {
    const existing = catalog.byPmcid(pmcid);   // another friend may have drawn the same paper meanwhile
    if (existing) { job.card = existing; } else {
      const no = catalog.nextNumber();
      catalog.add({...card, no}, {writer: CONFIG.writer === 'dry' ? 'dry-test' : WRITER_MODEL, artist: CONFIG.writer === 'dry' ? 'starter art' : ARTIST_MODEL, cost, reader});
      job.card = catalog.byNumber(no);
    }
    // A draw counts once the card is in the friend's hands; a failed card costs them nothing.
    catalog.recordDraw({reader, who, day: today(), no: numberOf(job.card.no), kind: 'new'});
    job.status = 'done';
    log(`card ${job.card.no} made from ${pmcid} for ${reader.slice(0, 8)}; spent today $${spentToday().toFixed(2)}`);
  }).catch(e => {
    job.status = 'failed';
    job.error = e instanceof CardError ? e.message : 'Something went wrong making the card.';
    job.retry = e instanceof CardError && e.paper === true;   // this paper only: the page tries another one
    log(`card from ${pmcid} failed: ${e.message}`);
  }).finally(() => { making--; setTimeout(() => jobs.delete(id), 30 * 60e3); });
  return job;
}

// A free stand-in writer for trying the server on this PC: no AI, no money. Never used for friends.
async function dryWrite(paper) {
  const first = s => (s.split(/(?<=[.!?])\s+/)[0] || s).slice(0, 150);
  const para = paper.abstract.slice(0, 600) || 'No abstract.';
  return {usd: 0, words: {
    name: 'Untested Practice Card', headline: first(paper.title), hook: 'A test card made without any AI.',
    found: first(paper.abstract) || 'See the paper.', matters: 'It shows the card server working end to end.',
    subject: 'Biology', lv: 2, paper: {hook: para, found: para, matters: para},
    drawing: {slug: 'practice-card', subject: 'a placeholder', scene: 'Background: none.'},
    cite: `${paper.authorString} "${paper.title}" *${paper.journal}*, ${paper.year}, https://doi.org/${paper.doi}.`,
  }};
}
async function dryDraw() {
  return {usd: 0, ext: 'webp', bytes: readFileSync(join(HERE, '..', 'public', 'art', 'cards', 'bat-pup-e-20261114.webp'))};
}

// ---------------------------------------------------------------------------------------------------------------
// Routes

const READER = /^[a-z0-9-]{8,64}$/i;
const REASONS = ['Wrong about the science', 'Hard to follow', 'Boring', "Picture doesn't fit", 'Other'];
const short = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

async function route(req, res, url) {
  const path = url.pathname;
  if (req.method === 'GET' && path === '/api/health') {
    return send(res, 200, {ok: true, catalog: CONFIG.publicCatalog === true, cards: catalog.count(), newCardsToday: canMakeNew() === true, drawsPerDay: CONFIG.draws, writer: CONFIG.writer === 'dry' ? 'dry' : 'claude'});
  }

  if (req.method === 'POST' && path === '/api/draw') {
    const b = await body(req);
    const reader = String(b.reader || '');
    if (!READER.test(reader)) return send(res, 400, {error: 'This browser has no Papermon id yet. Reload the page.'});
    const subject = SUBJECTS[b.subject] ? b.subject : '';
    const lv = [1, 2, 3, 4].includes(b.lv) ? b.lv : 0;
    const have = Array.isArray(b.have) ? b.have.slice(0, 2000) : [];
    const who = networkOf(req), day = today();
    const used = catalog.drawsToday(day, reader, who);
    if ((used.byReader || 0) >= CONFIG.draws || (used.byWho || 0) >= CONFIG.drawsPerNetwork) {
      return send(res, 429, {error: `That's all ${CONFIG.draws} draws for today. New draws at midnight.`, limit: true});
    }
    // The same paper always gives the same card.
    if (typeof b.pmcid === 'string' && b.pmcid) {
      const known = catalog.byPmcid(b.pmcid);
      if (known) { catalog.recordDraw({reader, who, day, no: numberOf(known.no), kind: 'catalog'}); return send(res, 200, {card: known, from: 'catalog'}); }
      if (!canMakeNew()) return send(res, 200, {card: null, reason: 'budget'});
      if (making >= MAX_AT_ONCE) return send(res, 503, {error: 'Two cards are being made right now. Try again in a minute.'});
      for (const j of jobs.values()) if (j.reader === reader && j.status === 'working') return send(res, 409, {error: 'Your last card is still being made.', job: j.id});
      const job = startJob({pmcid: b.pmcid, reader, who});
      return send(res, 202, {job: job.id, step: job.step});
    }
    // Reuse first: a catalog card that fits and that this friend doesn't hold yet (card plan: reuse saves money).
    const fit = catalog.pick({subject, lv, have});
    if (fit) { catalog.recordDraw({reader, who, day, no: numberOf(fit.no), kind: 'catalog'}); return send(res, 200, {card: fit, from: 'catalog'}); }
    if (canMakeNew()) return send(res, 200, {need: 'paper'});
    // Out of money for today: any catalog card this friend doesn't have, whatever its subject and difficulty.
    const any = catalog.pick({subject: '', lv: 0, have});
    if (any) { catalog.recordDraw({reader, who, day, no: numberOf(any.no), kind: 'catalog'}); return send(res, 200, {card: any, from: 'catalog', relaxed: true}); }
    return send(res, 200, {card: null, reason: 'budget'});
  }

  const jobMatch = path.match(/^\/api\/jobs\/([A-Za-z0-9_-]{6,40})$/);
  if (req.method === 'GET' && jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) return send(res, 404, {error: 'That card job is gone. Draw again.'});
    return send(res, 200, {status: job.status, step: job.step, card: job.card, error: job.error, retry: job.retry === true});
  }

  if (req.method === 'GET' && path === '/api/catalog') {
    if (!CONFIG.publicCatalog) return send(res, 403, {error: 'The Card Catalog is private.'});
    return send(res, 200, {cards: catalog.all(), tallies: catalog.tallies()});
  }

  if (req.method === 'POST' && path === '/api/vote') {
    const b = await body(req);
    const no = numberOf(b.no);
    if (!READER.test(String(b.reader || '')) || !catalog.byNumber(no)) return send(res, 400, {error: 'Unknown card.'});
    const thumb = b.thumb === 1 || b.thumb === -1 ? b.thumb : 0;
    const reason = REASONS.includes(b.reason) ? b.reason : null;
    catalog.vote({reader: b.reader, no, thumb, reason: thumb === -1 ? reason : null, note: short(b.note, 280) || null});
    return send(res, 200, {ok: true});
  }

  if (req.method === 'POST' && path === '/api/message') {
    const b = await body(req);
    if (!READER.test(String(b.reader || '')) || !['report', 'author'].includes(b.kind)) return send(res, 400, {error: 'Unknown message.'});
    const fields = b.fields && typeof b.fields === 'object' ? b.fields : {};
    const kept = Object.fromEntries(Object.entries(fields).slice(0, 8).map(([k, v]) => [short(k, 40), short(v, 2000)]));
    catalog.addMessage({kind: b.kind, no: numberOf(b.no) || null, reader: b.reader, body: kept});
    return send(res, 200, {ok: true});
  }

  // New cards' pictures from the data folder; the starters' from the repo (public/art/cards).
  const art = path.match(/^\/art\/(cards\/)?([a-z0-9-]+\.(webp|png))$/);
  if (req.method === 'GET' && art) {
    const [, starter, name, ext] = art;
    const file = starter ? join(HERE, '..', 'public', 'art', 'cards', basename(name)) : join(ART, basename(name));
    if (!existsSync(file)) return send(res, 404, {error: 'No such picture.'});
    res.writeHead(200, {'Content-Type': ext === 'png' ? 'image/png' : 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', ...cors(req)});
    return createReadStream(file).pipe(res);
  }

  if (req.method === 'GET' && (path === '/owner' || path === '/api/owner')) {
    if (!ownerOK(req, url)) return send(res, 403, {error: 'This page opens only on Astra\'s PC.'});
    if (path === '/owner') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'});
      return res.end(readFileSync(join(HERE, 'owner-page-20261114.html')));
    }
    return send(res, 200, {
      config: {budget: CONFIG.budget, draws: CONFIG.draws, writer: CONFIG.writer, publicCatalog: CONFIG.publicCatalog, keys: {claude: !!KEYS.anthropic, openai: !!KEYS.openai}},
      today: today(), spentToday: spentToday(), spend: catalog.spendByDay(),
      cards: catalog.allForOwner(), tallies: catalog.tallies(), votes: catalog.votes(), messages: catalog.messages(),
    });
  }

  return send(res, 404, {error: 'Not here.'});
}

// ---------------------------------------------------------------------------------------------------------------

function cors(req) {
  const origin = String(req.headers.origin || '');
  return CONFIG.origins.includes(origin) ? {'Access-Control-Allow-Origin': origin, Vary: 'Origin'} : {};
}

function send(res, status, data) {
  if (res.headersSent) return;
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...res.corsHeaders});
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const parts = [];
    req.on('data', c => { size += c.length; if (size > 64 * 1024) { reject(new CardError('Too much data.', 413)); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch { reject(new CardError('That was not JSON.', 400)); } });
    req.on('error', reject);
  });
}

const log = s => console.log(`[${new Date().toISOString()}] ${s}`);

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  res.corsHeaders = cors(req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {...res.corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600'});
    return res.end();
  }
  try { await route(req, res, url); }
  catch (e) { send(res, e instanceof CardError ? e.status : 500, {error: e instanceof CardError ? e.message : 'Something went wrong.'}); if (!(e instanceof CardError)) log(e.stack || e.message); }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(CONFIG.port, '127.0.0.1', () => {
    log(`Papermon card server on http://127.0.0.1:${CONFIG.port} (loopback only)`);
    log(`catalog: ${catalog.count()} cards · writer: ${CONFIG.writer} · keys: Claude ${KEYS.anthropic ? 'yes' : 'NO'}, OpenAI ${KEYS.openai ? 'yes' : 'NO'} · budget $${CONFIG.budget}/day`);
    log(`Astra's page: http://127.0.0.1:${CONFIG.port}/owner?key=${local.ownerKey}`);
  });
}

export {cardNumber};
