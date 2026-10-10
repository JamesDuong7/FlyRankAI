'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { inputSchema, outputSchema } = require('../src/llm/schema');
const { normalize, validateRaw } = require('../src/llm/normalize');
const { callWithRetry } = require('../src/llm/client');

const valid = JSON.stringify({ canonical_title: 'Senior Software Engineer', confidence: 0.95, reason: 'Sr. indicates seniority.' });

test('input and output reject invalid types, titles, and uncertain guesses', () => {
  assert.equal(inputSchema.safeParse({ title: 3 }).success, false);
  assert.equal(inputSchema.safeParse({ title: 'x'.repeat(201) }).success, false);
  assert.equal(outputSchema.safeParse({ canonical_title: 'Wizard', confidence: 1, reason: 'No' }).success, false);
  assert.equal(outputSchema.safeParse({ canonical_title: 'Other', confidence: 0.9, reason: 'No' }).success, false);
});

test('parser finds a fenced JSON object and validates its schema', () => {
  assert.equal(validateRaw(`Here is the answer:\n\`\`\`json\n${valid}\n\`\`\``).canonical_title, 'Senior Software Engineer');
});

test('one repair succeeds without quarantining', async () => {
  const calls = [];
  const answer = await normalize('Sr. SWE II', async (_title, repair) => {
    calls.push(repair);
    return calls.length === 1 ? '{"canonical_title":"Wizard"}' : valid;
  }, async () => assert.fail('successful repair must not quarantine'));
  assert.equal(answer.canonical_title, 'Senior Software Engineer');
  assert.equal(calls.length, 2);
  assert.match(calls[1].error, /canonical_title/);
});

test('second invalid answer returns 422 and quarantines once', async () => {
  let calls = 0;
  const quarantined = [];
  await assert.rejects(() => normalize('bad title', async () => {
    calls += 1;
    return 'not JSON';
  }, async (...args) => quarantined.push(args)), { status: 422 });
  assert.equal(calls, 2);
  assert.equal(quarantined.length, 1);
  assert.equal(quarantined[0][0], 'bad title');
});

test('401 is never retried', async () => {
  let calls = 0;
  const client = { chat: { completions: { create: async () => { calls += 1; throw { status: 401 }; } } } };
  await assert.rejects(() => callWithRetry(client, {}, { model: 'test', repairCount: 0, pause: async () => assert.fail('must not pause') }), { status: 502 });
  assert.equal(calls, 1);
});

test('429 honors Retry-After, then succeeds', async () => {
  let calls = 0;
  const waits = [];
  const client = { chat: { completions: { create: async () => {
    calls += 1;
    if (calls === 1) throw { status: 429, headers: { 'retry-after': '2' } };
    return { usage: { prompt_tokens: 5, completion_tokens: 8 } };
  } } } };
  await callWithRetry(client, {}, { model: 'test', repairCount: 0, pause: async (ms) => waits.push(ms) });
  assert.deepEqual(waits, [2000]);
  assert.equal(calls, 2);
});

test('timeouts stop after two transport retries and return 504', async () => {
  let calls = 0;
  const client = { chat: { completions: { create: async () => {
    calls += 1;
    throw { name: 'APIConnectionTimeoutError' };
  } } } };
  await assert.rejects(() => callWithRetry(client, {}, { model: 'test', repairCount: 0, pause: async () => {}, random: () => 0 }), { status: 504 });
  assert.equal(calls, 3);
});
