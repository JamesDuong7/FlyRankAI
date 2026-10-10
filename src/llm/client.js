'use strict';

const fs = require('node:fs');
const path = require('node:path');
const OpenAI = require('openai');

const promptVersion = 'normalize-v1';
const promptPath = path.join(__dirname, '..', '..', 'prompts', `${promptVersion}.md`);
const timeoutMs = 30000;
const transportRetries = 2;

function configuration() {
  const { LLM_BASE_URL: baseURL, LLM_API_KEY: apiKey, LLM_MODEL: model } = process.env;
  if (!baseURL || !apiKey || !model || apiKey === 'replace_with_your_openrouter_key') {
    const error = new Error('LLM provider is not configured');
    error.status = 503;
    throw error;
  }
  return { baseURL, apiKey, model };
}

function isTimeout(error) {
  return error?.name === 'APIConnectionTimeoutError' || error?.code === 'ETIMEDOUT';
}

function retryAfterMs(headers) {
  const value = headers?.get?.('retry-after') ?? headers?.['retry-after'];
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function publicProviderError(error) {
  const result = new Error(isTimeout(error)
    ? 'LLM provider timed out'
    : error?.status === 429
      ? 'LLM provider rate limit reached'
      : 'LLM provider request failed');
  result.status = isTimeout(error) ? 504 : error?.status === 429 ? 503 : 502;
  return result;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callWithRetry(client, request, { model, repairCount, pause = sleep, random = Math.random }) {
  for (let attempt = 0; attempt <= transportRetries; attempt += 1) {
    const started = Date.now();
    try {
      const response = await client.chat.completions.create(request);
      console.log(JSON.stringify({
        event: 'llm_call', prompt_version: promptVersion, model,
        input_tokens: response.usage?.prompt_tokens ?? null,
        output_tokens: response.usage?.completion_tokens ?? null,
        duration_ms: Date.now() - started, repair_count: repairCount,
        attempt: attempt + 1, outcome: 'success',
      }));
      return response;
    } catch (error) {
      const timeout = isTimeout(error);
      const retryable = timeout || error?.status === 429 || error?.status >= 500 && error?.status <= 599;
      console.log(JSON.stringify({
        event: 'llm_call', prompt_version: promptVersion, model,
        input_tokens: null, output_tokens: null,
        duration_ms: Date.now() - started, repair_count: repairCount,
        attempt: attempt + 1, outcome: 'error',
        provider_status: error?.status ?? null, timeout,
      }));
      if (!retryable || attempt === transportRetries) throw publicProviderError(error);
      const advised = error?.status === 429 ? retryAfterMs(error.headers) : null;
      if (advised !== null && advised > 30000) throw publicProviderError(error);
      const backoff = 1000 * (2 ** attempt) + Math.floor(random() * 250);
      await pause(advised ?? backoff);
    }
  }
}

async function completeRaw(title, repair = null) {
  const { baseURL, apiKey, model } = configuration();
  const client = new OpenAI({ baseURL, apiKey, timeout: timeoutMs, maxRetries: 0 });
  const prompt = fs.readFileSync(promptPath, 'utf8');
  const request = {
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify({ title }) },
      ...(repair ? [{ role: 'user', content: JSON.stringify({
        instruction: 'Your previous answer was rejected for this reason. Return only corrected JSON matching the schema.',
        previous_answer: repair.raw,
        validation_error: repair.error,
      }) }] : []),
    ],
  };
  const response = await callWithRetry(client, request, { model, repairCount: repair ? 1 : 0 });
  return response.choices[0]?.message?.content ?? '';
}

module.exports = { completeRaw, promptVersion, callWithRetry, retryAfterMs, isTimeout };
