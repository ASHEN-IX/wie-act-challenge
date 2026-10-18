export interface AccountEntitlements {
  tier?: string;
  trialExpiresAt?: Date | string | null;
  subscriptionEndAt?: Date | string | null;
}

export function effectiveTier(account: AccountEntitlements, now = Date.now()): string {
  const tier = account.tier || 'normal';
  const expiry = tier === 'trial' ? account.trialExpiresAt : account.subscriptionEndAt;
  if (
    expiry &&
    (!Number.isFinite(new Date(expiry).getTime()) || new Date(expiry).getTime() <= now)
  ) {
    return 'normal';
  }
  return tier;
}

export const AI_JOB_TIERS: Record<string, readonly string[]> = {
  'study.ingest.course': ['vip', 'vip_plus', 'trial'],
  'study.knowledge.extract': ['vip', 'vip_plus', 'trial'],
  'study.plan.generate': ['vip', 'vip_plus', 'trial'],
  'study.schedule.apply': ['vip', 'vip_plus', 'trial'],
  'study.eval.step': ['vip', 'vip_plus', 'trial'],
  'study.search.query': ['vip', 'vip_plus', 'trial'],
  'study.coach.nudge': ['vip_plus', 'trial']
};

module.exports = { effectiveTier, AI_JOB_TIERS };
