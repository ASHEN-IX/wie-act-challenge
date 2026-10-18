const orchestrator = {
  get app() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./src/app');
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  startConsumers: () => require('./src/services/jobResultConsumer').startResultConsumer()
};

export default orchestrator;
module.exports = orchestrator;
