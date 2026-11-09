-- The placeholder key/payload table was never written by the API or the data
-- migration. The ledger becomes a typed, API-owned table: one conditional UPDATE
-- per reservation, shared by the Node planner and (through /internal/budget/*)
-- the Python AI service.
DROP TABLE "llm_approval_budgets";

CREATE TABLE "llm_approval_budgets" (
    "id" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "limitRequests" INTEGER NOT NULL,
    "maxTokens" INTEGER,
    "maxCostUsd" DOUBLE PRECISION,
    "expiresAt" DOUBLE PRECISION NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "usedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revokedAt" DOUBLE PRECISION,
    "revocationReason" TEXT,
    "releaseMarkers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_approval_budgets_pkey" PRIMARY KEY ("id")
);
