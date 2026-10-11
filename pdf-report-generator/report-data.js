'use strict';

const { openDb } = require('./db');

const SQL = {
  summary: 'SELECT COUNT(*) AS book_count, AVG(price) AS average_price FROM books',
  topFive: 'SELECT title, price, rating FROM books ORDER BY price DESC, title ASC LIMIT 5',
  ratings: 'SELECT rating, COUNT(*) AS book_count FROM books GROUP BY rating ORDER BY rating',
  allBooks: 'SELECT title, price, rating, url FROM books ORDER BY title COLLATE NOCASE, id',
};

function getReportData(connection) {
  const ownsDb = !connection;
  const db = connection || openDb();
  try {
    const summary = db.prepare(SQL.summary).get();
    return {
      bookCount: summary.book_count,
      averagePrice: summary.average_price,
      topFive: db.prepare(SQL.topFive).all(),
      ratings: db.prepare(SQL.ratings).all(),
      books: db.prepare(SQL.allBooks).all(),
    };
  } finally {
    if (ownsDb) db.close();
  }
}

module.exports = { SQL, getReportData };
