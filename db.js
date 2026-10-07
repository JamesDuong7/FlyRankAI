const path = require('node:path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'tasks.db'));
const tableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").get();

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1))
  )
`);

if (!tableExists) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  db.transaction(() => {
    insert.run('Plan the week', 0);
    insert.run('Review API notes', 1);
    insert.run('Write a task', 0);
  })();
}

module.exports = db;
