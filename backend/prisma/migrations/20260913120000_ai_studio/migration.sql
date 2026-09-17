-- AI Studio: credit ledger fields, conversations, messages, generation jobs.
-- Additive only.

ALTER TABLE "AiUsage" ALTER COLUMN "orgId" DROP NOT NULL;
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "tier" TEXT;
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "cachedTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION;
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER;
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "jobId" TEXT;
ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
CREATE INDEX IF NOT EXISTS "AiUsage_jobId_idx" ON "AiUsage"("jobId");

CREATE TABLE "AiConversation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'New chat',
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiConversation_userId_lastMessageAt_idx" ON "AiConversation"("userId", "lastMessageAt" DESC);
CREATE INDEX "AiConversation_orgId_idx" ON "AiConversation"("orgId");
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "parts" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiJob" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "input" JSONB NOT NULL,
  "progress" JSONB,
  "result" JSONB,
  "error" TEXT,
  "creditsReserved" INTEGER NOT NULL DEFAULT 0,
  "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  "conversationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiJob_userId_createdAt_idx" ON "AiJob"("userId", "createdAt" DESC);
CREATE INDEX "AiJob_orgId_status_idx" ON "AiJob"("orgId", "status");
CREATE INDEX "AiJob_userId_status_idx" ON "AiJob"("userId", "status");
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
