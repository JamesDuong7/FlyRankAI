'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const BASE_URL = 'https://books.toscrape.com/';
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/JamesDuong7/FlyRankAI)';
const CACHE_DIR = path.resolve(__dirname, '..', 'cache');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cacheName(url) {
  if (url === BASE_URL) return 'catalogue-page-1.html';
  const match = /^\/catalogue\/page-(\d+)\.html$/.exec(new URL(url).pathname);
  if (match) return `catalogue-page-${match[1]}.html`;
  const digest = crypto.createHash('sha256').update(url).digest('hex').slice(0, 20);
  return `book-${digest}.html`;
}

class Fetcher {
  constructor({ fetchImpl = fetch, cacheDir = CACHE_DIR, delayMs = 500, timeoutMs = 5000, log = console.log } = {}) {
    this.fetchImpl = fetchImpl;
    this.cacheDir = cacheDir;
    this.delayMs = delayMs;
    this.timeoutMs = timeoutMs;
    this.log = log;
    this.lastRequestAt = 0;
    this.stats = { pages_fetched: 0, cache_hits: 0, requests_made: 0 };
  }

  async get(url) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.host !== new URL(BASE_URL).host) {
      throw new Error(`Outside permitted target: ${url}`);
    }
    const file = path.join(this.cacheDir, cacheName(target.href));
    const metadata = `${file}.json`;
    try {
      const [html, meta] = await Promise.all([fs.readFile(file, 'utf8'), fs.readFile(metadata, 'utf8')]);
      const fetchedAt = JSON.parse(meta).fetched_at;
      this.stats.cache_hits++;
      this.log(`CACHE HIT ${target.href} bytes=${Buffer.byteLength(html)}`);
      return { html, fetchedAt };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      const waitMs = this.delayMs - (Date.now() - this.lastRequestAt);
      if (waitMs > 0) await sleep(waitMs);
      this.lastRequestAt = Date.now();
      this.stats.requests_made++;
      let response;
      try {
        response = await this.fetchImpl(target.href, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        if (attempt === 1 && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
          await sleep(1000);
          continue;
        }
        throw error;
      }
      if (response.status !== 200) {
        if (attempt === 1 && response.status >= 500 && response.status <= 599) {
          await sleep(1000);
          continue;
        }
        const error = new Error(`HTTP ${response.status} for ${target.href}`);
        error.status = response.status;
        throw error;
      }
      let html;
      try {
        html = await response.text();
      } catch (error) {
        if (attempt === 1 && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
          await sleep(1000);
          continue;
        }
        throw error;
      }
      const fetchedAt = new Date().toISOString();
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.writeFile(file, html);
      await fs.writeFile(metadata, JSON.stringify({ fetched_at: fetchedAt }));
      this.stats.pages_fetched++;
      this.log(`FETCH ${target.href} bytes=${Buffer.byteLength(html)}`);
      return { html, fetchedAt };
    }
    throw new Error(`Could not fetch ${target.href}`);
  }
}

module.exports = { Fetcher, BASE_URL, USER_AGENT };
