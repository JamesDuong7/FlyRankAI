'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flyrank-report-test-'));
process.env.REPORT_DB_PATH = path.join(tempDir, 'report.db');
const { seed } = require('../seed');
const { openDb } = require('../db');
const app = require('../server');
const createdPaths = [];

after(() => {
  for (const file of createdPaths) fs.rmSync(file, { force: true });
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('seed is repeatable and rapid requests create one file; force creates another', async () => {
  assert.equal(seed(), 60);
  assert.equal(seed(), 60);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const [first, second] = await Promise.all([
      fetch(`${base}/reports`, { method: 'POST' }),
      fetch(`${base}/reports`, { method: 'POST' }),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [200, 201]);
    const [a, b] = await Promise.all([first.json(), second.json()]);
    assert.equal(a.id, b.id);
    const db = openDb();
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM reports').get().count, 1);
      createdPaths.push(path.resolve(__dirname, '..', db.prepare('SELECT path FROM reports WHERE id = ?').get(a.id).path));
    } finally { db.close(); }
    assert.equal(fs.readdirSync(path.dirname(createdPaths[0])).filter((name) => name === `${a.id}.pdf`).length, 1);
    const record = await fetch(`${base}/reports/${a.id}`);
    assert.equal(record.status, 200);
    assert.equal((await record.json()).file, a.file);
    const file = await fetch(base + a.file);
    assert.equal(file.status, 200);
    assert.equal(Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await fetch(`${base}/reports/missing`)).status, 404);
    const forced = await fetch(`${base}/reports`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ force: true }),
    });
    assert.equal(forced.status, 201);
    const fresh = await forced.json();
    assert.notEqual(fresh.id, a.id);
    const dbAfter = openDb();
    try {
      assert.equal(dbAfter.prepare('SELECT COUNT(*) AS count FROM reports').get().count, 2);
      createdPaths.push(path.resolve(__dirname, '..', dbAfter.prepare('SELECT path FROM reports WHERE id = ?').get(fresh.id).path));
    } finally { dbAfter.close(); }
  } finally {
    server.close();
  }
});
