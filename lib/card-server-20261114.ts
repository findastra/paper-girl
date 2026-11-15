// Papermon's card server, seen from the page (Astra, 2026-11-14: friends draw brand-new cards and say whether they are
// good; she sees every card in the Card Catalog). The server runs on Astra's PC (server/papermon-server-20261114.mjs).
// When the page can't reach it (no address in this build, or the PC is asleep), everything here quietly says no and
// the page works as before: starter cards, real papers, thumbs and reports kept in this browser.
import {useEffect, useState, useSyncExternalStore} from 'react';
import sample from '@/lib/data/sample-deck-20261114.json';
import type {Card} from '@/components/my-deck-20261114';
import type {Paper} from '@/lib/science';
import {base} from '@/lib/edition';

const env = ((import.meta as unknown as {env?: Record<string, string | undefined>}).env) || {};

/**
 * Where the server answers. Set at build time (VITE_PAPERMON_SERVER, the tunnel's address). On Astra's PC,
 * ?server=http://127.0.0.1:PORT points a working copy at a local server; nothing but a loopback address is accepted,
 * so a link can't send anyone's thumbs or reports somewhere else.
 */
export const SERVER = (() => {
  let s = env.VITE_PAPERMON_SERVER || '';
  try { const q = new URLSearchParams(window.location.search).get('server'); if (q && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(q)) s = q; } catch {}
  return s.replace(/\/+$/, '');
})();

/** This browser's anonymous Papermon id: no name or email, just enough to count five draws a day. */
export function readerId() {
  const KEY = 'papermon:reader:v1';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = 'r-' + crypto.randomUUID(); localStorage.setItem(KEY, id); }
    return id;
  } catch { return 'r-' + Math.random().toString(36).slice(2, 14); }
}

async function call<T>(path: string, init?: RequestInit, ms = 15000): Promise<T & {error?: string; http: number}> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(SERVER + path, {...init, signal: ctl.signal, headers: {'Content-Type': 'application/json', ...(init?.headers || {})}});
    const data = (await res.json().catch(() => ({}))) as T & {error?: string};
    return {...data, http: res.status};
  } finally { clearTimeout(timer); }
}

type Health = {ok?: boolean; catalog?: boolean};
let health: Promise<Health> | null = null, upAt = 0;
function checkHealth(): Promise<Health> {
  if (!SERVER) return Promise.resolve({});
  if (health && Date.now() - upAt < 60e3) return health;
  upAt = Date.now();
  health = call<Health>('/api/health', undefined, 4000).catch(() => ({}));
  return health;
}
/** Whether the server answers right now (asked at most once a minute). */
export function serverUp(): Promise<boolean> {
  return checkHealth().then(h => !!h.ok);
}

export type DrawAnswer = {http: number; card?: Card | null; job?: string; need?: 'paper'; reason?: 'budget'; limit?: boolean; error?: string; relaxed?: boolean};

/** Ask the server for a card: one from the catalog, or {need: 'paper'}; with a pmcid, that paper's card (maybe a new one). */
export function drawOnServer(o: {subject: string; lv: number; pmcid?: string}): Promise<DrawAnswer> {
  const have = drawnCards().map(c => c.no).concat((sample as Card[]).map(c => c.no));
  return call<DrawAnswer>('/api/draw', {method: 'POST', body: JSON.stringify({reader: readerId(), subject: o.subject, lv: o.lv, have, pmcid: o.pmcid})});
}

/** Wait for a new card while Claude writes and OpenAI draws (about a minute), reporting each step. */
export async function waitForCard(job: string, onStep: (text: string) => void): Promise<Card> {
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await call<{status: string; step?: string; card?: Card}>(`/api/jobs/${job}`).catch(() => null);
    if (!r) continue;
    if (r.status === 'done' && r.card) return r.card;
    if (r.status === 'failed' || r.error) throw new Error(r.error || 'The card could not be made.');
    if (r.step) onStep(r.step);
  }
  throw new Error('The card is taking too long. Try again later.');
}

/**
 * A thumb on a card (1 up, -1 down, 0 taken back), with the reason for a thumbs down and an optional one-line note
 * (Astra, 2026-11-14: thumbs + reason + note). Resolves true when Astra's server has it.
 */
export async function sendVote(no: string, thumb: 0 | 1 | -1, reason?: string, note?: string): Promise<boolean> {
  if (!SERVER || !(await serverUp())) return false;
  const r = await call<{ok?: boolean}>('/api/vote', {method: 'POST', body: JSON.stringify({reader: readerId(), no, thumb, reason, note})}).catch(() => null);
  return !!r?.ok;
}

