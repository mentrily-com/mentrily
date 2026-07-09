-- Multi-org membership: a person's role in one specific org, additive to
-- User.orgId/role (which remain the person's home org and are never
-- overwritten by joining a second org).

CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "OrgMembership" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "orgId"     TEXT NOT NULL,
  "role"      "Role" NOT NULL DEFAULT 'STUDENT',
  "status"    "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgMembership_userId_orgId_key" ON "OrgMembership"("userId", "orgId");
CREATE INDEX "OrgMembership_userId_status_idx" ON "OrgMembership"("userId", "status");
CREATE INDEX "OrgMembership_orgId_status_idx" ON "OrgMembership"("orgId", "status");

ALTER TABLE "OrgMembership"
  ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OrgMembership_orgId_fkey"  FOREIGN KEY ("orgId")  REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one ACTIVE membership per existing User that already has a home
-- org, mirroring their current role. Idempotent (safe to re-run) and purely
-- additive — no existing User/Organization row is modified.
INSERT INTO "OrgMembership" ("id", "userId", "orgId", "role", "status", "joinedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "orgId", "role", 'ACTIVE', "createdAt", "createdAt", NOW()
FROM "User"
WHERE "orgId" IS NOT NULL
ON CONFLICT ("userId", "orgId") DO NOTHING;

-- Tracks which org the workspace switcher last pointed at, so a fresh
-- session (no X-Active-Org-Id header yet) defaults to the last choice
-- instead of always falling back to the home org.
ALTER TABLE "User" ADD COLUMN "lastActiveOrgId" TEXT;

-- PendingInvite.email was globally unique, which made it impossible to
-- invite the same person to a second org. Uniqueness moves to
-- (email, orgId); existing single-org invite rows satisfy this trivially.
-- Prisma's field-level @unique creates a plain UNIQUE INDEX, not a named
-- table CONSTRAINT, so DROP CONSTRAINT silently no-ops here — DROP INDEX is
-- required (verified against the deployed schema; both statements are kept,
-- IF EXISTS, so this migration is a correct no-op if either already ran).
ALTER TABLE "PendingInvite" DROP CONSTRAINT IF EXISTS "PendingInvite_email_key";
DROP INDEX IF EXISTS "PendingInvite_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PendingInvite_email_orgId_key" ON "PendingInvite"("email", "orgId");
CREATE INDEX IF NOT EXISTS "PendingInvite_email_idx" ON "PendingInvite"("email");
