-- Behaviour MongoDB provided with index options that Prisma cannot express.
-- These are enforced here so the same invariants hold after the migration.

-- SessionChat: one peer_stream journal row per session (was a partial unique index).
CREATE UNIQUE INDEX "sessionchats_peer_journal_key"
  ON "sessionchats" ("sessionId")
  WHERE "messageType" = 'peer_stream';

-- StudyRoom: a creation command may only be applied once per host
-- (was a partial unique index on {hostUserId, createCommandId}).
CREATE UNIQUE INDEX "study_rooms_create_command_key"
  ON "study_rooms" ("hostUserId", "createCommandId")
  WHERE "createCommandId" IS NOT NULL;

-- Notifications: dismissed rows are only retained for 30 days. MongoDB had a
-- TTL index; PostgreSQL needs an explicit sweep. The function is created here
-- and scheduled by the operator (see docs/deployment.md).
CREATE OR REPLACE FUNCTION ednova_sweep_expired_rows() RETURNS void AS $$
BEGIN
  DELETE FROM "notifications"
   WHERE "status" = 'dismissed'
     AND "updatedAt" < now() - interval '30 days';

  -- Nardouch conversations and AI jobs carried MongoDB TTL indexes too.
  DELETE FROM "nardouchconversations" WHERE "expiresAt" <= now();
  DELETE FROM "ai_jobs" WHERE "expireAt" IS NOT NULL AND "expireAt" <= now();
END;
$$ LANGUAGE plpgsql;
