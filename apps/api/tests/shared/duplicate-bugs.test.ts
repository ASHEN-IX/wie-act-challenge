/** Regression tests for audit §5.5 / T9 duplicate-definition bugs. */

const fs = require('fs');
const path = require('path');

import { getBadgeKeyForRank } from '../../modules/user-profile/src/services/leaderboardService';

describe("badge key regression ('use' key bug, leaderboardService)", () => {
  const getBadgeKey = (rank: Parameters<typeof getBadgeKeyForRank>[0]) => getBadgeKeyForRank(rank);

  test('legend tier maps to its existing asset key "only"', () => {
    // legend ships public/ranking-badges/legend/only.png — never 'use'
    expect(getBadgeKey({ tier: 'Legend', division: null })).toBe('only');
  });

  test('grandmaster tier keeps its asset key "use"', () => {
    expect(getBadgeKey({ tier: 'Grandmaster', division: null })).toBe('use');
  });

  test('division tiers map to first/second/third assets', () => {
    expect(getBadgeKey({ tier: 'Novice', division: 'III' })).toBe('first');
    expect(getBadgeKey({ tier: 'Novice', division: 'II' })).toBe('second');
    expect(getBadgeKey({ tier: 'Master', division: 'I' })).toBe('third');
  });

  test('unknown division falls back to an asset that exists in every division tier', () => {
    const webPublic = path.join(__dirname, '../../../web/public/ranking-badges');
    const fallback = getBadgeKey({ tier: 'Novice', division: 'unknown' });
    const SINGLE_BADGE_TIERS = new Set(['grandmaster', 'legend']);
    for (const tier of fs.readdirSync(webPublic)) {
      if (SINGLE_BADGE_TIERS.has(tier)) continue;
      expect(fs.readdirSync(path.join(webPublic, tier))).toContain(`${fallback}.png`);
    }
  });
});
