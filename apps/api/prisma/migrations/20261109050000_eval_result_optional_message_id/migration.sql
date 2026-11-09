-- The orchestrator always writes `messageId`, but the study view of this table
-- (competency updates) also records results without it. The Mongo schema for
-- that view never required it either.
ALTER TABLE "eval_results" ALTER COLUMN "messageId" DROP NOT NULL;
