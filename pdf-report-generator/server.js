'use strict';

const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { openDb } = require('./db');
const { getReportData } = require('./report-data');
const { renderPdf } = require('./render');

const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const fileLink = (id) => `/reports/${id}/file`;
const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
let inFlight = null;

function findTodayReport() {
  const db = openDb();
  try {
    const today = localDateKey(new Date());
    return db.prepare('SELECT id, path, created_at FROM reports ORDER BY created_at DESC').all()
      .find((row) => localDateKey(new Date(row.created_at)) === today);
  } finally {
    db.close();
  }
}

async function createReport() {
  const db = openDb();
  const id = randomUUID();
  const relativePath = path.join('reports', `${id}.pdf`);
  const absolutePath = path.join(__dirname, relativePath);
  try {
    const data = getReportData(db);
    if (data.bookCount === 0) {
      const error = new Error('Seed the book database first');
      error.status = 409;
      throw error;
    }
    await renderPdf(data, absolutePath);
    const createdAt = new Date().toISOString();
    db.prepare('INSERT INTO reports (id, path, created_at) VALUES (?, ?, ?)')
      .run(id, relativePath, createdAt);
    return { id, file: fileLink(id) };
  } catch (error) {
    await fs.rm(absolutePath, { force: true });
    throw error;
  } finally {
    db.close();
  }
}

app.post('/reports', asyncRoute(async (req, res) => {
  const force = req.body?.force === true;
  if (!force) {
    const existing = findTodayReport();
    if (existing) return res.json({ id: existing.id, file: fileLink(existing.id) });
    if (inFlight) return res.json(await inFlight);
    const job = createReport();
    inFlight = job;
    try {
      return res.status(201).json(await job);
    } finally {
      if (inFlight === job) inFlight = null;
    }
  }
  res.status(201).json(await createReport());
}));

app.get('/reports/:id', (req, res) => {
  const db = openDb();
  try {
    const row = db.prepare('SELECT id, path, created_at FROM reports WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Report not found' });
    res.json({ ...row, file: fileLink(row.id) });
  } finally {
    db.close();
  }
});

app.get('/reports/:id/file', asyncRoute(async (req, res) => {
  const db = openDb();
  let row;
  try {
    row = db.prepare('SELECT path FROM reports WHERE id = ?').get(req.params.id);
  } finally {
    db.close();
  }
  if (!row) return res.status(404).json({ error: 'Report not found' });
  const absolutePath = path.join(__dirname, row.path);
  try {
    await fs.access(absolutePath);
  } catch {
    return res.status(404).json({ error: 'Report file not found' });
  }
  res.sendFile(absolutePath);
}));

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Invalid JSON body' });
  if (error.status === 409) return res.status(409).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Report generation failed' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Report API listening on http://localhost:${port}`));
}

module.exports = app;
