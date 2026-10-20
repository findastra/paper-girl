// The static edition's library. On Cloudflare, /api/* is served by the Worker with a shared D1 index and a shared
// search history. GitHub Pages has no server, so this module answers the same requests inside the browser:
// discovery and the article index query Europe PMC directly (it allows cross-origin requests), and the reading
// history and search history are kept in this browser's localStorage. The UI code is identical in both editions.
import { API, eligible, libraryGet, LibraryError, parsePublisherXml, type RecordData } from './publisher';
import { buildQuery, dayKey, defaultFilters, type Filters, type Paper } from './science';

type SearchResult = {hitCount: number; nextCursorMark?: string; resultList?: {result?: RecordData[]}};
type HistoryItem = {id: string; filters: Filters; pmcid: string | null; title: string | null; journal: string | null; outcome: string; message: string | null; created_at: number};
type Store = {visits: string[]; history: HistoryItem[]; checked: Record<string, 'ready' | 'unavailable'>};

const STORE_KEY = 'paper-girl:library:v1';
const PAGE = 30;
let memory: Store | null = null;

function store(): Store {
  if (memory) return memory;
  let saved: Partial<Store> = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { /* storage blocked or corrupt: start fresh */ }
  memory = {
    visits: Array.isArray(saved.visits) ? saved.visits : [],
    history: Array.isArray(saved.history) ? saved.history : [],
    checked: saved.checked && typeof saved.checked === 'object' ? saved.checked : {},
  };
  return memory;
}

function save() {
  const s = store();
  s.visits = s.visits.slice(-5000);
  s.history = s.history.slice(0, 500);
  const checked = Object.entries(s.checked);
  if (checked.length > 3000) s.checked = Object.fromEntries(checked.slice(-3000));
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* private browsing: keep it for this visit only */ }
}

function remember(entry: HistoryItem) {
  store().history.unshift(entry);
  save();
}

async function search(query: string, options: {pageSize: number; sort?: string; cursor?: string; core?: boolean}, signal?: AbortSignal) {
  const params = new URLSearchParams({format: 'json', resultType: options.core ? 'core' : 'lite', pageSize: String(options.pageSize), query});
  if (options.sort) params.set('sort', options.sort);
  if (options.cursor) params.set('cursorMark', options.cursor);
  const response = await libraryGet(`${API}/search?${params}`, signal);
  if (!response) throw new LibraryError('The journal library could not be reached. Please try again.');
  return await response.json() as SearchResult;
}

function shuffled<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

const strip = (s = '') => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function verify(record: RecordData, signal: AbortSignal): Promise<Paper | null> {
  const s = store();
  const xml = await libraryGet(`${API}/${record.pmcid}/fullTextXML`, signal);
  // Europe PMC titles can carry inline markup such as <i>; the headline and history show plain text.
  const paper = xml ? parsePublisherXml(await xml.text(), {...record, title: strip(record.title)}) : null;
  s.checked[record.pmcid] = paper ? 'ready' : 'unavailable';
  return paper;
}

