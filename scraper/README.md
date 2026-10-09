# The polite scraper

## Target classification

The target is [Books to Scrape](https://books.toscrape.com/), which [ToScrape describes as a practice sandbox](https://sites.toscrape.com/). This scraper collects the first three catalogue pages only: book title, product URL, price, availability, rating, optional description, source catalogue page, and fetch time. That bounded collection is appropriate for a public site made for scraping practice.

The single `https://books.toscrape.com/robots.txt` check returned HTTP 404 on October 8, 2026: no robots file found. A missing file is not blanket permission. I will not reuse this code on another site without checking its rules and terms first.

## Run

This is the JavaScript lane. Use Node.js 20 or newer. From the repository root, one command installs the locked dependencies and runs the scraper:

```sh
npm --prefix scraper ci && npm --prefix scraper start
```

The first run fetches 3 catalogue pages and 60 book pages in roughly a minute; later runs use `scraper/cache/`. Outputs appear in `scraper/output/books.json`, `scraper/output/errors.json`, and `scraper/output/run-report.json`. To prove failure handling after a normal run, use `npm --prefix scraper start -- --inject-bad-url`. That flag adds one nonexistent URL on this sandbox and should report `failed_pages: 1` while keeping 60 good records. Run normally again to restore a clean report.

## Record schema

Each book has a nonempty `title`; an HTTPS `product_url` that serves as its unique identity; `price_text` such as `£51.77` and numeric `price_gbp`; nonempty `availability_text`; a `rating_text` of `One` through `Five`; a description string or `null`; an HTTPS `source_page`; and ISO `fetched_at`. The original price remains beside the normalized value. Zod checks the record before it enters `books.json`; rejected records go to `errors.json` with a reason. Cached pages keep their original fetch time on reruns.

## Politeness and limits

Every real request identifies this repository with a user agent, times out after 5 seconds, checks for HTTP 200, and starts at least 500 ms after the previous real request. A timeout or 5xx gets one retry after a short wait; 403 and 404 do not. A 403 or 429 stops further book requests. Cached pages never contact the site. The scraper stays on `books.toscrape.com` and stops after three catalogue pages.

The demo site's prices and ratings are randomly assigned and have no real-world meaning. The local cache is intentionally persistent: delete `scraper/cache/` only when a fresh collection is needed. No browser is needed because the catalogue and product facts are already in the server's HTML; a browser would add cost without finding more required data.

Use an official API when a site provides one. Never bypass logins, paywalls, or blocks, and collect only the data needed for the task.

## Run evidence

This is a real clean rerun after the first fetch populated the cache. It retained 60 validated books without additional site requests:

```json
{
  "start_time": "2026-10-09T06:21:27.280Z",
  "duration_ms": 120,
  "catalogue_pages": 3,
  "discovered": 60,
  "unique_urls": 60,
  "detail_pages": 60,
  "pages_fetched": 0,
  "cache_hits": 63,
  "requests_made": 0,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```
