const { Inngest } = require('inngest');

const inngest = new Inngest({ id: 'report-api' });

const sayHello = inngest.createFunction(
  { id: 'say-hello', triggers: { event: 'test/hello' } },
  async ({ step }) => {
    await step.sleep('wait-five-seconds', '5s');
    return 'Hello from the background!';
  },
);

module.exports = { inngest, sayHello };
