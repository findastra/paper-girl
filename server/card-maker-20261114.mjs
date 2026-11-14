// Making one new Papermon card from one paper (Astra, 2026-11-14). Same steps the five starter cards went through by
// hand: read the paper from Europe PMC, have Claude write the card (the rules are docs/card-plan-20261113.md), have
// OpenAI draw its picture in style E, count the full article's read time, and cite it in MLA 9.
// "Claude writes, OpenAI draws" is card plan decision 2 and 4.
import Anthropic from '@anthropic-ai/sdk';
import {writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
export const WRITER_MODEL = process.env.PAPERMON_WRITER_MODEL || 'claude-opus-5-5';
export const ARTIST_MODEL = process.env.PAPERMON_ARTIST_MODEL || 'gpt-image-2';
// Prices checked 2026-11-14, dollars per million tokens: Claude Opus 5.5 (input, output, cache read, cache write) and
// gpt-image-2 (text in, image out). Used only to count the day's spend against the daily cap.
const PRICE = {claude: {in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5}, image: {in: 5, out: 30}};
/** What a new card is assumed to cost before it is made, to stop at the daily cap without going over. */
export const CARD_ESTIMATE_USD = 0.3;

// The 13 subjects (components/my-deck-20261114.tsx SUBJECT): what each covers; a paper that fits two goes in the
// more specific one.
export const SUBJECTS = {
  Biology: 'living things: animals, plants, cells, evolution',
  Psychology: 'the mind and behavior: thinking, memory, feelings, the brain at work',
  Chemistry: 'molecules, reactions and materials',
  'Earth science': 'the planet itself: rocks, oceans, weather, earthquakes, fossils',
  Physics: 'forces, energy, light and motion',
  Math: 'numbers, patterns, models and chance',
  Medicine: 'health and disease: patients, treatments, infections',
  Genetics: 'genes, DNA, heredity and mutations',
  Space: 'planets, stars and spaceflight',
  'Computer science': 'computers, code, algorithms and AI',
  Engineering: 'building things: devices, robots, sensors',
  'Social science': 'people and societies: economics, education, culture, language, the past',
  Environment: 'nature as a whole: ecosystems, climate, conservation, pollution',
};

const JOURNALS = /^elife$|^plos (biology|genetics|computational biology|pathogens|neglected tropical diseases)$/i;

export class CardError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}

// ---------------------------------------------------------------------------------------------------------------
// 1. The paper
// ---------------------------------------------------------------------------------------------------------------

/**
 * Europe PMC is sometimes slow or briefly down (2026-11-14: a full text the page had just read timed out here), so
 * each request gets 25 seconds and three tries. A 404 is final.
 */
async function epmc(url, fetchImpl) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchImpl(url, {signal: AbortSignal.timeout(25000)});
      if (res.ok || res.status === 404) return res;
      last = new Error(`Europe PMC answered ${res.status}`);
    } catch (e) { last = e; }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  throw new CardError('The journal library is slow right now. Try again in a moment.', 503);
}

/** The paper's details and full text from Europe PMC, or a CardError when Papermon may not use it. */
export async function fetchPaper(pmcid, fetchImpl = fetch) {
  if (!/^PMC\d{4,10}$/.test(pmcid)) throw new CardError('That is not a PubMed Central article id.', 400);
  const search = await epmc(`${EPMC}/search?query=PMCID:${pmcid}&resultType=core&format=json`, fetchImpl);
  if (!search.ok) throw new CardError('Europe PMC has no article with that id.', 404);
  const r = (await search.json()).resultList?.result?.[0];
  if (!r) throw new CardError('Europe PMC has no article with that id.', 404);
  const journal = r.journalInfo?.journal?.title || r.journalTitle || '';
  if (!JOURNALS.test(journal)) throw new CardError('Papermon only makes cards from eLife and the five PLOS journals it searches.');
  if (r.isOpenAccess !== 'Y') throw new CardError('That article is not open access.');
  const xmlRes = await epmc(`${EPMC}/${pmcid}/fullTextXML`, fetchImpl);
  if (!xmlRes.ok) throw new CardError('Europe PMC has no full text for that article.');
  const xml = await xmlRes.text();
  const licensed = /creativecommons\.org\/licenses\/by\/\d\.\d/i.test(xml) && !/licenses\/by-n[cd]/i.test(xml);
  if (!licensed) throw new CardError('That article is not under a CC BY license.');
  const words = bodyWords(xml);
  return {
    pmcid,
    doi: r.doi || '',
    title: clean(r.title || ''),
    authors: (r.authorList?.author || []).map(a => ({first: a.firstName || '', last: a.lastName || '', full: a.fullName || ''})),
    authorString: r.authorString || '',
    journal,
    volume: r.journalInfo?.volume || '',
    article: r.pageInfo || elocation(xml),
    year: Number(r.pubYear) || null,
    published: r.firstPublicationDate || (r.pubYear ? `${r.pubYear}-01-01` : ''),
    abstract: clean(stripTags(r.abstractText || '')),
    text: articleText(xml),
    readMinutes: Math.max(1, Math.round(words / 230)),
  };
}

