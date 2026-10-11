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
  { id: 'make-report', triggers: { event: 'report/requested' } },
  async ({ event, step }) => {
    const { id, topic } = event.data;
    await step.sleep('do-the-slow-work', '8s');
    return step.run('build-report', () => {
      const report = reports.get(id);
      const result = `Report on ${topic}: background work completed.`;
      if (report) reports.set(id, { ...report, status: 'done', result });
      return result;
    });
  },
);

module.exports = { inngest, sayHello, makeReport };
