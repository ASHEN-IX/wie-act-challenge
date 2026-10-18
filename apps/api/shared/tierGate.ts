import type { Request, Response, NextFunction } from 'express';
import { effectiveTier } from './entitlements';

/**
 * Tier-based access control middleware.
 * Usage: tierGate('vip', 'vip_plus', 'trial')
 */
export const tierGate =
  (...allowedTiers: string[]) =>
  (req: Request, res: Response, next: NextFunction): any => {
    const userTier = effectiveTier((req as any).user || {});

    // Auto-downgrade expired trials
    if (
      (req as any).user?.tier === 'trial' &&
      (req as any).user?.trialExpiresAt &&
      new Date((req as any).user.trialExpiresAt) < new Date()
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
