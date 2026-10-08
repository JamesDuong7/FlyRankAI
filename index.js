const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');
const { createAuthClient, url: supabaseUrl, key: supabaseKey } = require('./supabaseClient');
const tasks = require('./taskService');

const app = express();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}
createAuthClient();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const authCall = async (operation) => {
  try {
    return await operation();
  } catch (_error) {
    const error = new Error('Authentication service unavailable');
    error.status = 502;
    throw error;
  }
};

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.get('/', (_req, res) => {
  res.json({ name: 'FlyRankAI Auth and Task API', version: '2.0', endpoints: ['/auth/signup', '/auth/login', '/public/info', '/protected/profile', '/tasks', '/docs/'] });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const credentials = (body) => {
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password.trim()) return null;
  return { email: email.trim(), password };
};

app.post('/auth/signup', asyncRoute(async (req, res) => {
  const input = credentials(req.body);
  if (!input) return res.status(400).json({ error: 'Email and password are required' });
  const { data, error } = await authCall(() => createAuthClient().auth.signUp(input));
  if (error) {
    return res.status(error.status >= 500 || !error.status ? 502 : 400)
      .json({ error: error.status >= 500 || !error.status ? 'Authentication service unavailable' : error.message });
  }
  res.status(201).json({ user: data.user });
}));

app.post('/auth/login', asyncRoute(async (req, res) => {
  const input = credentials(req.body);
  if (!input) return res.status(400).json({ error: 'Email and password are required' });
  const { data, error } = await authCall(() => createAuthClient().auth.signInWithPassword(input));
  if (error || !data.session) {
    const unavailable = error && (error.status >= 500 || !error.status);
    return res.status(unavailable ? 502 : 401)
      .json({ error: unavailable ? 'Authentication service unavailable' : 'Invalid login credentials' });
  }
  res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}));

app.get('/public/info', (_req, res) => {
  res.json({ message: 'Welcome stranger! This info is public.' });
});

const requireAuth = asyncRoute(async (req, res, next) => {
  const header = req.get('Authorization');
  if (!header || !/^Bearer [^\s]+$/.test(header)) {
    return res.status(401).json({ error: 'Access token required' });
  }
  const token = header.slice(7);
  const { data, error } = await authCall(() => createAuthClient().auth.getUser(token));
  if (error || !data.user) {
    const unavailable = error && (error.status >= 500 || !error.status);
    return res.status(unavailable ? 502 : 401)
      .json({ error: unavailable ? 'Authentication service unavailable' : 'Invalid or expired token' });
  }
  req.user = data.user;
  req.accessToken = token;
  next();
});

app.get('/protected/profile', requireAuth, (req, res) => {
  const { id, email, created_at } = req.user;
  res.json({ id, email, created_at });
});

app.get('/protected/dashboard', requireAuth, (req, res) => {
  res.json({ message: 'Welcome to your dashboard', user_id: req.user.id });
});

app.post('/auth/logout', requireAuth, asyncRoute(async (req, res) => {
  const response = await authCall(() => fetch(`${supabaseUrl}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${req.accessToken}`,
    },
  }));
  if (!response.ok) return res.status(502).json({ error: 'Could not end session' });
  res.status(204).end();
}));

app.use('/tasks', requireAuth);

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
