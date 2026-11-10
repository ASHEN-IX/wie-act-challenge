import type { DomainRequest } from '../../../../src/framework/contracts';
import type { IUser } from '../models/User';
import { errorDetails } from '@noveris/shared/errors';
import { createContracts } from '@noveris/shared/domainContracts';
import Joi from 'joi';
import Stripe from 'stripe';
import { authenticate } from '@noveris/shared/auth';
import type { Response } from 'express';
import User from '../models/User';
import Payment from '../models/Payment';
import { prisma } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import { MONTH_OPTIONS, calculatePlanPrice } from '../config/pricing';

const router = createContracts();

const subscriptionSchema = Joi.object({
  tier: Joi.string().valid('vip', 'vip_plus').required(),
  durationMonths: Joi.number()
    .integer()
    .valid(...MONTH_OPTIONS)
    .default(1),
  successPath: Joi.string().optional().allow(''),
  cancelPath: Joi.string().optional().allow('')
});

const confirmCheckoutSchema = Joi.object({
  sessionId: Joi.string().trim().required()
});

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

router.get('/config', (req: DomainRequest, res: Response) => {
  return res.json({ stripeConfigured: Boolean(stripe) });
});

function logError(label: string, err: unknown): void {
  const message = errorDetails(err).message;
  process.stderr.write(`[stripe] ${label}: ${message}\n`);
}

function addMonths(baseDate: Date, months: number): Date {
  const next = new Date(baseDate);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getSubscriptionSnapshot(user: IUser) {
  const now = new Date();
  if (!user.subscriptionEndAt || !['vip', 'vip_plus'].includes(user.tier)) {
    return { hasActiveSubscription: false, daysRemaining: 0, canChangePlan: true };
  }

  const end = new Date(user.subscriptionEndAt);
  if (end <= now) {
    return { hasActiveSubscription: false, daysRemaining: 0, canChangePlan: true };
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
  return {
    hasActiveSubscription: true,
    daysRemaining,
    canChangePlan: daysRemaining <= 5
  };
}

function getFrontendBaseUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

export async function applyCheckoutSession(
  session: Stripe.Checkout.Session,
  { stripeEventId = null }: { stripeEventId?: string | null } = {}
) {
  const userId = session.metadata?.userId;
  const rawTier = session.metadata?.tier;
  const targetTier = (['vip', 'vip_plus'].includes(String(rawTier)) ? rawTier : null) as
    'vip' | 'vip_plus' | null;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription?.id ?? null);
  const customerId =
    typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
  const durationMonths = Number(session.metadata?.durationMonths || 1);
  if (
    !userId ||
    !targetTier ||
    !MONTH_OPTIONS.some((months) => months === durationMonths) ||
    session.payment_status !== 'paid' ||
    !session.id ||
    !Number.isFinite(session.created)
  ) {
    return { applied: false, reason: 'invalid_paid_checkout' };
  }
  // Stable purchase time, never the time of a webhook retry or confirmation.
  const startAt = new Date(session.created * 1000);
  const endAt = addMonths(startAt, durationMonths);
  const user = await User.findById(userId);
  if (!user) return { applied: false, reason: 'user_not_found' };
  // The entitlement and once-only marker live in the same atomic document write.
  // A later purchase wins, including when old webhook events arrive out of order.
  // The entitlement and once-only marker commit together; a later purchase wins,
  // including when old webhook events arrive out of order.
  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { appliedCheckoutSessionIds: true, entitlementPurchasedAt: true }
    });
    if (!current) return;
    if (current.appliedCheckoutSessionIds.includes(session.id)) return;
    if (current.entitlementPurchasedAt && current.entitlementPurchasedAt > startAt) return;
    await tx.user.update({
      where: { id: userId },
      data: {
        tier: targetTier,
        tierChangedAt: startAt,
        entitlementPurchasedAt: startAt,
        subscriptionId,
        stripeCustomerId: customerId,
        subscriptionStartAt: startAt,
        subscriptionEndAt: endAt,
        subscriptionDurationMonths: durationMonths,
        renewalDate: endAt,
        canChangeAfter: new Date(endAt.getTime() - 5 * 86400000),
        autoRenew: false,
        appliedCheckoutSessionIds: [...current.appliedCheckoutSessionIds, session.id]
      }
    });
  });
  // This is deliberately after the account write. A retry repairs the ledger if
  // it failed; it cannot reapply or extend the atomic entitlement above.
  await prisma.payment.upsert({
    where: { stripeCheckoutSessionId: session.id },
    update: {
      userId,
      tier: targetTier,
      ...(stripeEventId ? { stripeEventId } : {}),
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      durationMonths,
      monthlyPriceCents: Number(session.metadata?.monthlyPriceCents || 0),
      discountPercentage: Number(session.metadata?.discountPercentage || 0),
      amount: session.amount_total ?? null,
      currency: session.currency || 'usd',
      status: 'succeeded'
    },
    create: {
      id: newId(),
      userId,
      tier: targetTier,
      ...(stripeEventId ? { stripeEventId } : {}),
      stripeCheckoutSessionId: session.id,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      durationMonths,
      monthlyPriceCents: Number(session.metadata?.monthlyPriceCents || 0),
      discountPercentage: Number(session.metadata?.discountPercentage || 0),
      amount: session.amount_total ?? null,
      currency: session.currency || 'usd',
      status: 'succeeded'
    }
  });
  return { applied: true, userId, tier: targetTier, durationMonths };
}

