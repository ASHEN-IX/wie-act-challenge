-- Mongoose kept an `__v` optimistic-concurrency counter on these documents.
-- The study services compare it and bump it in the same guarded write, so it
-- must be a real column rather than `updatedAt`:
--   * a draft edit matches `__v` and `$inc`s it (courseDraft, coursePublication,
--     formulaPublication, revisionSources, ingestStatus, routes/courses);
--   * a competency evidence update matches `__v` and `$inc`s it (competency.ts).
ALTER TABLE "course_revisions"  ADD COLUMN IF NOT EXISTS "__v" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "competency_profiles" ADD COLUMN IF NOT EXISTS "__v" INTEGER NOT NULL DEFAULT 0;
