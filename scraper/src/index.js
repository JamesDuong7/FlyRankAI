'use strict';

const { Fetcher } = require('./fetcher');
const { discover } = require('./catalogue');
const { extractBook } = require('./book');
const { validate } = require('./schema');
const fs = require('node:fs/promises');
const path = require('node:path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const writeJson = async (name, value) => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`);
};

if (require.main === module) {
  const fetcher = new Fetcher();
  discover(fetcher).then(async ({ pages, books, discovered }) => {
    console.log(`catalogue_pages=${pages.length} discovered=${discovered} unique_urls=${books.length}`);
    const records = new Map();
    const errors = [];
    for (const book of books) {
      const { html, fetchedAt } = await fetcher.get(book.productUrl);
      const raw = extractBook(html, book, fetchedAt);
      const result = validate(raw);
      if (result.book) records.set(result.book.product_url, result.book);
      else errors.push({ product_url: book.productUrl, reason: result.error, record: raw });
    }
    await writeJson('books.json', [...records.values()]);
    await writeJson('errors.json', errors);
    console.log(`detail_pages=${books.length} valid_records=${records.size} invalid_records=${errors.length}`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
