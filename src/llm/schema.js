'use strict';

const { z } = require('zod');

const canonicalTitles = [
  'Software Engineer',
  'Senior Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Data Engineer',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'Other',
];

const inputSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
});

const outputSchema = z.strictObject({
  canonical_title: z.enum(canonicalTitles),
  confidence: z.number().finite().min(0).max(1),
  reason: z.string().trim().min(1).max(160),
}).refine(
  (value) => value.canonical_title !== 'Other' || value.confidence < 0.5,
  { path: ['confidence'], message: 'must be below 0.5 when canonical_title is Other' }
);

const stubResponse = outputSchema.parse({
  canonical_title: 'Other',
  confidence: 0.1,
  reason: 'Stub mode; no model was called.',
});

function describeIssues(error) {
  return error.issues.map((issue) =>
    `${issue.path.join('.') || 'title'}: ${issue.message}`
  ).join('; ');
}

module.exports = { canonicalTitles, inputSchema, outputSchema, stubResponse, describeIssues };
