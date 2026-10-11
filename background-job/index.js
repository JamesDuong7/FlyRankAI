const express = require('express');
const { randomUUID } = require('node:crypto');
const { serve } = require('inngest/express');
const { inngest, sayHello, makeReport, heartbeat } = require('./inngest');
const reports = require('./reports');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use('/api/inngest', serve({ client: inngest, functions: [sayHello, makeReport, heartbeat] }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/reports', async (request, response) => {
  const topic = request.body?.topic;
  if (typeof topic !== 'string' || !topic.trim()) {
    return response.status(400).json({ error: 'A nonempty topic is required' });
  }

  const report = { id: randomUUID(), topic: topic.trim(), status: 'pending' };
  reports.set(report.id, report);
  try {
    await inngest.send({ name: 'report/requested', data: { id: report.id, topic: report.topic } });
  } catch (error) {
    reports.delete(report.id);
    console.error('Could not queue report:', error);
    return response.status(503).json({ error: 'Could not queue report' });
  }
  return response.status(202).json({ id: report.id, status: report.status });
});

app.get('/reports/:id', (request, response) => {
  const report = reports.get(request.params.id);
  if (!report) return response.status(404).json({ error: 'Report not found' });
  return response.json(report);
});

app.listen(port, () => {
  console.log(`Report API listening at http://localhost:${port}`);
});
