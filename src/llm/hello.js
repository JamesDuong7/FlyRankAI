'use strict';

require('dotenv').config();
const OpenAI = require('openai');

async function main() {
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    timeout: 30000,
    maxRetries: 0,
  });
  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    messages: [{ role: 'user', content: 'Reply with exactly the word: ready' }],
  });
  console.log(response.choices[0]?.message?.content);
}

main().catch((error) => {
  console.error(`LLM smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
