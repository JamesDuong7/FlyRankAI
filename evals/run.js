'use strict';

require('dotenv').config();
const cases = require('./cases.json');

async function main() {
  if (process.env.LLM_STUB === '1' || process.env.LLM_ENABLED === 'false' ||
      !process.env.LLM_API_KEY || process.env.LLM_API_KEY === 'replace_with_your_openrouter_key') {
    throw new Error('Configure a real LLM_API_KEY and disable stub mode before running the eval');
  }
  const baseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
  let matched = 0;
  const failures = [];
  for (const [index, testCase] of cases.entries()) {
    const response = await fetch(new URL('/normalize', baseURL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: testCase.input }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Case ${index + 1} returned ${response.status}: ${body.error || 'unknown error'}`);
    if (body.canonical_title === testCase.expected) matched += 1;
    else failures.push({ case: index + 1, input: testCase.input, expected: testCase.expected, actual: body.canonical_title });
  }
  console.log(JSON.stringify({ matched, total: cases.length, percentage: Math.round(100 * matched / cases.length), failures }, null, 2));
}

main().catch((error) => {
  console.error(`Eval failed: ${error.message}`);
  process.exitCode = 1;
});
