'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Fetcher, BASE_URL } = require('../src/fetcher');
const { parseCatalogue } = require('../src/catalogue');
const { extractBook } = require('../src/book');
const { validate } = require('../src/schema');

test('fetch writes a cache entry and reuses it without another request', async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flyrank-cache-'));
  let calls = 0;
  const fetcher = new Fetcher({
    cacheDir, delayMs: 0, log: () => {},
    fetchImpl: async () => { calls++; return { status: 200, text: async () => '<html>ok</html>' }; },
  });
  try {
    const first = await fetcher.get(BASE_URL);
    const second = await fetcher.get(BASE_URL);
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.deepEqual(fetcher.stats, { pages_fetched: 1, cache_hits: 1, requests_made: 1 });
  } finally {
    await fs.rm(cacheDir, { recursive: true, force: true });
  }
});

test('server errors retry once, while 404 does not retry', async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flyrank-retry-'));
  let calls = 0;
  const fetcher = new Fetcher({
    cacheDir, delayMs: 0, log: () => {},
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? { status: 503 }
        : { status: 200, text: async () => 'recovered' };
    },
  });
  try {
    assert.equal((await fetcher.get(BASE_URL)).html, 'recovered');
    assert.equal(calls, 2);
    const missing = new Fetcher({ cacheDir, delayMs: 0, log: () => {}, fetchImpl: async () => { calls++; return { status: 404 }; } });
    await assert.rejects(missing.get('https://books.toscrape.com/catalogue/missing/index.html'), /HTTP 404/);
    assert.equal(calls, 3);
  } finally {
    await fs.rm(cacheDir, { recursive: true, force: true });
  }
});

test('catalogue URLs resolve and duplicate links collapse to one record identity', () => {
  const html = '<ol class="row"><li><article class="product_pod"><h3><a href="catalogue/book_1/index.html">Book</a></h3></article></li><li><article class="product_pod"><h3><a href="catalogue/book_1/index.html">Book</a></h3></article></li></ol><li class="next"><a href="catalogue/page-2.html">next</a></li>';
  const parsed = parseCatalogue(html, BASE_URL);
  assert.equal(parsed.links.length, 2);
  assert.equal(new Set(parsed.links).size, 1);
  assert.equal(parsed.nextUrl, 'https://books.toscrape.com/catalogue/page-2.html');
});

test('missing description remains null and malformed price fails validation', () => {
  const html = '<div class="product_main"><h1>Sample</h1><p class="price_color">£12.34</p><p class="instock availability"> In stock (2 available) </p><p class="star-rating Three"></p></div>';
  const raw = extractBook(html, { productUrl: 'https://books.toscrape.com/catalogue/sample/index.html', sourcePage: BASE_URL }, '2026-10-08T00:00:00.000Z');
  assert.equal(raw.description, null);
  assert.equal(validate(raw).book.price_gbp, 12.34);
  assert.match(validate({ ...raw, price_text: 'not a price' }).error, /price/);
});
