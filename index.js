const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');
const db = require('./db');

const app = express();
const port = 3000;
app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
const tasks = [
  { id: 1, title: 'Plan the week', done: false },
  { id: 2, title: 'Review API notes', done: true },
  { id: 3, title: 'Write a task', done: false },
];
const toTask = (row) => ({ ...row, done: Boolean(row.done) });

app.get('/', (_req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/tasks', (_req, res) => {
  res.json(db.prepare('SELECT id, title, done FROM tasks ORDER BY id').all().map(toTask));
});

app.get('/tasks/:id', (req, res) => {
  const row = db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: `Task ${req.params.id} not found` });
  res.json(toTask(row));
});

app.post('/tasks', (req, res) => {
  const title = req.body?.title;
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title must be a nonempty string' });
  }
  const result = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)').run(title.trim(), 0);
  const task = { id: Number(result.lastInsertRowid), title: title.trim(), done: false };
  res.status(201).json(task);
});

app.put('/tasks/:id', (req, res) => {
  const task = tasks.find((item) => item.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: `Task ${req.params.id} not found` });

  const body = req.body;
  const validBody = body && typeof body === 'object' && !Array.isArray(body);
  const keys = validBody ? Object.keys(body) : [];
  if (!keys.length || keys.some((key) => !['title', 'done'].includes(key)) ||
      ('title' in body && (typeof body.title !== 'string' || !body.title.trim())) ||
      ('done' in body && typeof body.done !== 'boolean')) {
    return res.status(400).json({ error: 'Provide a nonempty title and/or a boolean done' });
  }

  if ('title' in body) task.title = body.title.trim();
  if ('done' in body) task.done = body.done;
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const index = tasks.findIndex((item) => item.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: `Task ${req.params.id} not found` });
  tasks.splice(index, 1);
  res.status(204).end();
});

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  next(error);
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Task API listening at http://localhost:${port}`);
});
