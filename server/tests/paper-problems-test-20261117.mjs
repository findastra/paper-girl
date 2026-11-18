// Which failures are one paper's problem (the page then tries another paper) and which are not (2026-11-17: the first
// real draw hit a paper Claude would not write a card for, and the friend lost a draw). Offline: no AI, no money.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeWithClaude, drawWithOpenAI, CardError} from '../card-maker-20261114.mjs';

const paper = {pmcid: 'PMC1', doi: '10.1/x', title: 'T', authorString: 'A', journal: 'eLife', volume: '1', article: 'e1', published: '2025-01-01', text: 'Body.'};
const claudeSays = message => ({messages: {stream: () => ({finalMessage: async () => message})}});

test('a refusal is this paper\'s problem, and its cost is still counted', async () => {
  const e = await writeWithClaude(paper, {client: claudeSays({stop_reason: 'refusal', usage: {input_tokens: 25000, output_tokens: 10}, content: []})}).catch(e => e);
  assert.ok(e instanceof CardError);
  assert.equal(e.paper, true);
  assert.ok(e.usd > 0.09 && e.usd < 0.11, `usd ${e.usd}`);
});

test('a card that does not come back whole is this paper\'s problem', async () => {
  const e = await writeWithClaude(paper, {client: claudeSays({stop_reason: 'end_turn', usage: {}, content: [{type: 'text', text: '{"name": '}]})}).catch(e => e);
  assert.equal(e.paper, true);
});

test('no key is not a paper problem, so the page does not burn papers on it', async () => {
  const e = await writeWithClaude(paper, {}).catch(e => e);
  assert.ok(e instanceof CardError);
  assert.notEqual(e.paper, true);
});

test('OpenAI turning down a picture is this paper\'s problem; OpenAI being down is not', async () => {
  const answer = (status, body) => async () => new Response(JSON.stringify(body), {status});
  const blocked = await drawWithOpenAI({subject: 's', scene: 'Background: x.'}, {apiKey: 'fake', fetchImpl: answer(400, {error: {code: 'moderation_blocked', message: 'no'}})}).catch(e => e);
  assert.equal(blocked.paper, true);
  const down = await drawWithOpenAI({subject: 's', scene: 'Background: x.'}, {apiKey: 'fake', fetchImpl: answer(500, {error: {message: 'oops'}})}).catch(e => e);
  assert.ok(down instanceof CardError);
  assert.notEqual(down.paper, true);
});
