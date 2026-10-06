const express = require('express');

const app = express();
const port = 3000;

app.get('/', (_req, res) => {
  res.send('Hello, Task API!');
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Task API listening at http://localhost:${port}`);
});
