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
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import sharp from 'sharp';

const DECK = new URL('../lib/data/sample-deck-20261114.json', import.meta.url);
const OUT = new URL('../public/art/cards/', import.meta.url);
const STYLE = [
  'Style: a cute hand-drawn cartoon illustration like the pictures in a friendly children\'s science book.',
  'Soft warm colors on a plain cream background, clean confident outlines, gentle shading, a happy little face where it fits.',
  'Only this one subject, centered, filling most of the square, scientifically recognizable.',
  'No stars, sparkles, flowers, planets, glitter, hearts or extra objects. No text, letters or numbers except any the subject itself is.',
  'Cute and simple, not girly.',
].join(' ');
const MODEL = 'gpt-image-1';

const args = process.argv.slice(2);
const dry = args.includes('--dry'), redo = args.includes('--redo');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Denver'}).format(new Date()).replaceAll('-', '');

const cards = JSON.parse(readFileSync(DECK, 'utf8'));
const todo = cards.filter(c => c.drawing && (!only || c.drawing.slug === only) && (redo || !String(c.art).startsWith('cards/')));
if (!todo.length) { console.log('Nothing to draw.'); process.exit(0); }

const key = process.env.PAPERGIRL_PATTY_OPENAI_API_KEY;
if (!dry && !key) { console.error('PAPERGIRL_PATTY_OPENAI_API_KEY is not set. Nothing was drawn.'); process.exit(1); }
mkdirSync(OUT, {recursive: true});

for (const card of todo) {
  const prompt = `${card.drawing.subject}. ${STYLE}`;
  if (dry) { console.log(`\n[${card.drawing.slug}] ${prompt}`); continue; }
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
  const name = `${card.drawing.slug}-${today}`;
  const png = Buffer.from(body.data[0].b64_json, 'base64');
  writeFileSync(new URL(`${name}.png`, OUT), png);
  await sharp(png).resize(720, 720).webp({quality: 84}).toFile(new URL(`${name}.webp`, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  card.art = `cards/${name}.webp`;
  writeFileSync(DECK, JSON.stringify(cards, null, 1) + '\n', 'utf8');
  console.log(`${card.drawing.slug}: drawn -> public/art/cards/${name}.webp`);
}
