-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'admin');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('trial', 'normal', 'vip', 'vip_plus');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "OnlineStatus" AS ENUM ('online', 'studying', 'offline');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'rejected', 'blocked');

-- CreateEnum
CREATE TYPE "QuestType" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "QuestAction" AS ENUM ('task_complete', 'course_upload', 'focus_session', 'study_session', 'review_complete');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('active', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('pending', 'applied');

-- CreateEnum
CREATE TYPE "RankSeasonStatus" AS ENUM ('upcoming', 'active', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "BadgeKey" AS ENUM ('first', 'second', 'third', 'use');

-- CreateEnum
CREATE TYPE "CourseScope" AS ENUM ('personal', 'institutional');

-- CreateEnum
CREATE TYPE "CourseVisibility" AS ENUM ('private', 'institution', 'public');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "IngestStage" AS ENUM ('parsing', 'enriching', 'embedding', 'indexing');

-- CreateEnum
CREATE TYPE "CourseRevisionStatus" AS ENUM ('draft', 'published', 'deprecated');

-- CreateEnum
CREATE TYPE "ActivationState" AS ENUM ('prepared', 'committed');

-- CreateEnum
CREATE TYPE "CourseEnrollmentStatus" AS ENUM ('active', 'dropped', 'revoked');

-- CreateEnum
CREATE TYPE "CourseInvitationRole" AS ENUM ('student', 'instructor');

-- CreateEnum
CREATE TYPE "CourseInvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "InstitutionMembershipRole" AS ENUM ('university_admin', 'instructor', 'university_student');

-- CreateEnum
CREATE TYPE "InstitutionMembershipStatus" AS ENUM ('active', 'invited', 'suspended');

-- CreateEnum
CREATE TYPE "InstitutionInvitationRole" AS ENUM ('instructor', 'university_student');

-- CreateEnum
CREATE TYPE "InstitutionInvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "ModeratorMode" AS ENUM ('guided', 'on_demand', 'muted');

-- CreateEnum
CREATE TYPE "RoomPhase" AS ENUM ('idle', 'peer_discussion', 'individual_attempt', 'debrief');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('active', 'closed');

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
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
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "targetTier" "Tier" NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "createdBy" UUID,
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
    "id" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
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

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" VARCHAR(500),
    "avatar" TEXT NOT NULL,
    "nickname" TEXT,
    "friendCode" TEXT,
    "learningProfile" JSONB,
    "onlineStatus" "OnlineStatus" NOT NULL DEFAULT 'offline',
    "lastSeenAt" TIMESTAMP(3),
    "privacy" JSONB NOT NULL,
    "level" JSONB NOT NULL,
    "preferences" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "goals" JSONB NOT NULL DEFAULT '[]',
    "backgroundSettings" JSONB,
    "animatedBackgroundSettings" JSONB,
    "teamStats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" UUID NOT NULL,
    "requester" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_groups" (
    "id" UUID NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "subject" VARCHAR(60) NOT NULL DEFAULT '',
    "ownerId" TEXT NOT NULL,
    "activeSession" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_group_members" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_group_invites" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_group_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learningstyleprofiles" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "primary" TEXT NOT NULL,
    "ranking" JSONB NOT NULL DEFAULT '[]',
    "provisional" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learningstyleprofiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availabilityslots" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT NOT NULL DEFAULT '#ff6b6b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availabilityslots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamifications" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "evidenceAwards" JSONB NOT NULL DEFAULT '[]',
    "xpHistory" JSONB NOT NULL DEFAULT '[]',
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "stats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gamifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "QuestType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '🎯',
    "action" "QuestAction" NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "xpReward" INTEGER NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'active',
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_reward_ledger" (
    "id" UUID NOT NULL,
    "awardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completionKey" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "status" "LedgerStatus" NOT NULL,
    "xp" INTEGER,
    "reason" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_reward_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rankseasons" (
    "id" UUID NOT NULL,
    "seasonCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "status" "RankSeasonStatus" NOT NULL DEFAULT 'active',
    "resetPolicy" JSONB NOT NULL,
    "startedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rankseasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "userrankprofiles" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "currentSeasonId" UUID,
    "knowledgePoints" INTEGER NOT NULL DEFAULT 0,
    "rankIndex" INTEGER NOT NULL DEFAULT 3,
    "rankName" TEXT NOT NULL,
    "seasonPeakRankIndex" INTEGER NOT NULL DEFAULT 3,
    "allTimePeakRankIndex" INTEGER NOT NULL DEFAULT 3,
    "seasonPeakKp" INTEGER NOT NULL DEFAULT 450,
    "allTimePeakKp" INTEGER NOT NULL DEFAULT 450,
    "competitiveEventsCountSeason" INTEGER NOT NULL DEFAULT 0,
    "learningSkillRating" INTEGER NOT NULL DEFAULT 1000,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "comebackBonusRemaining" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "userrankprofiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasonresultsnapshots" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER,
    "finalRankIndex" INTEGER NOT NULL,
    "finalKnowledgePoints" INTEGER NOT NULL DEFAULT 0,
    "finalRankName" TEXT NOT NULL,
    "seasonPeakKp" INTEGER,
    "seasonPeakRankIndex" INTEGER,
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "rewardsGranted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resetApplied" JSONB NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasonresultsnapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rankeventledgers" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "baseKP" INTEGER NOT NULL DEFAULT 0,
    "multipliers" JSONB NOT NULL,
    "finalKP" INTEGER NOT NULL DEFAULT 0,
    "deltaKp" INTEGER NOT NULL DEFAULT 0,
    "beforeKp" INTEGER NOT NULL DEFAULT 0,
    "afterKp" INTEGER NOT NULL DEFAULT 0,
    "beforeRankIndex" INTEGER NOT NULL DEFAULT 0,
    "afterRankIndex" INTEGER NOT NULL DEFAULT 0,
    "rankName" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "reasonBreakdown" JSONB NOT NULL DEFAULT '{}',
    "contextSessionId" TEXT,
    "eventKey" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rankeventledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rankbadges" (
    "id" UUID NOT NULL,
    "rankIndex" INTEGER NOT NULL,
    "rankName" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "division" TEXT,
    "badgeKey" "BadgeKey" NOT NULL,
    "imagePath" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rankbadges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "color" TEXT NOT NULL DEFAULT '#ff4655',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "color" TEXT NOT NULL DEFAULT '#ff4655',
    "totalStudyTime" INTEGER NOT NULL DEFAULT 0,
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "CourseScope" NOT NULL DEFAULT 'personal',
    "visibility" "CourseVisibility",
    "institutionId" UUID,
    "ownerUserId" TEXT,
    "assignedInstructorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activeRevisionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'processing',
    "jobId" TEXT,
    "correlationId" TEXT,
    "ingestStage" "IngestStage",
    "ingestProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ingestDetail" TEXT NOT NULL DEFAULT '',
    "ingestError" TEXT NOT NULL DEFAULT '',
    "topics" JSONB NOT NULL DEFAULT '[]',
    "files" JSONB NOT NULL DEFAULT '[]',
    "processedAt" TIMESTAMP(3),
    "aiCourseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_revisions" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "revisionTag" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" "CourseRevisionStatus" NOT NULL DEFAULT 'draft',
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "summary" TEXT,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "contentDocument" JSONB,
    "formulaPublication" JSONB,
    "contentDocumentHash" TEXT,
    "vectorIndexRef" TEXT,
    "isInstructorReviewed" BOOLEAN NOT NULL DEFAULT false,
    "sourceManifest" JSONB,
    "sourceManifestDigest" TEXT,
    "indexHash" TEXT,
    "artifactHash" TEXT,
    "activationState" "ActivationState",
    "expectedActiveRevisionId" TEXT,
    "approvedActivities" JSONB,
    "revokedAt" TIMESTAMP(3),
    "__v" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "institutionId" UUID,
    "userId" TEXT NOT NULL,
    "status" "CourseEnrollmentStatus" NOT NULL DEFAULT 'active',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrolledByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_invitations" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "institutionId" UUID,
    "role" "CourseInvitationRole" NOT NULL DEFAULT 'student',
    "tokenHash" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "status" "CourseInvitationStatus" NOT NULL DEFAULT 'pending',
    "issuedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_course_joins" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_course_joins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "domain" VARCHAR(253),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_memberships" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "InstitutionMembershipRole" NOT NULL,
    "status" "InstitutionMembershipStatus" NOT NULL DEFAULT 'active',
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_invitations" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "role" "InstitutionInvitationRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InstitutionInvitationStatus" NOT NULL DEFAULT 'pending',
    "issuedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_records" (
    "id" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityRevision" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "publicDefinition" JSONB NOT NULL,
    "serverEvaluation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attempts" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityRevision" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "roomId" TEXT,
    "timeSpentSeconds" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentResult" JSONB,
    "evidenceId" TEXT,
    "protocolVersion" INTEGER,
    "processingState" TEXT,
    "submission" JSONB,
    "preparedEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_evidences" (
    "id" UUID NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "evidenceVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "userId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "activity" JSONB NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "bloomLevel" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "masteryAchieved" BOOLEAN NOT NULL,
    "evaluator" JSONB NOT NULL,
    "rewardReference" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learningsupports" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityRevision" TEXT NOT NULL,
    "hintLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learningsupports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visual_labs" (
    "id" UUID NOT NULL,
    "labId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'private',
    "sourceMode" TEXT NOT NULL,
    "courseId" TEXT,
    "revisionId" TEXT,
    "topicId" TEXT,
    "passageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topic" TEXT,
    "engine" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "learningObjective" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "guidance" JSONB NOT NULL,
    "check" JSONB NOT NULL,
    "generationMode" TEXT NOT NULL,
    "generationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_nardouch_progress" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "completedLessonIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_nardouch_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nardouchconversations" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "language" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "feedback" JSONB NOT NULL DEFAULT '[]',
    "lockToken" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nardouchconversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_adaptation_preferences" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "recommendationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowAssessmentEvidence" BOOLEAN NOT NULL DEFAULT true,
    "preferredMode" TEXT,
    "preferWorkedExamples" BOOLEAN NOT NULL DEFAULT false,
    "preferVisualExploration" BOOLEAN NOT NULL DEFAULT false,
    "preferDetailedProofs" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_adaptation_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_plan_requests" (
    "id" UUID NOT NULL,
    "requestId" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerModel" TEXT NOT NULL,
    "contextFingerprint" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "code" TEXT,
    "stage" TEXT,
    "approvalId" TEXT,
    "reservedTokens" INTEGER NOT NULL DEFAULT 0,
    "reportedTokens" INTEGER,
    "usageReported" BOOLEAN NOT NULL DEFAULT false,
    "modelVersion" TEXT,
    "planDigest" TEXT,
    "dispatchAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_plan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_plan_records" (
    "id" UUID NOT NULL,
    "planId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "contextFingerprint" TEXT NOT NULL,
    "planSchemaVersion" TEXT NOT NULL,
    "registryVersion" TEXT NOT NULL,
    "presentationSchemaVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerModel" TEXT NOT NULL,
    "plannerImplementation" TEXT NOT NULL,
    "plannerVersion" TEXT NOT NULL,
    "planDigest" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "supersededByPlanId" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_plan_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulaproposals" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "revisionTag" TEXT NOT NULL,
    "draftVersion" INTEGER NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "bbox" DOUBLE PRECISION[],
    "sourceText" TEXT NOT NULL,
    "cropHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT,
    "recognitionJobId" TEXT,
    "usage" JSONB,
    "latex" TEXT NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "identity" TEXT NOT NULL,
    "reviewedLatex" TEXT,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "reviewVersion" INTEGER NOT NULL DEFAULT 0,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulaproposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formularecognitionjobs" (
    "id" UUID NOT NULL,
    "identity" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "revisionTag" TEXT NOT NULL,
    "draftVersion" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "cropHash" TEXT NOT NULL,
    "page" INTEGER,
    "bbox" DOUBLE PRECISION[],
    "sourceText" TEXT,
    "model" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "claim" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "proposalId" TEXT,
    "usage" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formularecognitionjobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structuredassets" (
    "id" UUID NOT NULL,
    "assetId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockId" TEXT,
    "component" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "registryVersion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "provenance" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TEXT,
    "sourceReferences" JSONB,
    "audience" TEXT NOT NULL,
    "fallback" TEXT NOT NULL,
    "disclosure" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structuredassets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_asset_reviews" (
    "id" UUID NOT NULL,
    "reviewId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "reviewerRole" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "rationale" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structured_asset_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_rooms" (
    "id" UUID NOT NULL,
    "createCommandId" TEXT,
    "roomId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "courseId" TEXT,
    "revisionId" TEXT,
    "hostUserId" TEXT NOT NULL,
    "presenterUserId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "maxParticipants" INTEGER NOT NULL DEFAULT 6,
    "moderatorMode" "ModeratorMode" NOT NULL DEFAULT 'guided',
    "facilitatorActive" BOOLEAN NOT NULL DEFAULT false,
    "activeActivityId" TEXT,
    "activePin" JSONB,
    "activityRound" TEXT,
    "visualizationState" JSONB,
    "currentPhase" "RoomPhase" NOT NULL DEFAULT 'idle',
    "status" "RoomStatus" NOT NULL DEFAULT 'active',
    "seq" INTEGER NOT NULL DEFAULT 1,
    "commandReceipts" JSONB NOT NULL DEFAULT '[]',
    "participants" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "study_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilitatorinterventions" (
    "id" UUID NOT NULL,
    "interventionId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'explicit_ask',
    "targetUserId" TEXT,
    "targetSpeakerName" TEXT,
    "reasoning" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "proposedUICommand" JSONB,
    "status" TEXT NOT NULL DEFAULT 'delivered',
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilitatorinterventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_whiteboards" (
    "id" UUID NOT NULL,
    "roomId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "elements" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_whiteboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roomlearningproposals" (
    "id" UUID NOT NULL,
    "proposalId" TEXT,
    "roomId" TEXT,
    "presenterUserId" TEXT,
    "expectedSeq" INTEGER,
    "activePin" JSONB,
    "targetPhase" TEXT,
    "message" TEXT,
    "commandId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roomlearningproposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roomlearningchecks" (
    "id" UUID NOT NULL,
    "checkId" TEXT,
    "roomId" TEXT,
    "round" TEXT,
    "userId" TEXT,
    "attemptId" TEXT,
    "activity" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roomlearningchecks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_room_help" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "pin" JSONB,
    "state" TEXT NOT NULL,
    "result" JSONB,
    "claim" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "private_room_help_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studysessions" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "topicId" TEXT,
    "courseId" TEXT,
    "studyPlanId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'focus',
    "challengeDifficulty" TEXT NOT NULL DEFAULT 'medium',
    "taskProgress" JSONB NOT NULL,
    "xpMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "focusScore" INTEGER,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(1000),
    "signalHistory" JSONB NOT NULL DEFAULT '[]',
    "breakStats" JSONB NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'solo',
    "participants" JSONB NOT NULL DEFAULT '[]',
    "inviteCode" TEXT,
    "maxParticipants" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studysessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "studyPlanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topicId" TEXT,
    "objectiveId" TEXT,
    "targetBloomLevel" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "estimatedTime" INTEGER,
    "actualTime" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studyplans" (
    "id" UUID NOT NULL,
    "resourceScope" JSONB,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "goal" TEXT NOT NULL,
    "availableTimeMinutes" INTEGER NOT NULL,
    "taskGraph" JSONB NOT NULL,
    "totalEstimatedMinutes" INTEGER,
    "warning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studyplans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_objectives" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "knowledgeType" TEXT NOT NULL,
    "bloomLevel" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supersededAt" TIMESTAMP(3),
    "classification" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_profiles" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "knowledgeType" TEXT NOT NULL,
    "bloomLevel" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "__v" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_processing" (
    "id" UUID NOT NULL,
    "correlationId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_processing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_results" (
    "id" UUID NOT NULL,
    "competencyProcessedAt" TIMESTAMP(3),
    "competencyLeaseUntil" TIMESTAMP(3),
    "competencyLeaseToken" TEXT,
    "correlationId" TEXT NOT NULL,
    "messageId" TEXT,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "nextQuestion" TEXT,
    "demonstratedBloomLevel" TEXT,
    "objectiveId" TEXT,
    "targetBloomLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT,
    "correlationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resourceScope" JSONB,
    "result" JSONB,
    "error" VARCHAR(512),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "expireAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_ingestion_operations" (
    "id" VARCHAR(64) NOT NULL,
    "correlationId" TEXT NOT NULL,
    "courseId" UUID NOT NULL,
    "revisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT,
    "fileRef" TEXT NOT NULL,
    "courseTitle" VARCHAR(150),
    "files" JSONB NOT NULL,
    "state" TEXT NOT NULL,
    "result" JSONB,
    "resultApplied" BOOLEAN NOT NULL DEFAULT false,
    "dispatchCount" INTEGER NOT NULL DEFAULT 0,
    "lastDispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_ingestion_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessionchats" (
    "id" UUID NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "peerSeq" INTEGER NOT NULL DEFAULT 0,
    "peerMessages" JSONB NOT NULL DEFAULT '[]',
    "searchQuery" TEXT NOT NULL DEFAULT '',
    "searchResults" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessionchats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voicesessions" (
    "id" UUID NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "recordingUrl" TEXT,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voicesessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focussessions" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "studySessionId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "focusScore" INTEGER,
    "dataPoints" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "focussessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_instance_leases" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_instance_leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "planId" TEXT,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "status" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_approval_budgets" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_approval_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_planner_eligibility" (
    "id" UUID NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_planner_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_planning_consents" (
    "id" UUID NOT NULL,
    "userId" TEXT,
    "scope" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_planning_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_source_consents" (
    "id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formula_source_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_provider_eligibility" (
    "id" UUID NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "freeTier" BOOLEAN,
    "billingAttached" BOOLEAN,
    "keySha256" TEXT,
    "verifiedBy" TEXT,
    "projectId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formula_provider_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

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

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_friendCode_key" ON "user_profiles"("friendCode");

-- CreateIndex
CREATE INDEX "friendships_requester_status_idx" ON "friendships"("requester", "status");

-- CreateIndex
CREATE INDEX "friendships_recipient_status_idx" ON "friendships"("recipient", "status");

-- CreateIndex
CREATE INDEX "friendships_recipient_idx" ON "friendships"("recipient");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_requester_recipient_key" ON "friendships"("requester", "recipient");

-- CreateIndex
CREATE UNIQUE INDEX "study_groups_groupId_key" ON "study_groups"("groupId");

-- CreateIndex
CREATE INDEX "study_groups_ownerId_idx" ON "study_groups"("ownerId");

-- CreateIndex
CREATE INDEX "study_group_members_userId_idx" ON "study_group_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "study_group_members_groupId_userId_key" ON "study_group_members"("groupId", "userId");

-- CreateIndex
CREATE INDEX "study_group_invites_userId_idx" ON "study_group_invites"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "study_group_invites_groupId_userId_key" ON "study_group_invites"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "learningstyleprofiles_userId_key" ON "learningstyleprofiles"("userId");

-- CreateIndex
CREATE INDEX "availabilityslots_userId_dayOfWeek_idx" ON "availabilityslots"("userId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "gamifications_userId_key" ON "gamifications"("userId");

-- CreateIndex
CREATE INDEX "gamifications_totalXp_userId_idx" ON "gamifications"("totalXp", "userId");

-- CreateIndex
CREATE INDEX "quests_userId_status_type_idx" ON "quests"("userId", "status", "type");

-- CreateIndex
CREATE INDEX "quests_userId_status_completedAt_idx" ON "quests"("userId", "status", "completedAt");

-- CreateIndex
CREATE INDEX "quests_expiresAt_idx" ON "quests"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "learning_reward_ledger_awardId_key" ON "learning_reward_ledger"("awardId");

-- CreateIndex
CREATE INDEX "learning_reward_ledger_userId_idx" ON "learning_reward_ledger"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_reward_ledger_userId_completionKey_key" ON "learning_reward_ledger"("userId", "completionKey");

-- CreateIndex
CREATE UNIQUE INDEX "rankseasons_seasonCode_key" ON "rankseasons"("seasonCode");

-- CreateIndex
CREATE INDEX "rankseasons_startAt_idx" ON "rankseasons"("startAt");

-- CreateIndex
CREATE INDEX "rankseasons_endAt_idx" ON "rankseasons"("endAt");

-- CreateIndex
CREATE INDEX "rankseasons_status_idx" ON "rankseasons"("status");

-- CreateIndex
CREATE UNIQUE INDEX "userrankprofiles_userId_key" ON "userrankprofiles"("userId");

-- CreateIndex
CREATE INDEX "userrankprofiles_currentSeasonId_idx" ON "userrankprofiles"("currentSeasonId");

-- CreateIndex
CREATE INDEX "userrankprofiles_knowledgePoints_idx" ON "userrankprofiles"("knowledgePoints");

-- CreateIndex
CREATE INDEX "userrankprofiles_rankIndex_idx" ON "userrankprofiles"("rankIndex");

-- CreateIndex
CREATE INDEX "userrankprofiles_lastActivityAt_idx" ON "userrankprofiles"("lastActivityAt");

-- CreateIndex
CREATE INDEX "seasonresultsnapshots_userId_idx" ON "seasonresultsnapshots"("userId");

-- CreateIndex
CREATE INDEX "seasonresultsnapshots_snapshotAt_idx" ON "seasonresultsnapshots"("snapshotAt");

-- CreateIndex
CREATE UNIQUE INDEX "seasonresultsnapshots_seasonId_userId_key" ON "seasonresultsnapshots"("seasonId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "rankeventledgers_eventKey_key" ON "rankeventledgers"("eventKey");

-- CreateIndex
CREATE INDEX "rankeventledgers_userId_idx" ON "rankeventledgers"("userId");

-- CreateIndex
CREATE INDEX "rankeventledgers_seasonId_idx" ON "rankeventledgers"("seasonId");

-- CreateIndex
CREATE INDEX "rankeventledgers_action_idx" ON "rankeventledgers"("action");

-- CreateIndex
CREATE INDEX "rankeventledgers_finalKP_idx" ON "rankeventledgers"("finalKP");

-- CreateIndex
CREATE INDEX "rankeventledgers_contextSessionId_idx" ON "rankeventledgers"("contextSessionId");

-- CreateIndex
CREATE INDEX "rankeventledgers_occurredAt_idx" ON "rankeventledgers"("occurredAt");

-- CreateIndex
CREATE INDEX "rankeventledgers_userId_seasonId_occurredAt_idx" ON "rankeventledgers"("userId", "seasonId", "occurredAt");

-- CreateIndex
CREATE INDEX "rankeventledgers_userId_seasonId_contextSessionId_occurredA_idx" ON "rankeventledgers"("userId", "seasonId", "contextSessionId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "rankbadges_rankIndex_key" ON "rankbadges"("rankIndex");

-- CreateIndex
CREATE INDEX "rankbadges_tier_idx" ON "rankbadges"("tier");

-- CreateIndex
CREATE INDEX "rankbadges_isActive_idx" ON "rankbadges"("isActive");

-- CreateIndex
CREATE INDEX "subjects_userId_idx" ON "subjects"("userId");

-- CreateIndex
CREATE INDEX "topics_userId_idx" ON "topics"("userId");

-- CreateIndex
CREATE INDEX "courses_userId_idx" ON "courses"("userId");

-- CreateIndex
CREATE INDEX "courses_subjectId_idx" ON "courses"("subjectId");

-- CreateIndex
CREATE INDEX "courses_jobId_idx" ON "courses"("jobId");

-- CreateIndex
CREATE INDEX "courses_correlationId_idx" ON "courses"("correlationId");

-- CreateIndex
CREATE INDEX "courses_aiCourseId_idx" ON "courses"("aiCourseId");

-- CreateIndex
CREATE INDEX "courses_institutionId_scope_idx" ON "courses"("institutionId", "scope");

-- CreateIndex
CREATE INDEX "courses_ownerUserId_idx" ON "courses"("ownerUserId");

-- CreateIndex
CREATE INDEX "courses_visibility_updatedAt_idx" ON "courses"("visibility", "updatedAt");

-- CreateIndex
CREATE INDEX "courses_assignedInstructorIds_idx" ON "courses"("assignedInstructorIds");

-- CreateIndex
CREATE INDEX "course_revisions_courseId_status_idx" ON "course_revisions"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "course_revisions_courseId_revisionTag_key" ON "course_revisions"("courseId", "revisionTag");

-- CreateIndex
CREATE INDEX "course_enrollments_courseId_idx" ON "course_enrollments"("courseId");

-- CreateIndex
CREATE INDEX "course_enrollments_institutionId_idx" ON "course_enrollments"("institutionId");

-- CreateIndex
CREATE INDEX "course_enrollments_userId_idx" ON "course_enrollments"("userId");

-- CreateIndex
CREATE INDEX "course_enrollments_userId_status_idx" ON "course_enrollments"("userId", "status");

-- CreateIndex
CREATE INDEX "course_enrollments_institutionId_status_idx" ON "course_enrollments"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_courseId_userId_key" ON "course_enrollments"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "course_invitations_tokenHash_key" ON "course_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "course_invitations_courseId_idx" ON "course_invitations"("courseId");

-- CreateIndex
CREATE INDEX "course_invitations_institutionId_idx" ON "course_invitations"("institutionId");

-- CreateIndex
CREATE INDEX "course_invitations_expiresAt_idx" ON "course_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "course_invitations_recipientEmail_status_expiresAt_idx" ON "course_invitations"("recipientEmail", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "course_invitations_courseId_status_expiresAt_idx" ON "course_invitations"("courseId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "public_course_joins_userId_idx" ON "public_course_joins"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "public_course_joins_userId_courseId_key" ON "public_course_joins"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_slug_key" ON "institutions"("slug");

-- CreateIndex
CREATE INDEX "institution_memberships_institutionId_idx" ON "institution_memberships"("institutionId");

-- CreateIndex
CREATE INDEX "institution_memberships_userId_idx" ON "institution_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "institution_memberships_institutionId_userId_key" ON "institution_memberships"("institutionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "institution_invitations_tokenHash_key" ON "institution_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "institution_invitations_institutionId_idx" ON "institution_invitations"("institutionId");

-- CreateIndex
CREATE INDEX "institution_invitations_expiresAt_idx" ON "institution_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "institution_invitations_institutionId_status_expiresAt_idx" ON "institution_invitations"("institutionId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "activity_records_courseId_idx" ON "activity_records"("courseId");

-- CreateIndex
CREATE INDEX "activity_records_revisionId_idx" ON "activity_records"("revisionId");

-- CreateIndex
CREATE INDEX "activity_records_activityId_idx" ON "activity_records"("activityId");

-- CreateIndex
CREATE INDEX "activity_records_objectiveId_idx" ON "activity_records"("objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_records_courseId_revisionId_activityId_key" ON "activity_records"("courseId", "revisionId", "activityId");

-- CreateIndex
CREATE INDEX "student_attempts_userId_idx" ON "student_attempts"("userId");

-- CreateIndex
CREATE INDEX "student_attempts_attemptId_idx" ON "student_attempts"("attemptId");

-- CreateIndex
CREATE INDEX "student_attempts_courseId_idx" ON "student_attempts"("courseId");

-- CreateIndex
CREATE INDEX "student_attempts_activityId_idx" ON "student_attempts"("activityId");

-- CreateIndex
CREATE INDEX "student_attempts_courseId_revisionId_activityId_userId_idx" ON "student_attempts"("courseId", "revisionId", "activityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_attempts_userId_attemptId_key" ON "student_attempts"("userId", "attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_evidences_evidenceId_key" ON "learning_evidences"("evidenceId");

-- CreateIndex
CREATE INDEX "learning_evidences_evidenceId_idx" ON "learning_evidences"("evidenceId");

-- CreateIndex
CREATE INDEX "learning_evidences_userId_idx" ON "learning_evidences"("userId");

-- CreateIndex
CREATE INDEX "learning_evidences_attemptId_idx" ON "learning_evidences"("attemptId");

-- CreateIndex
CREATE INDEX "learning_evidences_objectiveId_idx" ON "learning_evidences"("objectiveId");

-- CreateIndex
CREATE INDEX "learning_evidences_userId_objectiveId_masteryAchieved_idx" ON "learning_evidences"("userId", "objectiveId", "masteryAchieved");

-- CreateIndex
CREATE UNIQUE INDEX "learning_evidences_userId_attemptId_key" ON "learning_evidences"("userId", "attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "learningsupports_userId_courseId_revisionId_activityId_acti_key" ON "learningsupports"("userId", "courseId", "revisionId", "activityId", "activityRevision");

-- CreateIndex
CREATE UNIQUE INDEX "visual_labs_labId_key" ON "visual_labs"("labId");

-- CreateIndex
CREATE INDEX "visual_labs_labId_idx" ON "visual_labs"("labId");

-- CreateIndex
CREATE INDEX "visual_labs_ownerUserId_idx" ON "visual_labs"("ownerUserId");

-- CreateIndex
CREATE INDEX "visual_labs_courseId_idx" ON "visual_labs"("courseId");

-- CreateIndex
CREATE INDEX "visual_labs_ownerUserId_courseId_revisionId_idx" ON "visual_labs"("ownerUserId", "courseId", "revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "visual_labs_ownerUserId_generationKey_key" ON "visual_labs"("ownerUserId", "generationKey");

-- CreateIndex
CREATE UNIQUE INDEX "course_nardouch_progress_userId_courseId_revisionId_key" ON "course_nardouch_progress"("userId", "courseId", "revisionId");

-- CreateIndex
CREATE INDEX "nardouchconversations_userId_idx" ON "nardouchconversations"("userId");

-- CreateIndex
CREATE INDEX "nardouchconversations_expiresAt_idx" ON "nardouchconversations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "learner_adaptation_preferences_userId_key" ON "learner_adaptation_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "experience_plan_requests_identity_key" ON "experience_plan_requests"("identity");

-- CreateIndex
CREATE INDEX "experience_plan_requests_courseId_revisionId_lessonId_state_idx" ON "experience_plan_requests"("courseId", "revisionId", "lessonId", "state");

-- CreateIndex
CREATE INDEX "experience_plan_records_courseId_revisionId_lessonId_mode_s_idx" ON "experience_plan_records"("courseId", "revisionId", "lessonId", "mode", "supersededAt");

-- CreateIndex
CREATE UNIQUE INDEX "experience_plan_records_courseId_revisionId_lessonId_mode_c_key" ON "experience_plan_records"("courseId", "revisionId", "lessonId", "mode", "contextFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "formulaproposals_identity_key" ON "formulaproposals"("identity");

-- CreateIndex
CREATE INDEX "formulaproposals_courseId_revisionId_draftVersion_idx" ON "formulaproposals"("courseId", "revisionId", "draftVersion");

-- CreateIndex
CREATE UNIQUE INDEX "formularecognitionjobs_identity_key" ON "formularecognitionjobs"("identity");

-- CreateIndex
CREATE INDEX "structuredassets_courseId_revisionId_lessonId_idx" ON "structuredassets"("courseId", "revisionId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "structuredassets_courseId_revisionId_assetId_key" ON "structuredassets"("courseId", "revisionId", "assetId");

-- CreateIndex
CREATE INDEX "structured_asset_reviews_courseId_revisionId_lessonId_idx" ON "structured_asset_reviews"("courseId", "revisionId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "structured_asset_reviews_courseId_revisionId_assetId_conten_key" ON "structured_asset_reviews"("courseId", "revisionId", "assetId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "study_rooms_roomId_key" ON "study_rooms"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "study_rooms_inviteCode_key" ON "study_rooms"("inviteCode");

-- CreateIndex
CREATE INDEX "study_rooms_courseId_idx" ON "study_rooms"("courseId");

-- CreateIndex
CREATE INDEX "study_rooms_hostUserId_idx" ON "study_rooms"("hostUserId");

-- CreateIndex
CREATE INDEX "study_rooms_presenterUserId_idx" ON "study_rooms"("presenterUserId");

-- CreateIndex
CREATE INDEX "study_rooms_status_idx" ON "study_rooms"("status");

-- CreateIndex
CREATE INDEX "study_rooms_createdAt_idx" ON "study_rooms"("createdAt");

-- CreateIndex
CREATE INDEX "study_rooms_inviteCode_status_idx" ON "study_rooms"("inviteCode", "status");

-- CreateIndex
CREATE INDEX "study_rooms_hostUserId_status_idx" ON "study_rooms"("hostUserId", "status");

-- CreateIndex
CREATE INDEX "study_rooms_courseId_status_idx" ON "study_rooms"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "facilitatorinterventions_interventionId_key" ON "facilitatorinterventions"("interventionId");

-- CreateIndex
CREATE INDEX "facilitatorinterventions_roomId_idx" ON "facilitatorinterventions"("roomId");

-- CreateIndex
CREATE INDEX "facilitatorinterventions_createdAt_idx" ON "facilitatorinterventions"("createdAt");

-- CreateIndex
CREATE INDEX "facilitatorinterventions_roomId_createdAt_idx" ON "facilitatorinterventions"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "room_whiteboards_roomId_key" ON "room_whiteboards"("roomId");

-- CreateIndex
CREATE INDEX "room_whiteboards_updatedAt_idx" ON "room_whiteboards"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "roomlearningproposals_proposalId_key" ON "roomlearningproposals"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "roomlearningchecks_checkId_key" ON "roomlearningchecks"("checkId");

-- CreateIndex
CREATE UNIQUE INDEX "private_room_help_userId_roomId_requestId_key" ON "private_room_help"("userId", "roomId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "studysessions_inviteCode_key" ON "studysessions"("inviteCode");

-- CreateIndex
CREATE INDEX "studysessions_userId_idx" ON "studysessions"("userId");

-- CreateIndex
CREATE INDEX "studysessions_courseId_idx" ON "studysessions"("courseId");

-- CreateIndex
CREATE INDEX "studysessions_studyPlanId_idx" ON "studysessions"("studyPlanId");

-- CreateIndex
CREATE INDEX "studysessions_userId_completedAt_idx" ON "studysessions"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "studysessions_userId_status_createdAt_idx" ON "studysessions"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- CreateIndex
CREATE INDEX "tasks_studyPlanId_idx" ON "tasks"("studyPlanId");

-- CreateIndex
CREATE INDEX "tasks_userId_status_createdAt_idx" ON "tasks"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "studyplans_userId_idx" ON "studyplans"("userId");

-- CreateIndex
CREATE INDEX "studyplans_courseId_idx" ON "studyplans"("courseId");

-- CreateIndex
CREATE INDEX "learning_objectives_topicId_bloomLevel_idx" ON "learning_objectives"("topicId", "bloomLevel");

-- CreateIndex
CREATE INDEX "learning_objectives_documentId_idx" ON "learning_objectives"("documentId");

-- CreateIndex
CREATE INDEX "learning_objectives_objectiveId_isActive_idx" ON "learning_objectives"("objectiveId", "isActive");

-- CreateIndex
CREATE INDEX "learning_objectives_userId_idx" ON "learning_objectives"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_objectives_documentId_topicId_textHash_key" ON "learning_objectives"("documentId", "topicId", "textHash");

-- CreateIndex
CREATE INDEX "competency_profiles_userId_topicId_idx" ON "competency_profiles"("userId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "competency_profiles_userId_topicId_knowledgeType_bloomLevel_key" ON "competency_profiles"("userId", "topicId", "knowledgeType", "bloomLevel");

-- CreateIndex
CREATE UNIQUE INDEX "competency_processing_correlationId_key" ON "competency_processing"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "eval_results_correlationId_key" ON "eval_results"("correlationId");

-- CreateIndex
CREATE INDEX "eval_results_userId_idx" ON "eval_results"("userId");

-- CreateIndex
CREATE INDEX "eval_results_sessionId_idx" ON "eval_results"("sessionId");

-- CreateIndex
CREATE INDEX "eval_results_status_idx" ON "eval_results"("status");

-- CreateIndex
CREATE INDEX "eval_results_sessionId_step_idx" ON "eval_results"("sessionId", "step");

-- CreateIndex
CREATE INDEX "eval_results_demonstratedBloomLevel_idx" ON "eval_results"("demonstratedBloomLevel");

-- CreateIndex
CREATE INDEX "eval_results_objectiveId_idx" ON "eval_results"("objectiveId");

-- CreateIndex
CREATE INDEX "eval_results_competencyProcessedAt_competencyLeaseUntil_cre_idx" ON "eval_results"("competencyProcessedAt", "competencyLeaseUntil", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_jobs_jobId_key" ON "ai_jobs"("jobId");

-- CreateIndex
CREATE INDEX "ai_jobs_userId_idx" ON "ai_jobs"("userId");

-- CreateIndex
CREATE INDEX "ai_jobs_correlationId_idx" ON "ai_jobs"("correlationId");

-- CreateIndex
CREATE INDEX "ai_jobs_status_idx" ON "ai_jobs"("status");

-- CreateIndex
CREATE INDEX "ai_jobs_userId_createdAt_idx" ON "ai_jobs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_jobs_expireAt_idx" ON "ai_jobs"("expireAt");

-- CreateIndex
CREATE UNIQUE INDEX "course_ingestion_operations_correlationId_key" ON "course_ingestion_operations"("correlationId");

-- CreateIndex
CREATE INDEX "course_ingestion_operations_courseId_idx" ON "course_ingestion_operations"("courseId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_status_createdAt_idx" ON "notifications"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "sessionchats_sessionId_idx" ON "sessionchats"("sessionId");

-- CreateIndex
CREATE INDEX "sessionchats_userId_idx" ON "sessionchats"("userId");

-- CreateIndex
CREATE INDEX "sessionchats_sessionId_createdAt_idx" ON "sessionchats"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "voicesessions_sessionId_key" ON "voicesessions"("sessionId");

-- CreateIndex
CREATE INDEX "voicesessions_sessionId_idx" ON "voicesessions"("sessionId");

-- CreateIndex
CREATE INDEX "focussessions_userId_idx" ON "focussessions"("userId");

-- CreateIndex
CREATE INDEX "focussessions_userId_startTime_idx" ON "focussessions"("userId", "startTime");

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "analytics_events"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_userId_timestamp_idx" ON "analytics_events"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_eventType_timestamp_idx" ON "analytics_events"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_userId_eventType_timestamp_idx" ON "analytics_events"("userId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "calendar_userId_idx" ON "calendar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "llm_approval_budgets_key_key" ON "llm_approval_budgets"("key");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_group_members" ADD CONSTRAINT "study_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "study_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_group_invites" ADD CONSTRAINT "study_group_invites_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "study_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonresultsnapshots" ADD CONSTRAINT "seasonresultsnapshots_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "rankseasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_revisions" ADD CONSTRAINT "course_revisions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_memberships" ADD CONSTRAINT "institution_memberships_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_invitations" ADD CONSTRAINT "institution_invitations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