/** Picks an unread paper that matches the filters and has a publisher summary under CC BY. */
async function selectPaper(filters: Filters, current: string, exclude: string[], signal?: AbortSignal): Promise<Paper> {
  const query = buildQuery(filters);
  const [, start, end] = query.match(/FIRST_PDATE:\[([^ ]+) TO ([^\]]+)\]/)!;
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000);
  const s = store();
  const seen = new Set([...s.visits, ...exclude, current]);
  const usable = (r: RecordData) => eligible(r) && !seen.has(r.pmcid) && s.checked[r.pmcid] !== 'unavailable';

  // Sample the dates that actually contain research. Starting every draw in 1900 heavily
  // favored the first few papers from these much newer journals.
  const [oldest, newest] = await Promise.all([
    search(query, {pageSize: 1, core: true, sort: 'FIRST_PDATE_D asc'}, deadline),
    search(query, {pageSize: 1, core: true, sort: 'FIRST_PDATE_D desc'}, deadline),
  ]);
  const total = oldest.hitCount;
  if (!total) throw new LibraryError('No papers match these filters yet. Try another subject or a wider date range.', 404);

  // Small result sets are read whole. Large ones are sampled by jumping to a random publication date and reading
  // forwards or backwards from it, which needs no server-side index.
  const rounds: (() => Promise<RecordData[]>)[] = [];
  if (total <= 300) {
    rounds.push(async () => (await search(query, {pageSize: 300, core: true}, deadline)).resultList?.result || []);
  } else {
    const firstDate = Date.parse(oldest.resultList?.result?.[0]?.firstPublicationDate || start);
    const lastDate = Date.parse(newest.resultList?.result?.[0]?.firstPublicationDate || end);
    const t0 = Math.max(Date.parse(start), Number.isFinite(firstDate) ? firstDate : Date.parse(start));
    const t1 = Math.max(t0, Math.min(Date.parse(end), Number.isFinite(lastDate) ? lastDate : Date.parse(end)));
    for (let i = 0; i < 4; i++) rounds.push(async () => {
      const pivot = dayKey(new Date(t0 + Math.random() * (t1 - t0)));
      const forward = i % 2 === 0;
      const window = forward ? `FIRST_PDATE:[${pivot} TO ${end}]` : `FIRST_PDATE:[${start} TO ${pivot}]`;
      const q = query.replace(/FIRST_PDATE:\[[^\]]+\]/, window);
      return (await search(q, {pageSize: 25, core: true, sort: forward ? 'FIRST_PDATE_D asc' : 'FIRST_PDATE_D desc'}, deadline)).resultList?.result || [];
    });
    // A draw may land on already-read papers. Walk a few real cursor pages as a fallback
    // instead of interpreting those repeated samples as an exhausted collection.
    let cursor: string | undefined = '*';
    for (let i = 0; i < 3; i++) rounds.push(async () => {
      if (!cursor) return [];
      const data = await search(query, {pageSize: PAGE, core: true, sort: 'FIRST_PDATE_D desc', cursor}, deadline);
      cursor = data.nextCursorMark && data.nextCursorMark !== cursor ? data.nextCursorMark : undefined;
      return data.resultList?.result || [];
    });
  }

  let anyUnread = false;
  const attempted = new Set<string>();
  const maxChecks = total <= 300 ? total : 90;
  for (const round of rounds) {
    deadline.throwIfAborted();
    if (attempted.size >= maxChecks) break;
    const pool = shuffled((await round()).filter(r => usable(r) && !attempted.has(r.pmcid)));
    if (pool.length) anyUnread = true;
    for (let i = 0; i < pool.length && attempted.size < maxChecks; i += 3) {
      deadline.throwIfAborted();
      const batch = pool.slice(i, i + Math.min(3, maxChecks - attempted.size));
      batch.forEach(r => attempted.add(r.pmcid));
      const results = await Promise.allSettled(batch.map(r => verify(r, deadline)));
      deadline.throwIfAborted();
      const paper = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])[0];
      save();
      if (paper) return paper;
      // An unavailable service is retryable; it does not mean these papers lack a summary.
      const failed = results.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
    }
  }
  if (!anyUnread) throw new LibraryError('This search did not find an unread paper. Try again, another subject, or a wider date range.', 404);
  throw new LibraryError('Those candidates did not have a usable publisher summary. Try another search; your current paper is safe.', 404);
}

let collectionSize = 0;
async function indexStatus() {
  if (!collectionSize) collectionSize = (await search(buildQuery(defaultFilters), {pageSize: 1})).hitCount;
  const s = store();
  const ready = Object.values(s.checked).filter(v => v === 'ready').length;
  return {indexed: collectionSize, ready, total: collectionSize, scanned: collectionSize, complete: true, updatedAt: Date.now(), searches: s.history.length};
}

