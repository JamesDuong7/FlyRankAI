const { Inngest } = require('inngest');
const reports = require('./reports');

const inngest = new Inngest({ id: 'report-api' });

const sayHello = inngest.createFunction(
  { id: 'say-hello', triggers: { event: 'test/hello' } },
  async ({ step }) => {
    await step.sleep('wait-five-seconds', '5s');
    return 'Hello from the background!';
  },
);

const makeReport = inngest.createFunction(
  {
    id: 'make-report',
    triggers: { event: 'report/requested' },
    retries: 2,
    onFailure: async ({ event }) => {
      const { id } = event.data.event.data;
      const report = reports.get(id);
      if (report) reports.set(id, { ...report, status: 'failed' });
    },
  },
  async ({ event, step }) => {
    const { id, topic } = event.data;
    await step.sleep('do-the-slow-work', '8s');
    return step.run('build-report', () => {
      if (topic === 'fail') throw new Error('The report oven is broken!');
      const report = reports.get(id);
      const result = `Report on ${topic}: background work completed.`;
      if (report) reports.set(id, { ...report, status: 'done', result });
      return result;
    });
  },
);

const heartbeat = inngest.createFunction(
  { id: 'heartbeat', triggers: { cron: '* * * * *' } },
  async () => {
    const summary = { pending: 0, done: 0, failed: 0 };
    for (const report of reports.values()) summary[report.status]++;
    console.log(`Report heartbeat: pending=${summary.pending} done=${summary.done} failed=${summary.failed}`);
    return summary;
  },
);

module.exports = { inngest, sayHello, makeReport, heartbeat };
