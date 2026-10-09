'use strict';

const { z } = require('zod');

const httpsUrl = z.url().refine((value) => value.startsWith('https://'), 'must use HTTPS');

const bookSchema = z.object({
  title: z.string().trim().min(1),
  product_url: httpsUrl,
  price_text: z.string().regex(/^£\d+\.\d{2}$/),
  availability_text: z.string().trim().min(1),
  rating_text: z.enum(['One', 'Two', 'Three', 'Four', 'Five']),
  description: z.string().nullable(),
  source_page: httpsUrl,
  fetched_at: z.iso.datetime(),
  price_gbp: z.number().finite().nonnegative(),
});

function normalize(raw) {
  const price_gbp = /^£\d+\.\d{2}$/.test(raw.price_text)
    ? Number(raw.price_text.slice(1))
    : Number.NaN;
  return { ...raw, price_gbp };
}

function validate(raw) {
  const result = bookSchema.safeParse(normalize(raw));
  if (result.success) return { book: result.data };
  return { error: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
}

module.exports = { bookSchema, normalize, validate };
