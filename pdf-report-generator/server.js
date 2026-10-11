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

app.post('/reports', asyncRoute(async (_req, res) => {
  const db = openDb();
  const id = randomUUID();
  const relativePath = path.join('reports', `${id}.pdf`);
  const absolutePath = path.join(__dirname, relativePath);
  try {
    const data = getReportData(db);
    if (data.bookCount === 0) return res.status(409).json({ error: 'Seed the book database first' });
    await renderPdf(data, absolutePath);
    db.prepare('INSERT INTO reports (id, path, created_at) VALUES (?, ?, ?)')
      .run(id, relativePath, new Date().toISOString());
    res.status(201).json({ id, file: fileLink(id) });
  } catch (error) {
    await fs.rm(absolutePath, { force: true });
    throw error;
  } finally {
    db.close();
  }
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
  console.error(error);
  res.status(500).json({ error: 'Report generation failed' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Report API listening on http://localhost:${port}`));
}

module.exports = app;
