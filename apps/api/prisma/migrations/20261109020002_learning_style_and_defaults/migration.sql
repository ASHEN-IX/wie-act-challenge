-- CreateTable
CREATE TABLE "learningstyleprofiles" (
    "id" VARCHAR(24) NOT NULL,
    "userId" TEXT NOT NULL,
    "primary" TEXT NOT NULL,
    "ranking" JSONB NOT NULL DEFAULT '[]',
    "provisional" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learningstyleprofiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learningstyleprofiles_userId_key" ON "learningstyleprofiles"("userId");
