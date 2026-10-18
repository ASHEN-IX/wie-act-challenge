// Public application and lifecycle contract; never opens its own listener.
const studyService = {
  get app() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./src/app');
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  startPoller: () => require('./src/services/competencyUpdater').startCompetencyUpdater(),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  startConsumers: () => require('./src/services/ingestStatus').startIngestStatusTracker()
};

export default studyService;
module.exports = studyService;
