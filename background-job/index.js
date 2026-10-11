const express = require('express');
const { serve } = require('inngest/express');
const { inngest, sayHello } = require('./inngest');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use('/api/inngest', serve({ client: inngest, functions: [sayHello] }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Report API listening at http://localhost:${port}`);
});
