// Offline checks for the card maker: no network, no AI, no money. Run with `npm test` in server/.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkWords, articleText, bodyWords, makeCard, SUBJECTS} from '../card-maker-20261114.mjs';
import {openCatalog, cardNumber, numberOf} from '../catalog-20261114.mjs';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const good = {
  name: 'Discerning Solitary Salticid', headline: 'A tiny spider may remember who it has met.',
  hook: 'A tiny loner spider may remember who it has met.', found: 'Jumping spiders told a familiar spider from a stranger.',
  matters: 'Big social smarts can fit in a very small brain.', subject: 'Biology', lv: 1,
  paper: {hook: 'x'.repeat(200), found: 'y'.repeat(200), matters: 'z'.repeat(200)},
  drawing: {slug: 'jumping-spider', subject: 'a cute regal jumping spider', scene: 'Background: a lab arena.'},
  cite: 'Dahl, Christoph D., and Yaling Cheng. “Individual Recognition.” *eLife*, vol. 13, 2025, https://doi.org/10.7554/eLife.97146.',
};

test('a card that follows the rules passes', () => assert.deepEqual(checkWords(good), []));
test('broken cards are caught before anything is drawn', () => {
  assert.ok(checkWords({...good, subject: 'Astrology'}).some(p => p.includes('subject')));
  assert.ok(checkWords({...good, lv: 5}).some(p => p.includes('difficulty')));
  assert.ok(checkWords({...good, name: 'Spider'}).some(p => p.includes('name')));
  assert.ok(checkWords({...good, hook: 'w '.repeat(100)}).some(p => p.includes('hook')));
  assert.ok(checkWords({...good, drawing: {...good.drawing, scene: 'a lab'}}).some(p => p.includes('picture')));
});
test('all 13 subjects are known', () => assert.equal(Object.keys(SUBJECTS).length, 13));

const xml = `<article><front><abstract><p>Short abstract here.</p></abstract><abstract abstract-type="plain-language-summary">
<title>eLife digest</title><p>A digest &amp; more.</p></abstract></front><body><sec><title>Results</title><p>Spiders
<xref ref-type="bibr">12</xref> met again.</p><table-wrap><p>1 2 3</p></table-wrap></sec></body></article>`;
test('the article text keeps the digest and drops tables and citation markers', () => {
  const t = articleText(xml);
  assert.match(t, /A digest & more/);
  assert.doesNotMatch(t, /12|1 2 3/);
  // Read time counts the first abstract and the body, like scripts/count-read-time-20261114.mjs: 3 + 4 words
  assert.equal(bodyWords(xml), 7);
});

test('a whole card is made, numbered and saved once per paper', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'papermon-test-'));
  try {
    const fakeFetch = async url => url.includes('/search?')
      ? new Response(JSON.stringify({resultList: {result: [{title: 'Individual recognition', journalInfo: {journal: {title: 'eLife'}, volume: '13'},
          isOpenAccess: 'Y', pubYear: '2025', firstPublicationDate: '2025-11-11', doi: '10.7554/eLife.97146', authorString: 'Dahl CD, Cheng Y.'}]}}))
      : new Response(xml.replace('<front>', '<front><license xlink:href="https://creativecommons.org/licenses/by/4.0/"/>'));
    const {card} = await makeCard('PMC12604854', {
      number: 6, artDir: join(dir, 'art'), today: '2026-11-14', fetchImpl: fakeFetch,
      write: async () => ({words: good, usd: 0.2}), draw: async () => ({bytes: Buffer.from('RIFF'), ext: 'webp', usd: 0.04}),
    });
    assert.equal(card.art, '/art/000006-jumping-spider-20261114.webp');
    assert.equal(card.src, 'eLife 2025');
    assert.equal(card.url, 'https://doi.org/10.7554/elife.97146');
    const cat = openCatalog(join(dir, 'c.sqlite'));
    cat.add(card, {writer: 'test', artist: 'test', cost: 0.24, reader: 'r-test-reader'});
    assert.equal(cat.byPmcid('PMC12604854').no, '000,006');
    assert.throws(() => cat.add(card, {writer: 'test', artist: 'test'}), /UNIQUE/);
    assert.equal(cat.pick({subject: 'Biology', lv: 1, have: ['000,006']}), null);
    assert.equal(cat.pick({subject: 'Biology', lv: 1, have: []}).name, good.name);
    cat.db.close();
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('card numbers print as 000,006', () => { assert.equal(cardNumber(6), '000,006'); assert.equal(numberOf('000,006'), 6); });
