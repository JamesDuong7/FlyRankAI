# The polite scraper

## Target classification

The target is [Books to Scrape](https://books.toscrape.com/), which [ToScrape describes as a practice sandbox](https://sites.toscrape.com/). This scraper collects the first three catalogue pages only: book title, product URL, price, availability, rating, optional description, source catalogue page, and fetch time. That bounded collection is appropriate for a public site made for scraping practice.

The single `https://books.toscrape.com/robots.txt` check returned HTTP 404 on October 8, 2026: no robots file found. A missing file is not blanket permission. I will not reuse this code on another site without checking its rules and terms first.
