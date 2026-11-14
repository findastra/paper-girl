// Read time of the whole original article (Astra, 2026-11-14: "the actual read time of the entire article, like the real
// article, not the card"). Fetches each card's full text from Europe PMC, counts the words in the article body
// (not references or figures' data), and stores whole minutes at 230 words a minute as `readMinutes`.
//   node scripts/count-read-time-20261114.mjs
import {readFileSync, writeFileSync} from 'node:fs';

const DECK = new URL('../lib/data/sample-deck-20261114.json', import.meta.url);
const WPM = 230;
const cards = JSON.parse(readFileSync(DECK, 'utf8'));

export function bodyWords(xml) {
  const body = (xml.match(/<body[\s\S]*?<\/body>/) || [''])[0];
  const abstract = (xml.match(/<abstract[\s\S]*?<\/abstract>/) || [''])[0];
  const text = (abstract + ' ' + body)
    .replace(/<table-wrap[\s\S]*?<\/table-wrap>/g, ' ')   // tables are looked at, not read word by word
    .replace(/<xref[\s\S]*?<\/xref>/g, ' ')                // citation markers
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter(w => /[A-Za-z]/.test(w)).length;
}

for (const c of cards) {
  const res = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/${c.pmcid}/fullTextXML`);
  if (!res.ok) { console.error(`${c.name}: full text not available (${res.status})`); continue; }
  const words = bodyWords(await res.text());
  c.readMinutes = Math.max(1, Math.round(words / WPM));
  console.log(`${c.name}: ${words} words, about ${c.readMinutes} min`);
}
writeFileSync(DECK, JSON.stringify(cards, null, 1) + '\n', 'utf8');
