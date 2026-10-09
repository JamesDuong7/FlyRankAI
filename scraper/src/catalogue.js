'use strict';

const cheerio = require('cheerio');
const { BASE_URL } = require('./fetcher');

function parseCatalogue(html, pageUrl) {
  const $ = cheerio.load(html);
  const links = $('ol.row li article.product_pod h3 a[href]')
    .map((_index, element) => new URL($(element).attr('href'), pageUrl).href)
    .get();
  const nextHref = $('li.next a[href]').first().attr('href');
  return { links, nextUrl: nextHref ? new URL(nextHref, pageUrl).href : null };
}

async function discover(fetcher, maxPages = 3) {
  const pages = [];
  const books = new Map();
  let discovered = 0;
  let pageUrl = BASE_URL;
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    if (!pageUrl) throw new Error(`Catalogue ended before page ${pageNumber}`);
    const { html } = await fetcher.get(pageUrl);
    const { links, nextUrl } = parseCatalogue(html, pageUrl);
    pages.push(pageUrl);
    discovered += links.length;
    for (const productUrl of links) {
      if (!books.has(productUrl)) books.set(productUrl, { productUrl, sourcePage: pageUrl });
    }
    pageUrl = nextUrl;
  }
  return { pages, books: [...books.values()], discovered };
}

module.exports = { parseCatalogue, discover };
