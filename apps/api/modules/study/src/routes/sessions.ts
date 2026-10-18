// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@study-partner/shared/domainContracts');
const router = createContracts();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require('./coreSessions');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const challenge = require('./challengeSessions');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tasks = require('./sessionTasks');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const team = require('./teamSessions');

router.use('/', core);
router.use('/', challenge);
router.use('/', tasks);
router.use('/', team);

export default router;
module.exports = router;
