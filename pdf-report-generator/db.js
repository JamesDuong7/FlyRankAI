'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.REPORT_DB_PATH || path.join(__dirname, 'report.db');

function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0),
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      url TEXT NOT NULL UNIQUE
    );
  `);
  return db;
}

module.exports = { openDb, DB_PATH };
