'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { completeRaw, promptVersion } = require('./client');
const { outputSchema, describeIssues } = require('./schema');

function extractObject(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Model returned no JSON object');
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  if (start < 0) throw new Error('Model returned no JSON object');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && inString) { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Model returned incomplete JSON');
}

function validateRaw(raw) {
  let value;
  try {
    value = JSON.parse(extractObject(raw));
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
  const parsed = outputSchema.safeParse(value);
  if (!parsed.success) throw new Error(describeIssues(parsed.error));
  return parsed.data;
}

async function quarantine(title, raw, error) {
  const file = path.join(__dirname, '..', '..', 'logs', 'quarantine.jsonl');
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `${JSON.stringify({
      timestamp: new Date().toISOString(),
      input: { title },
      raw_output: raw,
      error,
      prompt_version: promptVersion,
    })}\n`);
  } catch (writeError) {
    console.error('Could not write LLM quarantine log:', writeError);
  }
}

async function normalize(title, complete = completeRaw, quarantineResult = quarantine) {
  const firstRaw = await complete(title);
  try {
    return validateRaw(firstRaw);
  } catch (firstError) {
    const secondRaw = await complete(title, { raw: firstRaw, error: firstError.message });
    try {
      return validateRaw(secondRaw);
    } catch (secondError) {
      await quarantineResult(title, secondRaw, secondError.message);
      const error = new Error('LLM could not produce a valid normalized title');
      error.status = 422;
      throw error;
    }
  }
}

module.exports = { normalize, validateRaw };
