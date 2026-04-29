-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Organization"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripePriceId" TEXT,
  ADD COLUMN "planExpiresAt" TIMESTAMP(3),
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "studentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "courseCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "storageUsedMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "teacherSeatCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "plan_new" "Plan" NOT NULL DEFAULT 'FREE';

-- Migrate existing org plans to FREE
UPDATE "Organization"
SET "plan_new" = 'FREE';

-- Replace old string plan column
ALTER TABLE "Organization" DROP COLUMN "plan";
ALTER TABLE "Organization" RENAME COLUMN "plan_new" TO "plan";

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "previousPlan" "Plan",
  "newPlan" "Plan",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_stripeEventId_key" ON "SubscriptionEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_orgId_createdAt_idx" ON "SubscriptionEvent"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "SubscriptionEvent"
ADD CONSTRAINT "SubscriptionEvent_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
