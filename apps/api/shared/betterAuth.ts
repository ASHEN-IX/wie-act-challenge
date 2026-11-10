import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { prisma, prismaClient } from './database';
import { newId } from './ids';
// @ts-ignore
import bcrypt from 'bcryptjs';
import nodemailer, { SendMailOptions } from 'nodemailer';
import type { IncomingHttpHeaders } from 'node:http';
import { effectiveTier } from './entitlements';

export type AuthInstance = Awaited<ReturnType<typeof createAuth>>;

/** Defaults written onto every new domain user; mirrors the previous schema defaults. */
export function defaultNotificationPreferences() {
  return {
    emailOnVerification: true,
    emailOnLevelUp: true,
    emailOnTaskDue: false,
    emailOnSessionReminder: false,
    emailOnWeeklySummary: true,
    emailOnAchievement: true,
    emailOnPasswordReset: true,
    emailOnSubscriptionUpdate: true
  };
}

let singleton: Promise<AuthInstance> | undefined;

export function trustedOrigins(): string[] {
  return (process.env.AUTH_TRUSTED_ORIGINS || process.env.APP_URL || 'http://localhost:3000')
    .split(',')
    .map((value) => new URL(value.trim()).origin);
}

function normalizeOnboarding(value: unknown = {}) {
  const input: Record<string, unknown> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const preferences =
    input.notificationPreferences && typeof input.notificationPreferences === 'object'
      ? input.notificationPreferences
      : {};
  const strings = (value: unknown, limit: number): string[] =>
    Array.isArray(value)
      ? value
          .filter((item) => typeof item === 'string')
          .map((item) => item.trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, limit)
      : [];
  return {
    studyGoals: strings(input.studyGoals, 10),
    preferredSubjects: strings(input.preferredSubjects, 20),
    weeklyHours: Math.max(
      0,
      Math.min(
        120,
        typeof input.weeklyHours === 'number' && Number.isFinite(input.weeklyHours)
          ? input.weeklyHours
          : 0
      )
    ),
    studyLevel:
      typeof input.studyLevel === 'string' &&
      ['beginner', 'intermediate', 'advanced'].includes(input.studyLevel)
        ? input.studyLevel
        : 'beginner',
    studyTime:
      typeof input.studyTime === 'string' &&
      ['morning', 'afternoon', 'evening', 'night'].includes(input.studyTime)
        ? input.studyTime
        : 'evening',
    timezone: typeof input.timezone === 'string' ? input.timezone.slice(0, 100) : 'UTC',
    language: typeof input.language === 'string' ? input.language.slice(0, 20) : 'en',
    notificationPreferences: {
      email: !('email' in preferences) || preferences.email !== false,
      push: !('push' in preferences) || preferences.push !== false
    }
  };
}

export interface CreateAuthOptions {
  sendMail?: (message: SendMailOptions) => Promise<void>;
  baseURL?: string;
}