async function upsertCustomer(user: IUser): Promise<string> {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe!.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: String(user.id) }
  });

  user.stripeCustomerId = customer.id;
  await User.save(user);
  return customer.id;
}

router.post('/subscribe', authenticate, async (req: DomainRequest, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const { error, value } = subscriptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const current = getSubscriptionSnapshot(user);
    if (current.hasActiveSubscription && !current.canChangePlan) {
      return res.status(403).json({
        error: `Plan change is locked until the last 5 days of your current subscription (${current.daysRemaining} days left)`
      });
    }

    const pricing = calculatePlanPrice(value.tier, value.durationMonths);

    const customerId = await upsertCustomer(user);
    const frontendBase = getFrontendBaseUrl();
    const successPath = value.successPath || '/checkout/success';
    const cancelPath = value.cancelPath || '/checkout/cancel';

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: pricing.finalAmountCents,
            product_data: {
              name: `Noveris ${value.tier === 'vip_plus' ? 'VIP+' : 'VIP'} (${pricing.durationMonths} month${pricing.durationMonths > 1 ? 's' : ''})`,
              description: `${pricing.durationMonths} month subscription prepaid${pricing.discountPercentage ? ` with ${pricing.discountPercentage}% discount` : ''}`
            }
          },
          quantity: 1
        }
      ],
      success_url: `${frontendBase}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}${cancelPath}`,
      metadata: {
        userId: String(user.id),
        tier: value.tier,
        durationMonths: String(pricing.durationMonths),
        monthlyPriceCents: String(pricing.monthlyPriceCents),
        discountPercentage: String(pricing.discountPercentage)
      }
    });

    await Payment.create({
      id: newId(),
      userId: String(user.id),
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCustomerId: customerId,
      tier: value.tier as 'vip' | 'vip_plus',
      durationMonths: pricing.durationMonths,
      monthlyPriceCents: pricing.monthlyPriceCents,
      discountPercentage: pricing.discountPercentage,
      status: 'pending',
      currency: 'usd'
    });

    return res.json({
      checkoutUrl: checkoutSession.url,
      checkoutSessionId: checkoutSession.id
    });
  } catch (err) {
    logError('stripe_subscribe_error', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.get('/subscription/status', authenticate, async (req: DomainRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      tier: user.tier,
      subscriptionId: user.subscriptionId || null,
      stripeCustomerId: user.stripeCustomerId || null,
      stripeConfigured: Boolean(stripe)
    });
  } catch (err) {
    logError('stripe_subscription_status_error', err);
    return res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

router.post('/confirm', authenticate, async (req: DomainRequest, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const { error, value } = confirmCheckoutSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const session: Stripe.Checkout.Session = await stripe.checkout.sessions.retrieve(
      value.sessionId
    );
    if (!session) {
      return res.status(404).json({ error: 'Checkout session not found' });
    }

    const sessionUserId = session.metadata?.userId;
    if (!sessionUserId || String(sessionUserId) !== String(req.user!.userId)) {
      return res.status(403).json({ error: 'Session does not belong to current user' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(409).json({
        error: 'Payment not completed yet',
        paymentStatus: session.payment_status || 'unknown'
      });
    }

    const result = await applyCheckoutSession(session);
    if (!result.applied) {
      return res.status(422).json({ error: 'Checkout metadata is incomplete' });
    }

    return res.json({
      success: true,
      tier: result.tier,
      durationMonths: result.durationMonths,
      source: 'confirm_endpoint'
    });
  } catch (err) {
    logError('stripe_confirm_checkout_error', err);
    return res.status(500).json({ error: 'Failed to confirm checkout session' });
  }
});

async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await applyCheckoutSession(session, { stripeEventId: event.id });
    return;
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;

    await Payment.updateOne(
      { stripeSubscriptionId: subscription.id },
      { stripeEventId: event.id, status: 'canceled', metadata: subscription as never }
    );

    await User.updateOne(
      { subscriptionId: subscription.id },
      {
        tier: 'normal',
        tierChangedAt: new Date(),
        subscriptionId: null,
        subscriptionStartAt: null,
        subscriptionEndAt: null,
        subscriptionDurationMonths: 0,
        renewalDate: null,
        canChangeAfter: null,
        autoRenew: false
      }
    );
  }
}

export async function webhookHandler(req: DomainRequest, res: Response) {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return res.status(400).json({ error: 'Missing Stripe webhook signature/secret' });
    }

    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    const alreadyHandled = await Payment.findOne({ stripeEventId: event.id });
    if (alreadyHandled) {
      return res.json({ received: true, duplicate: true });
    }

    await processWebhookEvent(event);

    return res.json({ received: true });
  } catch (err) {
    logError('stripe_webhook_error', err);
    return res.status(400).json({ error: 'Webhook verification failed' });
  }
}

export { router };
export default router;
