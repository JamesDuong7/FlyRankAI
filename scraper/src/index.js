'use strict';

const { Fetcher } = require('./fetcher');
const { discover } = require('./catalogue');
const { extractBook } = require('./book');
const { validate } = require('./schema');
const fs = require('node:fs/promises');
const path = require('node:path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const BAD_URL = 'https://books.toscrape.com/catalogue/this-book-does-not-exist-flyrank-a9/index.html';
const writeJson = async (name, value) => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`);
};

async function run({ injectBadUrl = false, fetcher = new Fetcher() } = {}) {
  const started = Date.now();
  const report = {
    start_time: new Date(started).toISOString(),
    duration_ms: 0,
    catalogue_pages: 0,
    discovered: 0,
    unique_urls: 0,
    detail_pages: 0,
    pages_fetched: 0,
    cache_hits: 0,
    requests_made: 0,
    valid_records: 0,
    invalid_records: 0,
    failed_pages: 0,
  };
  try {
    const { pages, books, discovered } = await discover(fetcher);
    report.catalogue_pages = pages.length;
    report.discovered = discovered;
    report.unique_urls = books.length;
    console.log(`catalogue_pages=${pages.length} discovered=${discovered} unique_urls=${books.length}`);
    const records = new Map();
    const errors = [];
    const targets = injectBadUrl
      ? [...books, { productUrl: BAD_URL, sourcePage: pages[pages.length - 1] }]
      : books;
    for (const book of targets) {
      report.detail_pages++;
      try {
        const { html, fetchedAt } = await fetcher.get(book.productUrl);
        const raw = extractBook(html, book, fetchedAt);
        const result = validate(raw);
        if (result.book) records.set(result.book.product_url, result.book);
        else errors.push({ type: 'validation', product_url: book.productUrl, reason: result.error, record: raw });
      } catch (error) {
        report.failed_pages++;
        errors.push({ type: 'fetch', product_url: book.productUrl, reason: error.message });
        console.error(`SKIP ${book.productUrl}: ${error.message}`);
        if (error.status === 403 || error.status === 429) {
          report.fatal_error = `Stopped after HTTP ${error.status}`;
          break;
        }
      }
    }
    await writeJson('books.json', [...records.values()]);
    await writeJson('errors.json', errors);
    report.valid_records = records.size;
    report.invalid_records = errors.filter((error) => error.type === 'validation').length;
    console.log(`detail_pages=${books.length} valid_records=${records.size} invalid_records=${errors.length}`);
    if (report.fatal_error) process.exitCode = 1;
  } catch (error) {
    report.fatal_error = error.message;
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    report.duration_ms = Date.now() - started;
    Object.assign(report, fetcher.stats);
    await writeJson('run-report.json', report);
    console.log(`report=${path.join(OUTPUT_DIR, 'run-report.json')}`);
  }
  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--inject-bad-url')) {
    console.error('Usage: npm start -- [--inject-bad-url]');
    process.exitCode = 1;
  } else {
    run({ injectBadUrl: args.includes('--inject-bad-url') }).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}

module.exports = { run, BAD_URL };