export async function createAuth({
  sendMail,
  baseURL = process.env.BETTER_AUTH_URL || process.env.APP_URL || 'http://localhost:3000'
}: CreateAuthOptions = {}) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  if (
    process.env.NODE_ENV === 'production' &&
    new URL(baseURL).protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)
  )
    throw new Error('Production authentication requires HTTPS');
  const deliver =
    sendMail ||
    (async (message: SendMailOptions) => {
      if (!process.env.SMTP_HOST)
        throw new Error('SMTP_HOST is required for authentication email delivery');
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined
      });
      await transport.sendMail({
        from: process.env.EMAIL_FROM || 'Noveris <noreply@noveris.app>',
        ...message
      });
    });
  return betterAuth({
    appName: 'Noveris',
    disabledPaths: ['/sign-in/email-otp'],
    baseURL,
    basePath: '/api/auth',
    secret,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: trustedOrigins(),
    // The Prisma adapter addresses models by their Prisma model name; `@@map`
    // already points each one at the `auth_*` table.
    user: { modelName: 'AuthUser' },
    account: { modelName: 'AuthAccount' },
    verification: { modelName: 'AuthVerification' },
    session: {
      modelName: 'AuthSession',
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false }
    },
    advanced: {
      useSecureCookies: new URL(baseURL).protocol === 'https:',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      database: {
        // Ids double as domain row ids (VarChar(24)); keep the ObjectId shape.
        generateId: () => newId()
      }
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: hashPassword,
        verify: async ({ hash, password }: { hash: string; password: string }) =>
          /^\$2[aby]\$/.test(hash)
            ? bcrypt.compare(password, hash)
            : verifyPassword({ hash, password })
      },
      sendResetPassword: async ({ user, url }) =>
        deliver({
          to: user.email,
          subject: 'Reset your Noveris password',
          text: `Reset your password: ${url}`
        })
    },
    emailVerification: {
      sendOnSignUp: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) =>
        deliver({
          to: user.email,
          subject: 'Verify your Noveris email',
          text: `Verify your email: ${url}`
        }),
      afterEmailVerification: async (user): Promise<void> => {
        await prisma.user.updateMany({ where: { id: user.id }, data: { isVerified: true } });
      }
    },
    plugins: [
      emailOTP({
        disableSignUp: true,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        sendVerificationOTP: async ({ email, otp }: { email: string; otp: string }) =>
          deliver({
            to: email,
            subject: 'Your Noveris verification code',
            text: `Verification code: ${otp}. Expires in 10 minutes.`
          })
      })
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (['/sign-up/email', '/reset-password', '/change-password'].includes(ctx.path)) {
          const password = ctx.body?.newPassword || ctx.body?.password;
          if (
            password &&
            !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/.test(password)
          )
            throw new APIError('BAD_REQUEST', {
              message: 'Password requires uppercase, lowercase, number and special character'
            });
        }
        if (ctx.path === '/sign-in/email') {
          const user = await prisma.user.findUnique({
            where: {
              email: String(ctx.body?.email || '')
                .toLowerCase()
                .trim()
            },
            select: { isActive: true }
          });
          if (user && user.isActive === false)
            throw new APIError('FORBIDDEN', { message: 'Account is deactivated' });
        }
      })
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, context) => {
            const now = new Date();
            // The auth id becomes the domain user id so every existing
            // `userId` reference stays valid after the migration.
            await prisma.user.upsert({
              where: { id: user.id },
              update: {},
              create: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: 'student',
                isAdmin: false,
                isActive: true,
                onboardingDraft: normalizeOnboarding(context?.body?.onboarding),
                isVerified: user.emailVerified,
                tier: 'trial',
                trialStartedAt: now,
                trialExpiresAt: new Date(now.getTime() + 15 * 86400000),
                notificationPreferences: defaultNotificationPreferences(),
                createdAt: now,
                updatedAt: now
              }
            });
          }
        }
      },
      session: {
        create: {
          before: async (session) => {
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { id: true, isActive: true }
            });
            if (!user || user.isActive === false) return false;
            await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
            return { data: session };
          }
        }
      }
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'AuthRateLimit',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/email-otp/*': { window: 60, max: 10 }
      }
    },
    logger: { disabled: true }
  });
}

export async function getAuth() {
  if (!singleton)
    singleton = (async () => {
      await prismaClient().$queryRaw`SELECT 1`;
      return createAuth();
    })().catch((error) => {
      singleton = undefined;
      throw error;
    });
  return singleton;
}

export async function closeAuth() {
  singleton = undefined;
}

export async function resolveIdentity(headers: Headers | IncomingHttpHeaders, auth?: AuthInstance) {
  auth ||= await getAuth();
  const session = await auth.api.getSession({
    headers:
      headers instanceof Headers
        ? new Headers(headers)
        : new Headers(
            Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]))
          ),
    query: { disableCookieCache: true }
  });
  if (!session) return null;
  const domain = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isAdmin: true,
      isActive: true,
      tier: true,
      trialExpiresAt: true,
      subscriptionEndAt: true
    }
  });
  if (!domain || domain.isActive === false) return null;
  return {
    ...session,
    domain,
    identity: {
      userId: String(domain.id),
      email: domain.email,
      name: domain.name || session.user.name || 'Learner',
      role: domain.role,
      isAdmin: domain.role === 'admin',
      tier: effectiveTier({
        tier: domain.tier,
        trialExpiresAt: domain.trialExpiresAt,
        subscriptionEndAt: domain.subscriptionEndAt
      }),
      isActive: domain.isActive,
      trialExpiresAt: domain.trialExpiresAt,
      subscriptionEndAt: domain.subscriptionEndAt
    }
  };
}
