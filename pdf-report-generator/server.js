'use strict';

const express = require('express');

const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Report API listening on http://localhost:${port}`));
}

module.exports = app;
