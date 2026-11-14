// Paper Patty's drawing step: OpenAI draws one picture per card (Astra, 2026-11-14: "we need OpenAI to draw the art").
// Each card names one specific, real thing from its paper (`drawing.subject` in lib/data/sample-deck-20261114.json);
// the style follows the site's first three illustrations, without their filler. Rules: docs/card-plan-20261113.md.
//
//   node scripts/draw-card-art-20261114.mjs --dry              print the prompts, call nothing
//   node scripts/draw-card-art-20261114.mjs                    draw every card that has no OpenAI picture yet
//   node scripts/draw-card-art-20261114.mjs --only pika --redo  draw one card again
//
// Needs PAPERGIRL_PATTY_OPENAI_API_KEY (Paper Patty's own key, never OPENAI_API_KEY). The key is read from the environment
// and never printed or written anywhere. Pictures land in public/art/cards/ as 720 px WebP; the card's `art` is updated.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const DECK = new URL('../lib/data/sample-deck-20261114.json', import.meta.url);
const OUT = new URL('../public/art/cards/', import.meta.url);
// The 1024 px originals stay out of the published site, next to the repo's other sources.
const ORIGINALS = new URL('../art-originals/cards/', import.meta.url);
// Astra's pick, 2026-11-14: style E, retro Saturday-morning cartoon, with the subject's real setting from its paper as
// the background (`drawing.scene`). Drafts of all five styles: docs/art-styles-20261114.html.
const STYLE = [
  'Style: retro 1990s Saturday-morning cartoon cel with a hand-painted gouache background, warm grainy colors, bouncy rubber-hose energy.',
  'One clear main subject, cartoonish and cute but not girly, filling most of the square, scientifically recognizable.',
  // Astra, 2026-11-14: the hero is always a living thing with eyes, even for abstract papers.
  'The hero is always a living creature with expressive cartoon eyes, even if the real thing has none.',
  'No text, letters, logos, stars, sparkles or hearts (except numbers that are the subject itself).',
].join(' ');
// gpt-image-1 is gone from the API (2026-11-14); PAPER_PATTY_IMAGE_MODEL picks another without editing this file.
const MODEL = process.env.PAPER_PATTY_IMAGE_MODEL || 'gpt-image-2';

const args = process.argv.slice(2);
const dry = args.includes('--dry'), redo = args.includes('--redo');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Denver'}).format(new Date()).replaceAll('-', '');

const cards = JSON.parse(readFileSync(DECK, 'utf8'));
const todo = cards.filter(c => c.drawing && (!only || c.drawing.slug === only) && (redo || !String(c.art).startsWith('cards/')));
if (!todo.length) { console.log('Nothing to draw.'); process.exit(0); }

const key = process.env.PAPERGIRL_PATTY_OPENAI_API_KEY;
if (!dry && !key) { console.error('PAPERGIRL_PATTY_OPENAI_API_KEY is not set. Nothing was drawn.'); process.exit(1); }
mkdirSync(OUT, {recursive: true}); mkdirSync(ORIGINALS, {recursive: true});

for (const card of todo) {
  const prompt = `${card.drawing.subject}. ${card.drawing.scene || ''} ${STYLE}`.replace(/\s+/g, ' ');
  if (dry) { console.log(`\n[${card.drawing.slug}] ${prompt}`); continue; }
  const name = `${card.drawing.slug}-e-${today}`;
  const pngPath = fileURLToPath(new URL(`${name}.png`, ORIGINALS)), webpPath = fileURLToPath(new URL(`${name}.webp`, OUT));
  // A picture already drawn today is reused (never paid for twice), unless --redo.
  if (existsSync(pngPath) && !redo) {
    await sharp(pngPath).resize(720, 720).webp({quality: 84}).toFile(webpPath);
    card.art = `cards/${name}.webp`;
    writeFileSync(DECK, JSON.stringify(cards, null, 1) + '\n', 'utf8');
    console.log(`${card.drawing.slug}: reused today's drawing -> public/art/cards/${name}.webp`);
    continue;
  }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: MODEL, prompt, size: '1024x1024', quality: 'medium', n: 1}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.data?.[0]?.b64_json) {
    console.error(`${card.drawing.slug}: OpenAI said ${res.status} ${body.error?.message || ''}`.trim());
    continue;
  }
  const png = Buffer.from(body.data[0].b64_json, 'base64');
  writeFileSync(pngPath, png);
  await sharp(png).resize(720, 720).webp({quality: 84}).toFile(webpPath);
  card.art = `cards/${name}.webp`;
  writeFileSync(DECK, JSON.stringify(cards, null, 1) + '\n', 'utf8');
  console.log(`${card.drawing.slug}: drawn -> public/art/cards/${name}.webp`);
}