/** Words in the article body and abstract, the way scripts/count-read-time-20261114.mjs counts them. */
export function bodyWords(xml) {
  const body = (xml.match(/<body[\s\S]*?<\/body>/) || [''])[0];
  const abstract = (xml.match(/<abstract[\s\S]*?<\/abstract>/) || [''])[0];
  const text = (abstract + ' ' + body)
    .replace(/<table-wrap[\s\S]*?<\/table-wrap>/g, ' ')
    .replace(/<xref[\s\S]*?<\/xref>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter(w => /[A-Za-z]/.test(w)).length;
}

/** The article as plain text for Claude: every abstract (the publisher's digest included) and the whole body. */
export function articleText(xml) {
  const abstracts = xml.match(/<abstract[\s\S]*?<\/abstract>/g) || [];
  const body = (xml.match(/<body[\s\S]*?<\/body>/) || [''])[0];
  return [...abstracts, body].join('\n\n')
    .replace(/<table-wrap[\s\S]*?<\/table-wrap>/g, '\n')
    .replace(/<xref[\s\S]*?<\/xref>/g, '')
    .replace(/<\/(p|title|sec|abstract)>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
}

const stripTags = s => s.replace(/<[^>]+>/g, ' ');
const clean = s => s.replace(/\s+/g, ' ').trim();
const elocation = xml => (xml.match(/<elocation-id>([^<]+)<\/elocation-id>/) || [, ''])[1];

// ---------------------------------------------------------------------------------------------------------------
// 2. The words (Claude)
// ---------------------------------------------------------------------------------------------------------------

const RULES = `You are Papermon's card writer. Papermon is a free trading-card game where every card is one real
scientific article, written so anyone can enjoy it. You read the whole article and write its card.

The card (short, read at card size):
- name: about three words, two adjectives and a noun, in real science words that recall what the paper did, not
  childish ones (the card is cute, the words are not). Examples from the first cards: "Discerning Solitary Salticid",
  "Babbling Sac-winged Pup", "Facilitative Weed-clipping Pika", "Synesthetic Pupillary Seven", "Statistical Neonatal
  Listener". Title Case.
- headline: one short, plain sentence that makes someone want to read on, e.g. "A tiny spider may remember who it has met."
- hook ("The strange hook"), found ("What they found"), matters ("Why it matters"): ONE short sentence each, about
  8 to 14 words, plain enough for a curious 10-year-old, exactly true to the paper.
- subject: the one subject the paper belongs to. A paper that fits two goes in the more specific one (a genetics paper
  is Genetics, not Biology).
- lv: the paper's reading difficulty, 1 to 4 stars. 1 = an everyday idea anyone follows; 2 = needs a little
  background; 3 = specialist ideas, but the gist can be explained; 4 = heavy theory, maths or methods, hard even for
  a keen adult.

The write-up beside the card (a two-minute read, medium level, for a curious adult):
- paper.hook, paper.found, paper.matters: two or three short paragraphs each, separated by a blank line. Plain English,
  real details from the study (what they did, with what, how many, what changed), the authors by last name as the
  publisher's digest does ("Dahl and Cheng", or "Fernandez and colleagues"). Use a comparison only where it fits the
  mechanism. Keep the study's actual scope: say "may" where the paper is careful, and include one honest limit.

The picture (drawn by another AI from your words):
- drawing.subject: the hero, described so an illustrator can draw it exactly. The hero is ALWAYS a living creature
  with expressive eyes, even for abstract papers: if the paper is about an animal, plant or cell, draw that; if it is
  about a thing you can hold or see, make that thing alive with a cute face; if it is a shape, pattern or number, make
  it a creature made of that shape; otherwise invent a friendly creature that acts out the paper's everyday scene.
  Specific and recognizable (species, colors, the key detail the study is about), cute, doing what the study shows.
- drawing.scene: begins "Background:" and is the real place where the study happens or where the subject lives (a lab
  arena, a cave roost, a meadow, a hospital nursery).
- Never: real people or the authors, text, letters or equations in the picture, logos, filler stars, planets or
  sparkles, a stock beaker, atom or brain unless the paper is about it, or anything scary or gory (draw a pathogen as a
  friendly creature).
- drawing.slug: two or three lowercase words joined by hyphens naming the hero, e.g. "jumping-spider".

The citation:
- cite: the article in MLA 9th edition, exactly like this pattern, with *asterisks* around the journal name and around
  any species name in the title: Dahl, Christoph D., and Yaling Cheng. "Individual Recognition in a Jumping Spider
  (*Phidippus regius*)." *eLife*, vol. 13, 2025, article RP97146, https://doi.org/10.7554/eLife.97146.
  Use curly quotes as in the example. One author: Last, First. Two: Last, First, and First Last. Three or more:
  Last, First, et al.

Write only what the article supports. Never invent numbers, quotes or results.`;

const CARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'headline', 'hook', 'found', 'matters', 'subject', 'lv', 'paper', 'drawing', 'cite'],
  properties: {
    name: {type: 'string'},
    headline: {type: 'string'},
    hook: {type: 'string'},
    found: {type: 'string'},
    matters: {type: 'string'},
    subject: {type: 'string', enum: Object.keys(SUBJECTS)},
    lv: {type: 'integer', enum: [1, 2, 3, 4]},
    paper: {
      type: 'object', additionalProperties: false, required: ['hook', 'found', 'matters'],
      properties: {hook: {type: 'string'}, found: {type: 'string'}, matters: {type: 'string'}},
    },
    drawing: {
      type: 'object', additionalProperties: false, required: ['slug', 'subject', 'scene'],
      properties: {slug: {type: 'string'}, subject: {type: 'string'}, scene: {type: 'string'}},
    },
    cite: {type: 'string'},
  },
};

