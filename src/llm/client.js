'use strict';

const fs = require('node:fs');
const path = require('node:path');
const OpenAI = require('openai');

const promptVersion = 'normalize-v1';
const promptPath = path.join(__dirname, '..', '..', 'prompts', `${promptVersion}.md`);

function configuration() {
  const { LLM_BASE_URL: baseURL, LLM_API_KEY: apiKey, LLM_MODEL: model } = process.env;
  if (!baseURL || !apiKey || !model || apiKey === 'replace_with_your_openrouter_key') {
    const error = new Error('LLM provider is not configured');
    error.status = 503;
    throw error;
  }
  return { baseURL, apiKey, model };
}

async function completeRaw(title) {
  const { baseURL, apiKey, model } = configuration();
  const client = new OpenAI({ baseURL, apiKey, timeout: 30000, maxRetries: 0 });
  const prompt = fs.readFileSync(promptPath, 'utf8');
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify({ title }) },
    ],
  });
  return response.choices[0]?.message?.content ?? '';
}

module.exports = { completeRaw, promptVersion };
