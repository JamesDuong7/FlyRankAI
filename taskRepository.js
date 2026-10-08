const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL connection error:', error);
});

module.exports = {
  async list() {
    const { rows } = await pool.query('SELECT id, title, done FROM tasks ORDER BY id');
    return rows;
  },
  async get(id) {
    const { rows } = await pool.query('SELECT id, title, done FROM tasks WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async create(title) {
    const { rows } = await pool.query(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done',
      [title]
    );
    return rows[0];
  },
  async update(id, { title, done }) {
    const { rows } = await pool.query(
      'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING id, title, done',
      [title, done, id]
    );
    return rows[0] || null;
  },
  async remove(id) {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return result.rowCount > 0;
  },
};
