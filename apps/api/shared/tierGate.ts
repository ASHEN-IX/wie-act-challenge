import type { Response, NextFunction } from 'express';
import type { DomainRequest } from '../src/framework/contracts';
import { effectiveTier } from './entitlements';

/**
 * Tier-based access control middleware.
 * Usage: tierGate('vip', 'vip_plus', 'trial')
 */
export const tierGate =
  (...allowedTiers: string[]) =>
  (req: DomainRequest, res: Response, next: NextFunction) => {
    const userTier = effectiveTier(req.user || {});

    // Auto-downgrade expired trials
    if (
      req.user?.tier === 'trial' &&
      req.user?.trialExpiresAt &&
      new Date(req.user.trialExpiresAt) < new Date()
    ) {
      return res.status(403).json({
        error: 'Trial expired',
        code: 'TRIAL_EXPIRED',
        requiredTier: allowedTiers[0],
        currentTier: 'normal',
        upgradeUrl: '/pricing'
      });
    }

    if (!allowedTiers.includes(userTier)) {
      return res.status(403).json({
        error: 'Upgrade required',
        code: 'TIER_REQUIRED',
        requiredTier: allowedTiers[0],
        currentTier: userTier,
        upgradeUrl: '/pricing'
      });
    }
    next();
  };

module.exports = { tierGate };
