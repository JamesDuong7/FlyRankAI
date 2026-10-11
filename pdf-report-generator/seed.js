'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('./db');

const SOURCE = path.resolve(__dirname, '..', 'scraper', 'output', 'books.json');
const RATINGS = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };

function seed() {
  const books = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  if (!Array.isArray(books) || books.length !== 60) {
    throw new Error('Expected 60 validated books in scraper/output/books.json');
  }
  const rows = books.map((book) => {
    const price = book.price_gbp;
    const rating = RATINGS[book.rating_text];
    if (!book.title || !book.product_url || !Number.isFinite(price) || price < 0 || !rating) {
      throw new Error(`Invalid source book: ${book.title ?? '(untitled)'}`);
    }
    return { title: book.title, price, rating, url: book.product_url };
  });
  const db = openDb();
  try {
    db.exec('BEGIN');
    db.exec('DELETE FROM books');
    const insert = db.prepare('INSERT INTO books (title, price, rating, url) VALUES (?, ?, ?, ?)');
    for (const row of rows) insert.run(row.title, row.price, row.rating, row.url);
    db.exec('COMMIT');
    return db.prepare('SELECT COUNT(*) AS count FROM books').get().count;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

if (require.main === module) console.log(`Seeded ${seed()} books`);

module.exports = { seed };
