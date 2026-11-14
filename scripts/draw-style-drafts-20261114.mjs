// Style drafts for the card pictures (Astra, 2026-11-14: "more cartoonish ... some stuff in the background ... have
// OpenAI draft like 5 versions of each of these, different styles completely"). Five styles x five cards.
// Each background is the subject's real setting from its paper, so the background means something.
// Original creature-card art in the spirit of collectible card games; never a copy of any game's characters or art.
//
//   node scripts/draw-style-drafts-20261114.mjs --dry     print the prompts
//   node scripts/draw-style-drafts-20261114.mjs           draw every draft not drawn yet (never pays twice)
//
// Needs PAPERGIRL_PATTY_OPENAI_API_KEY. Drafts land in art-originals/drafts/ (PNG + 512 px WebP), outside the site.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const DECK = new URL('../lib/data/sample-deck-20261114.json', import.meta.url);
const OUT = fileURLToPath(new URL('../art-originals/drafts/', import.meta.url));
const MODEL = process.env.PAPER_PATTY_IMAGE_MODEL || 'gpt-image-2';

// The real setting from each paper, used as the background.
const SCENE = {
  'jumping-spider': 'Background: the sunny edge of a garden leaf and a stone wall where jumping spiders hunt, softly out of focus.',
  'bat-pup': 'Background: the inside of a cave roost at dusk with its mother and other bats hanging in soft shadow behind.',
  'pika': 'Background: a high grassy alpine meadow of the Qinghai-Tibetan Plateau with rocks, short grass and a yak grazing far away.',
  'colored-seven': 'Background: a calm lab table with a computer screen showing gray numbers, like a perception experiment.',
  'newborn-eeg': 'Background: a cozy hospital nursery with a crib and a soft monitor showing brain-wave lines.',
};
const STYLES = {
  a: {name: 'Bright creature-card cartoon', text: 'Style: bright, bold creature trading-card illustration, original character design, clean thick outlines, cel shading, vivid saturated colors, a lively pose, a simple painted background with depth like collectible card art.'},
  b: {name: 'Storybook watercolor', text: 'Style: soft watercolor and ink storybook illustration, cartoonish proportions, big expressive eyes, gentle washes of color, a loose painted background.'},
  c: {name: 'Clay toy 3D', text: 'Style: cute 3D render of a chunky clay or vinyl toy, rounded shapes, soft studio lighting, a small diorama background made of the same toy material.'},
  d: {name: 'Flat vector sticker', text: 'Style: modern flat vector cartoon like an animated series, bold simple shapes, limited color palette, crisp edges, a flat layered background.'},
  e: {name: 'Retro Saturday-morning cartoon', text: 'Style: retro 1990s Saturday-morning cartoon cel with a hand-painted gouache background, warm grainy colors, bouncy rubber-hose energy.'},
};
const RULES = 'One clear main subject, cartoonish and cute but not girly, filling most of the square. No text, letters, logos, stars, sparkles or hearts (except numbers that are the subject itself).';

const dry = process.argv.includes('--dry');
const key = process.env.PAPERGIRL_PATTY_OPENAI_API_KEY;
if (!dry && !key) { console.error('PAPERGIRL_PATTY_OPENAI_API_KEY is not set. Nothing was drawn.'); process.exit(1); }
mkdirSync(OUT, {recursive: true});
const cards = JSON.parse(readFileSync(DECK, 'utf8'));
const jobs = [];
for (const c of cards) for (const [id, s] of Object.entries(STYLES)) jobs.push({c, id, s});

async function draw({c, id, s}) {
  const slug = c.drawing.slug, base = `${OUT}${slug}-${id}-20261114`;
  const prompt = `${c.drawing.subject}. ${SCENE[slug]} ${s.text} ${RULES}`;
  if (dry) { console.log(`\n[${slug} ${id}] ${prompt}`); return; }
  if (existsSync(`${base}.png`)) { console.log(`${slug} ${id}: already drawn`); return; }
  const res = await fetch('https://api.openai.com/v1/images/generations', {method: 'POST',
    headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: MODEL, prompt, size: '1024x1024', quality: 'medium', n: 1})});
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.data?.[0]?.b64_json) { console.error(`${slug} ${id}: OpenAI said ${res.status} ${body.error?.message || ''}`); return; }
  const png = Buffer.from(body.data[0].b64_json, 'base64');
  writeFileSync(`${base}.png`, png);
  await sharp(png).resize(512, 512).webp({quality: 82}).toFile(`${base}.webp`);
  console.log(`${slug} ${id}: drawn`);
}
// Three at a time keeps it quick without hammering the API.
for (let i = 0; i < jobs.length; i += 3) await Promise.all(jobs.slice(i, i + 3).map(draw));
writeFileSync(`${OUT}styles-20261114.json`, JSON.stringify(Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, v.name])), null, 1) + '\n');
