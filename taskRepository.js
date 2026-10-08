const db = require('./db');

const toTask = (row) => row && { ...row, done: Boolean(row.done) };

module.exports = {
  async list() {
    return db.prepare('SELECT id, title, done FROM tasks ORDER BY id').all().map(toTask);
  },
  async get(id) {
    return toTask(db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(id));
  },
  async create(title) {
    const result = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)').run(title, 0);
    return { id: Number(result.lastInsertRowid), title, done: false };
  },
  async update(id, { title, done }) {
    const result = db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(title, Number(done), id);
    return result.changes ? { id, title, done } : null;
  },
  async remove(id) {
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
  },
};
