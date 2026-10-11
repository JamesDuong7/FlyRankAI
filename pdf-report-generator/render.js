'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const pounds = (value) => `£${Number(value).toFixed(2)}`;

function buildHtml(data, date = new Date()) {
  const dateText = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(date);
  const topRows = data.topFive.map((book) => `<tr><td>${escapeHtml(book.title)}</td><td class="num">${pounds(book.price)}</td></tr>`).join('');
  const ratingRows = data.ratings.map((item) => `<span><strong>${item.rating} star${item.rating === 1 ? '' : 's'}</strong> ${item.book_count}</span>`).join('');
  const bookRows = data.books.map((book, index) => `<tr><td class="num muted">${index + 1}</td><td>${escapeHtml(book.title)}</td><td class="num">${book.rating}/5</td><td class="num">${pounds(book.price)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Bookstore Report</title>
<style>
  @page { size: A4; margin: 18mm 17mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #17263a; font: 11px/1.45 Arial, Helvetica, sans-serif; }
  .eyebrow { color: #167d8d; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
  h1 { margin: 8px 0 3px; font-size: 28px; line-height: 1.15; }
  h2 { margin: 23px 0 9px; font-size: 16px; color: #113950; }
  .date { margin: 0 0 18px; color: #526477; }
  .summary { display: flex; gap: 12px; }
  .card { flex: 1; padding: 15px 17px; background: #eaf5f5; border-top: 3px solid #168c99; }
  .card .label { display: block; color: #526477; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .card .value { display: block; margin-top: 3px; font-size: 24px; font-weight: 700; }
  .ratings { display: flex; justify-content: space-between; gap: 8px; padding: 10px 12px; background: #f3f6f8; }
  .ratings span { white-space: nowrap; }
  .ratings strong { color: #167d8d; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { text-align: left; color: white; background: #173d50; font-size: 10px; letter-spacing: .4px; }
  th, td { padding: 7px 8px; border-bottom: 1px solid #dbe4e9; vertical-align: top; overflow-wrap: anywhere; }
  tbody tr:nth-child(even) { background: #f4f8f9; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #6b7d89; }
  .all-books th:nth-child(1) { width: 8%; }
  .all-books th:nth-child(2) { width: 65%; }
  .all-books th:nth-child(3) { width: 12%; }
  .all-books th:nth-child(4) { width: 15%; }
  .source { margin-top: 13px; font-size: 9px; color: #6b7d89; }
</style></head><body>
  <div class="eyebrow">FlyRank · Data Report</div>
  <h1>Bookstore snapshot</h1><p class="date">Generated ${escapeHtml(dateText)}</p>
  <div class="summary"><div class="card"><span class="label">Books catalogued</span><span class="value">${data.bookCount}</span></div><div class="card"><span class="label">Average price</span><span class="value">${pounds(data.averagePrice)}</span></div></div>
  <h2>Highest priced books</h2>
  <table><thead><tr><th>Title</th><th class="num" style="width: 18%">Price</th></tr></thead><tbody>${topRows}</tbody></table>
  <h2>Books by star rating</h2><div class="ratings">${ratingRows}</div>
  <h2>Full catalogue · ${data.books.length} books</h2>
  <table class="all-books"><thead><tr><th class="num">#</th><th>Title</th><th class="num">Rating</th><th class="num">Price</th></tr></thead><tbody>${bookRows}</tbody></table>
  <p class="source">Source: 60 validated records from the repository's Books to Scrape sample. Prices in GBP.</p>
</body></html>`;
}

async function renderPdf(data, outputPath, date = new Date()) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(data, date));
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}

module.exports = { buildHtml, renderPdf };