/** Claude reads the paper and writes the card's words. Returns {words, usd}. */
export async function writeWithClaude(paper, {apiKey, client} = {}) {
  if (!client && !apiKey) throw new CardError('Claude has no key yet (PAPER_GIRL_ANTHROPIC_API_KEY), so no new cards can be written.', 503);
  const claude = client || new Anthropic({apiKey});
  const subjects = Object.entries(SUBJECTS).map(([k, v]) => `${k}: ${v}`).join('\n');
  const facts = [
    `PMCID: ${paper.pmcid}`, `DOI: ${paper.doi}`, `Title: ${paper.title}`, `Authors: ${paper.authorString}`,
    `Journal: ${paper.journal}`, `Volume: ${paper.volume}`, `Article number: ${paper.article}`, `Published: ${paper.published}`,
  ].join('\n');
  let message;
  try {
    message = await claude.messages.stream({
      model: WRITER_MODEL,
      max_tokens: 32000,
      output_config: {effort: 'medium', format: {type: 'json_schema', schema: CARD_SCHEMA}},
      system: [{type: 'text', text: `${RULES}\n\nThe subjects:\n${subjects}`, cache_control: {type: 'ephemeral'}}],
      messages: [{role: 'user', content: `Write the Papermon card for this article.\n\n${facts}\n\nThe article:\n\n${paper.text}`}],
    }).finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new CardError('Claude\'s key was refused. Check PAPER_GIRL_ANTHROPIC_API_KEY.', 503);
    if (e instanceof Anthropic.RateLimitError) throw new CardError('Claude is busy. Try again in a minute.', 503);
    if (e instanceof Anthropic.APIError) throw new CardError(`Claude could not write the card (${e.status}).`, 502);
    throw e;
  }
  const u = message.usage || {};
  const usd = ((u.input_tokens || 0) * PRICE.claude.in + (u.output_tokens || 0) * PRICE.claude.out
    + (u.cache_read_input_tokens || 0) * PRICE.claude.cacheRead + (u.cache_creation_input_tokens || 0) * PRICE.claude.cacheWrite) / 1e6;
  if (message.stop_reason === 'refusal') throw Object.assign(new CardError('Claude would not write a card for this paper.'), {usd});
  if (message.stop_reason === 'max_tokens') throw Object.assign(new CardError('The card came out too long. Try another paper.'), {usd});
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let words;
  try { words = JSON.parse(text); } catch { throw Object.assign(new CardError('Claude\'s card did not come back whole.'), {usd}); }
  return {words, usd};
}

// ---------------------------------------------------------------------------------------------------------------
// 3. The picture (OpenAI, style E)
// ---------------------------------------------------------------------------------------------------------------

// The same style line as scripts/draw-card-art-20261114.mjs (Astra's pick, 2026-11-14: style E).
export const STYLE = [
  'Style: retro 1990s Saturday-morning cartoon cel with a hand-painted gouache background, warm grainy colors, bouncy rubber-hose energy.',
  'One clear main subject, cartoonish and cute but not girly, filling most of the square, scientifically recognizable.',
  'The hero is always a living creature with expressive cartoon eyes, even if the real thing has none.',
  'No text, letters, logos, stars, sparkles or hearts (except numbers that are the subject itself).',
].join(' ');

