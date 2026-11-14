import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatArticleSummary, summarySentences, ARTICLE_SECTION_LABELS} from '../lib/article-summary-20261019.ts';

const seeds = JSON.parse(readFileSync(new URL('../lib/data/seeds.json', import.meta.url), 'utf8'));
const count = text => text.trim().split(/\s+/u).filter(Boolean).length;
const paper = paragraphs => ({summaryParagraphs: paragraphs, summaryLabel: 'Author summary'});

test('every seed, including the long jumping-spider article, has three short sections', () => {
  assert.deepEqual(ARTICLE_SECTION_LABELS, ['THE STRANGE HOOK', 'THE COOL EXPLANATION', 'WHY IT MATTERS']);
  assert.ok(seeds.find(seed => seed.doi === '10.7554/elife.97146'));
  for (const seed of seeds) {
    const result = formatArticleSummary(seed);
    assert.equal(result.kind, 'publisher-excerpts');
    assert.ok(result.hook && result.explanation && result.importance, seed.pmcid);
    assert.ok(count(result.hook) <= 45, seed.pmcid);
    assert.ok(count(result.explanation) <= 105, seed.pmcid);
    assert.ok(count(result.importance) <= 45, seed.pmcid);
    assert.ok(result.wordCount <= 195, seed.pmcid);
    const sentences = summarySentences([result.hook, result.explanation, result.importance].join(' '));
    assert.equal(new Set(sentences).size, sentences.length, `Duplicate sentence in ${seed.pmcid}`);
    for (const sentence of sentences) {
      assert.ok(seed.summaryParagraphs.some(paragraph => paragraph.includes(sentence)), `Rewritten publisher sentence in ${seed.pmcid}: ${sentence}`);
    }
  }
});

test('retains negation, decimals, abbreviations and a qualification attached to a finding', () => {
  const input = paper([
    'Can a small change affect plant growth?',
    'Smith et al. tested a 1.5 mg dose in young plants. The researchers found more leaves after treatment. However, the experiment did not establish whether the plants would survive outdoors.',
    'Future work may test whether the effect lasts.'
  ]);
  const result = formatArticleSummary(input);
  assert.match(result.explanation, /Smith et al\. tested a 1\.5 mg dose/);
  assert.match(result.explanation, /found more leaves/);
  assert.match(result.explanation, /did not establish/);
  assert.equal(result.importance, input.summaryParagraphs[2]);
});

test('a caveat across a paragraph break is not separated from the claim', () => {
  const input = paper([
    'A question about plant growth motivated the experiment.',
    'Researchers found more leaves after treatment.',
    'However, they did not establish whether this effect lasts.',
    'Future experiments could test longer periods.'
  ]);
  const result = formatArticleSummary(input);
  assert.match(result.explanation, /more leaves after treatment\. However,/);
});

test('one-paragraph and one-sentence summaries never duplicate text to fill sections', () => {
  const one = 'Researchers found no effect in this experiment.';
  const result = formatArticleSummary(paper([one]));
  assert.equal(result.hook, one);
  assert.ok(!result.explanation.includes(one));
  assert.ok(!result.importance.includes(one));
  const regular = formatArticleSummary(paper(['A puzzle motivated the study. Researchers compared two groups of plants. They found no difference. Future work could test other environments.']));
  const all = summarySentences([regular.hook, regular.explanation, regular.importance].join(' '));
  assert.equal(new Set(all).size, all.length);
});

test('does not clip an overlong sentence or detach its negation to fit a card', () => {
  const long = `The researchers ${'carefully '.repeat(120)}did not find a reliable effect.`;
  const result = formatArticleSummary(paper([long]));
  assert.ok(result.wordCount < 100);
  assert.ok(![result.hook, result.explanation, result.importance].join(' ').includes('find a reliable effect'));
});

test('edited prose is labeled differently and partial editorial fields do not mix provenance', () => {
  const input = {...paper(['Publisher background. Researchers found no effect. More work is needed.']), hook: 'A tiny puzzle.', explanation: 'Researchers compared two groups. They found no effect.', importance: 'A bigger study could test the idea.'};
  const result = formatArticleSummary(input);
  assert.equal(result.kind, 'edited');
  assert.equal(result.hook, input.hook);
  assert.equal(result.explanation, input.explanation);
  assert.match(result.attribution, /Plain-English take by Papermon/);
  assert.equal(formatArticleSummary({...input, importance: undefined}).kind, 'publisher-excerpts');
});

const editorials=JSON.parse(readFileSync(new URL('../lib/data/editorial-20261019.json',import.meta.url),'utf8'));
test('every daily card has a complete editorial and specific caveat, without truncation',()=>{for(const seed of seeds){const editorial=editorials[seed.pmcid];assert.ok(editorial,seed.pmcid);assert.ok(editorial.caveat.length>35,seed.pmcid);const actual=formatArticleSummary({...seed,...editorial});for(const part of ['hook','explanation','importance'])assert.equal(actual[part],editorial[part],seed.pmcid+' '+part);}});
