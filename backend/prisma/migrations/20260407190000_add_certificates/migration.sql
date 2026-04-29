CREATE TABLE "Certificate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "completionPercent" INTEGER,
  "fileUrl" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Certificate_userId_type_resourceId_key"
  ON "Certificate"("userId", "type", "resourceId");

CREATE INDEX "Certificate_userId_issuedAt_idx"
  ON "Certificate"("userId", "issuedAt");

CREATE INDEX "Certificate_orgId_idx"
  ON "Certificate"("orgId");

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