/** OpenAI draws the card's square picture. Returns {bytes, ext, usd}. */
export async function drawWithOpenAI(drawing, {apiKey, fetchImpl = fetch} = {}) {
  if (!apiKey) throw new CardError('OpenAI has no key (PAPERGIRL_PATTY_OPENAI_API_KEY), so no pictures can be drawn.', 503);
  const prompt = `${drawing.subject}. ${drawing.scene || ''} ${STYLE}`.replace(/\s+/g, ' ');
  const res = await fetchImpl('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: ARTIST_MODEL, prompt, size: '1024x1024', quality: 'medium', n: 1, output_format: 'webp', output_compression: 82}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new CardError(`OpenAI could not draw the picture (${res.status}${body.error?.message ? `: ${body.error.message}` : ''}).`, 502);
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new CardError('OpenAI sent no picture.', 502);
  const u = body.usage || {};
  const usd = u.output_tokens ? ((u.input_tokens || 0) * PRICE.image.in + u.output_tokens * PRICE.image.out) / 1e6 : 0.05;
  return {bytes: Buffer.from(b64, 'base64'), ext: 'webp', usd};
}

// ---------------------------------------------------------------------------------------------------------------
// 4. The card
// ---------------------------------------------------------------------------------------------------------------

/**
 * Makes a whole card: paper, words, picture. `spend(usd, what)` is called for every paid step as it happens, so the
 * daily cap counts money already spent even when a later step fails. `step(text)` reports progress for the page.
 */
export async function makeCard(pmcid, {number, artDir, today, write, draw, fetchImpl = fetch, spend = () => {}, step = () => {}}) {
  step('Reading the paper…');
  const paper = await fetchPaper(pmcid, fetchImpl);
  step('Writing the card…');
  let words;
  try {
    const w = await write(paper);
    spend(w.usd, `words for ${pmcid}`);
    words = w.words;
  } catch (e) { if (e.usd) spend(e.usd, `words for ${pmcid} (failed)`); throw e; }
  const problems = checkWords(words);
  if (problems.length) throw new CardError(`The card's words broke a rule: ${problems.join('; ')}.`, 502);
  step('Drawing the picture…');
  const art = await draw(words.drawing);
  spend(art.usd, `picture for ${pmcid}`);
  const slug = words.drawing.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'papermon';
  const file = `${String(number).padStart(6, '0')}-${slug}-${today.replace(/-/g, '')}.${art.ext}`;
  await mkdir(artDir, {recursive: true});
  await writeFile(join(artDir, file), art.bytes);
  const journalShort = /^elife$/i.test(paper.journal) ? 'eLife' : paper.journal;
  return {
    card: {
      lv: words.lv,
      name: words.name,
      subject: words.subject,
      src: `${journalShort} ${paper.year || ''}`.trim(),
      art: `/art/${file}`,
      no: number,
      url: paper.doi ? `https://doi.org/${paper.doi.toLowerCase()}` : `https://europepmc.org/article/PMC/${pmcid}`,
      headline: words.headline,
      hook: words.hook,
      found: words.found,
      matters: words.matters,
      drawing: {...words.drawing, slug, style: 'e'},
      pmcid,
      made: today,
      published: paper.published,
      readMinutes: paper.readMinutes,
      paper: words.paper,
      cite: words.cite,
      // The article's own details, for the write-up's More information on pages that have no copy of the paper.
      source: {title: paper.title, authors: paper.authorString, journal: paper.journal, year: paper.year, doi: paper.doi, license: 'https://creativecommons.org/licenses/by/4.0/'},
    },
    paper,
  };
}

/** Plain checks on Claude's words before anything is drawn or saved. */
export function checkWords(w) {
  const problems = [];
  if (!w || typeof w !== 'object') return ['no card'];
  if (!SUBJECTS[w.subject]) problems.push(`unknown subject "${w.subject}"`);
  if (![1, 2, 3, 4].includes(w.lv)) problems.push('difficulty is not 1-4 stars');
  const nameWords = String(w.name || '').trim().split(/\s+/).filter(Boolean).length;
  if (nameWords < 2 || nameWords > 5) problems.push('the name is not about three words');
  for (const k of ['hook', 'found', 'matters']) {
    const s = String(w[k] || '');
    if (!s || s.length > 160) problems.push(`the ${k} sentence is missing or too long`);
    if (!w.paper?.[k] || w.paper[k].length < 120) problems.push(`the write-up's ${k} is missing or too short`);
  }
  if (!w.drawing?.subject || !/^background:/i.test(w.drawing?.scene || '')) problems.push('the picture brief is incomplete');
  if (!/https:\/\/doi\.org\/|europepmc/i.test(w.cite || '')) problems.push('the citation has no link');
  return problems;
}
