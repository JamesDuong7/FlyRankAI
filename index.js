const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');
const { createAuthClient } = require('./supabaseClient');
const tasks = require('./taskService');

const app = express();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
createAuthClient();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.get('/', (_req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/tasks', asyncRoute(async (_req, res) => {
  res.json(await tasks.list());
}));

app.get('/tasks/:id', asyncRoute(async (req, res) => {
  res.json(await tasks.get(Number(req.params.id), req.params.id));
}));

app.post('/tasks', asyncRoute(async (req, res) => {
  res.status(201).json(await tasks.create(req.body));
}));

app.put('/tasks/:id', asyncRoute(async (req, res) => {
  res.json(await tasks.update(Number(req.params.id), req.params.id, req.body));
}));

app.delete('/tasks/:id', asyncRoute(async (req, res) => {
  await tasks.remove(Number(req.params.id), req.params.id);
  res.status(204).end();
}));

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Task API listening at http://localhost:${port}; Supabase client configured`);
});
