-- CreateTable
CREATE TABLE "PendingInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "orgId" TEXT NOT NULL,
    "clerkInvitationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingInvite_email_key" ON "PendingInvite"("email");

-- CreateIndex
CREATE INDEX "PendingInvite_orgId_idx" ON "PendingInvite"("orgId");

-- CreateIndex
CREATE INDEX "PendingInvite_expiresAt_idx" ON "PendingInvite"("expiresAt");

-- AddForeignKey
ALTER TABLE "PendingInvite" ADD CONSTRAINT "PendingInvite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
