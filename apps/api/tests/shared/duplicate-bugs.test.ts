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

  test('unknown division falls back to the key every division tier uses', () => {
    // The mapping must still be total: an unknown division may not yield an
    // empty or invented key, because the projection interpolates it into a URL.
    const fallback = getBadgeKey({ tier: 'Novice', division: 'unknown' });
    expect(fallback).toBe('third');
    for (const division of ['I', 'II', 'III', 'unknown', null])
      expect(getBadgeKey({ tier: 'Novice', division })).toMatch(/^(first|second|third)$/);
  });
});

/**
 * Brand-asset coverage.
 *
 * The Noveris rebrand removed the per-tier `public/ranking-badges/*.png` set,
 * so the previous assertion (which read those folders) could only ever fail.
 * The badge *key* mapping above still matters and is still tested. What the
 * product actually ships now is the Nardouch growth-stage artwork, so that is
 * what this suite validates — every stage the shared contract can produce must
 * have a real asset, and the Noveris brand marks must exist.
 */
describe('brand asset coverage (Noveris)', () => {
  const webPublic = path.join(__dirname, '../../../web/public');

  test('every growth stage in the shared contract has a shipped asset', () => {
    // The stage vocabulary is owned by the shared contract; reading it here
    // keeps this test honest when a stage is added.
    const growth = fs.readFileSync(
      path.join(__dirname, '../../shared/ednova/nardouchGrowth.ts'),
      'utf8',
    ) as string;
    const declared = growth.match(/export type NardouchStage =([^;]+);/);
    expect(declared).not.toBeNull();
    const stages = Array.from(declared![1].matchAll(/'([a-z]+)'/g)).map((m) => m[1]);
    expect(stages.length).toBeGreaterThan(0);

    const missing = stages.filter(
      (stage) => !fs.existsSync(path.join(webPublic, 'images', `nardouch-${stage}.png`)),
    );
    expect(missing).toEqual([]);
  });

  test('the Noveris brand marks are present', () => {
    const missing = [
      'brand/noveris-symbol.svg',
      'brand/noveris-lockup-light.svg',
      'brand/noveris-lockup-dark.svg',
      'brand/favicon.svg',
    ].filter((file) => !fs.existsSync(path.join(webPublic, file)));
    expect(missing).toEqual([]);
  });

  test('no source still points at the removed ranking-badge artwork', () => {
    // The API used to serve /ranking-badges/{tier}/{key}.png. Those files are
    // gone, so a remaining consumer would emit a dead URL. This guards the
    // rebrand's completeness rather than the deleted files themselves.
    const roots = [
      path.join(__dirname, '../../modules'),
      path.join(__dirname, '../../shared'),
      path.join(__dirname, '../../../web/src'),
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next') continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        if (full === __filename) continue;
        const text = fs.readFileSync(full, 'utf8') as string;
        // A literal path used for fetching, not a comment or a test name.
        if (/imagePath:\s*`\/ranking-badges\//.test(text)) offenders.push(full);
      }
    };
    for (const root of roots) if (fs.existsSync(root)) walk(root);
    expect(offenders).toEqual([]);
  });
});