/** The reasons a thumbs down can give; the server accepts only these. */
export const DOWN_REASONS = ['Wrong about the science', 'Hard to follow', 'Boring', "Picture doesn't fit", 'Other'] as const;

export type Tally = {up: number; down: number};
/**
 * The Card Catalog as friends see it (Astra, 2026-11-14: everyone sees every card and its thumbs counts; notes, reports
 * and who made what stay hers). Null when the server can't be reached.
 */
export async function fetchCatalog(): Promise<{cards: Card[]; tallies: Record<string, Tally>} | null> {
  if (!SERVER || !(await serverUp())) return null;
  const r = await call<{cards?: Card[]; tallies?: Record<string, Tally>}>('/api/catalog').catch(() => null);
  return r && r.http === 200 && Array.isArray(r.cards) ? {cards: r.cards, tallies: r.tallies || {}} : null;
}

/**
 * True when the server answers and Astra has made the Card Catalog public; false otherwise, null while asking.
 * Astra, 2026-11-14: friends see only the cards they drew or were traded, so it is private unless she turns it on.
 */
export function useCatalogOpen(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(SERVER ? null : false);
  useEffect(() => { let live = true; checkHealth().then(h => { if (live) setOk(!!h.ok && !!h.catalog); }); return () => { live = false; }; }, []);
  return ok;
}

/** "Report a problem" or "I wrote this paper". Resolves true when Astra's server has it. */
export async function sendMessage(kind: 'report' | 'author', no: string, fields: Record<string, string>): Promise<boolean> {
  if (!SERVER || !(await serverUp())) return false;
  const r = await call<{ok?: boolean}>('/api/message', {method: 'POST', body: JSON.stringify({reader: readerId(), kind, no, fields})}).catch(() => null);
  return !!r?.ok;
}

// ---------------------------------------------------------------------------------------------------------------
// The cards this browser drew from the server, kept beside the five starter cards in My deck.

const DRAWN_KEY = 'papermon:drawn:v1', DRAWN_EVENT = 'papermon-drawn';
const starters = sample as Card[];
let cache: {raw: string | null; list: Card[]} = {raw: null, list: starters};

function drawnCards(): Card[] {
  try { return JSON.parse(localStorage.getItem(DRAWN_KEY) || '[]'); } catch { return []; }
}
/** Starter cards plus every card drawn here, one per card number. */
function deckSnapshot(): Card[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(DRAWN_KEY); } catch {}
  if (raw === cache.raw) return cache.list;
  const seen = new Set(starters.map(c => c.no));
  const extra = drawnCards().filter(c => c && c.no && !seen.has(c.no) && (seen.add(c.no), true));
  cache = {raw, list: [...starters, ...extra]};
  return cache.list;
}
export function addDrawn(card: Card) {
  if (starters.some(c => c.no === card.no)) return;
  const list = drawnCards().filter(c => c.no !== card.no);
  list.push(card);
  try { localStorage.setItem(DRAWN_KEY, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new Event(DRAWN_EVENT));
}
function onDeckChange(cb: () => void) {
  window.addEventListener(DRAWN_EVENT, cb); window.addEventListener('storage', cb);
  return () => { window.removeEventListener(DRAWN_EVENT, cb); window.removeEventListener('storage', cb); };
}
/** Every card in this browser's deck: the five starters, then the ones drawn from the server. */
export function useDeckCards(): Card[] {
  return useSyncExternalStore(onDeckChange, deckSnapshot, () => starters);
}

/** A card's picture: starter pictures ship with the site; new ones come from the server. */
export function artSrc(art: string) {
  if (/^https?:\/\//.test(art)) return art;
  if (art.startsWith('/art/')) return SERVER + art;
  return `${base}art/${art}`;
}

/** The paper behind a server card, for the write-up and More information when this page has no copy of it. */
export function paperOf(card: Card): Paper {
  const s = card.source || {};
  return {
    pmcid: card.pmcid, pmid: '', doi: s.doi || '', title: s.title || card.headline, authors: s.authors || '',
    journal: s.journal || card.src.replace(/\s*\d{4}$/, ''), year: Number(s.year) || Number((card.published || '').slice(0, 4)) || 0,
    publicationDate: card.published || '', articleUrl: card.url, fullTextUrl: `https://europepmc.org/article/PMC/${card.pmcid}`,
    summaryLabel: 'Papermon write-up', summaryParagraphs: [card.paper?.hook, card.paper?.found, card.paper?.matters].filter((x): x is string => !!x),
    abstract: '', licenseUrl: s.license || 'https://creativecommons.org/licenses/by/4.0/', copyright: s.authors || '',
    headline: card.headline, hook: card.hook, explanation: card.found, importance: card.matters, discipline: card.subject,
  };
}