// Europe PMC pages with cursor marks, so each query remembers the mark for every 30-row page it has reached.
const cursorMarks = new Map<string, string[]>();
async function catalogPage(text: string, offset: number) {
  let query = buildQuery(defaultFilters);
  const words = text.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (/^PMC\d+$/i.test(words)) query += ` AND PMCID:${words.toUpperCase()}`;
  else if (words) query += ` AND (TITLE:(${words}) OR JOURNAL:"${words}")`;
  const page = Math.floor(offset / PAGE);
  const marks = cursorMarks.get(query) || ['*'];
  cursorMarks.set(query, marks);
  const options = {pageSize: PAGE, sort: 'FIRST_PDATE_D desc'};
  while (marks.length <= page) {
    const step = await search(query, {...options, cursor: marks[marks.length - 1]});
    if (!step.nextCursorMark || step.nextCursorMark === marks[marks.length - 1]) break;
    marks.push(step.nextCursorMark);
  }
  const data = await search(query, {...options, cursor: marks[Math.min(page, marks.length - 1)]});
  if (data.nextCursorMark && marks.length === page + 1) marks.push(data.nextCursorMark);
  const checked = store().checked;
  const items = (data.resultList?.result || []).map(r => ({
    pmcid: r.pmcid, title: strip(r.title), journal: r.journalTitle || r.journalInfo?.journal?.title || '', year: Number(r.pubYear),
    state: checked[r.pmcid] || 'pending', url: r.doi ? `https://doi.org/${encodeURI(r.doi)}` : `https://europepmc.org/articles/${r.pmcid}`,
  }));
  return {items, total: data.hitCount, offset};
}

function historyPage(text: string, offset: number) {
  const needle = text.toLowerCase();
  const matches = store().history.filter(h => !needle || (h.title || '').toLowerCase().includes(needle) || JSON.stringify(h.filters).toLowerCase().includes(needle));
  return {items: matches.slice(offset, offset + PAGE), total: matches.length, offset};
}

async function discover(body: unknown, signal?: AbortSignal) {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!b.filters || typeof b.filters !== 'object') throw new LibraryError('Choose valid filters.', 400);
  const filters = {...defaultFilters, ...b.filters as Partial<Filters>};
  if (Object.entries(filters).some(([k, v]) => k === 'humans' ? typeof v !== 'boolean' : typeof v !== 'string')) throw new LibraryError('Choose valid filters.', 400);
  try { buildQuery(filters); } catch (e) { throw new LibraryError(e instanceof Error ? e.message : 'Choose valid filters.', 400); }
  const current = typeof b.current === 'string' && /^PMC\d+$/.test(b.current) ? b.current : '';
  const exclude = Array.isArray(b.exclude) ? b.exclude.filter((p): p is string => typeof p === 'string' && /^PMC\d+$/.test(p)).slice(0, 100) : [];
  const id = typeof b.requestId === 'string' ? b.requestId : crypto.randomUUID();
  try {
    const paper = await selectPaper(filters, current, exclude, signal);
    store().visits.push(paper.pmcid);
    remember({id, filters, pmcid: paper.pmcid, title: paper.title, journal: paper.journal, outcome: 'success', message: null, created_at: Date.now()});
    return {paper, replayed: false};
  } catch (error) {
    if (signal?.aborted) throw error;
    const known = error instanceof LibraryError;
    const message = known ? error.message : 'The journal library is taking too long. Please try again; your current paper is still here.';
    remember({id, filters, pmcid: null, title: null, journal: null, outcome: known && error.status === 404 ? 'no_match' : 'error', message, created_at: Date.now()});
    throw known ? error : new LibraryError(message);
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});

async function route(path: string, init: RequestInit | undefined) {
  const url = new URL(path, location.origin);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
  const n = Number(url.searchParams.get('offset') || 0);
  const offset = Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 10000) : 0;
  const signal = init?.signal || undefined;
  try {
    switch (url.pathname) {
      case '/api/discover': return json(await discover(JSON.parse(String(init?.body || '{}')), signal));
      case '/api/index': return json(await indexStatus());
      case '/api/catalog': return json(await catalogPage(q, offset));
      case '/api/history': return json(historyPage(q, offset));
      default: return json({error: 'Not found.'}, 404);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof LibraryError) return json({error: error.message}, error.status);
    return json({error: 'The journal library is unavailable right now. Please try again.'}, 503);
  }
}

/** Routes the app's /api/* requests to the in-browser library. Every other request goes to the network. */
export function installBrowserLibrary() {
  const network = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    typeof input === 'string' && input.startsWith('/api/') ? route(input, init) : network(input, init);
}
