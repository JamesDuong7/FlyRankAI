const express = require('express');

const app = express();
const port = 3000;

app.get('/', (_req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Task API listening at http://localhost:${port}`);
});
