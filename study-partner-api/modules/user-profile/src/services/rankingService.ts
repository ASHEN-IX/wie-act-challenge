export * from './seasonService';
export * from './leaderboardService';
export * from './awardService';

import * as seasonService from './seasonService';
import * as leaderboardService from './leaderboardService';
import * as awardService from './awardService';

const rankingService = { ...seasonService, ...leaderboardService, ...awardService };
export default rankingService;
module.exports = rankingService;
