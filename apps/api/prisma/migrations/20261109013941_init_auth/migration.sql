-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'admin');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('trial', 'normal', 'vip', 'vip_plus');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(24) NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "tier" "Tier" NOT NULL DEFAULT 'trial',
    "trialStartedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "trialExpiresAt" TIMESTAMP(3),
    "tierChangedAt" TIMESTAMP(3),
    "subscriptionId" TEXT,
    "subscriptionStartAt" TIMESTAMP(3),
    "subscriptionEndAt" TIMESTAMP(3),
    "subscriptionDurationMonths" INTEGER NOT NULL DEFAULT 0,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewalDate" TIMESTAMP(3),
    "canChangeAfter" TIMESTAMP(3),
    "subscriptionExpiryNoticeSentAt" TIMESTAMP(3),
    "entitlementPurchasedAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "verificationToken" TEXT,
    "verificationExpires" TIMESTAMP(3),
    "verificationOtp" TEXT,
    "verificationOtpExpires" TIMESTAMP(3),
    "verificationOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "appliedCheckoutSessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appliedCouponIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notificationPreferences" JSONB NOT NULL,
    "onboardingDraft" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" VARCHAR(24) NOT NULL,
    "code" TEXT NOT NULL,
    "targetTier" "Tier" NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "createdBy" VARCHAR(24),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" VARCHAR(24) NOT NULL,
    "couponId" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" VARCHAR(24) NOT NULL,
    "userId" VARCHAR(24) NOT NULL,
    "stripeEventId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "tier" "Tier" NOT NULL,
    "durationMonths" INTEGER NOT NULL DEFAULT 1,
    "monthlyPriceCents" INTEGER,
    "discountPercentage" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

-- CreateIndex
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "auth_rate_limits_key_key" ON "auth_rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isAdmin_idx" ON "users"("isAdmin");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_subscriptionEndAt_idx" ON "users"("subscriptionEndAt");

-- CreateIndex
CREATE INDEX "users_verificationToken_idx" ON "users"("verificationToken");

-- CreateIndex
CREATE INDEX "users_resetPasswordToken_idx" ON "users"("resetPasswordToken");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_targetTier_idx" ON "coupons"("targetTier");

-- CreateIndex
CREATE INDEX "coupons_expiresAt_idx" ON "coupons"("expiresAt");

-- CreateIndex
CREATE INDEX "coupons_isActive_idx" ON "coupons"("isActive");

-- CreateIndex
CREATE INDEX "coupon_usages_userId_idx" ON "coupon_usages"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_couponId_userId_key" ON "coupon_usages"("couponId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripeEventId_key" ON "payments"("stripeEventId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripeCheckoutSessionId_key" ON "payments"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payments_stripeSubscriptionId_idx" ON "payments"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "payments_stripeCustomerId_idx" ON "payments"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
