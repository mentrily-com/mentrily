CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

ALTER TABLE "Organization"
  ADD COLUMN "planStatus"        "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "slug"              TEXT,
  ADD COLUMN "customDomain"      TEXT,
  ADD COLUMN "trialEndsAt"       TIMESTAMP(3),
  ADD COLUMN "codeExecCount"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "storageAlertSent"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "studentAlertSent"  BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_customDomain_key" ON "Organization"("customDomain");

CREATE TABLE "UsageLedger" (
  "id"        TEXT NOT NULL,
  "orgId"     TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "valueNum"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "meta"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEndpoint" (
  "id"        TEXT NOT NULL,
  "orgId"     TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "secret"    TEXT NOT NULL,
  "events"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsageLedger_orgId_createdAt_idx" ON "UsageLedger"("orgId", "createdAt");
CREATE INDEX "UsageLedger_eventType_idx"        ON "UsageLedger"("eventType");
CREATE INDEX "WebhookEndpoint_orgId_idx"        ON "WebhookEndpoint"("orgId");

ALTER TABLE "UsageLedger"
  ADD CONSTRAINT "UsageLedger_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookEndpoint"
  ADD CONSTRAINT "WebhookEndpoint_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;