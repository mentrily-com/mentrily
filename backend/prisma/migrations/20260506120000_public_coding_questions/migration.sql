CREATE TABLE "PublicCodingQuestion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "question" JSONB NOT NULL,
    "creatorUserId" TEXT,
    "creatorIp" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicCodingQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicCodingQuestion_slug_key" ON "PublicCodingQuestion"("slug");
CREATE INDEX "PublicCodingQuestion_creatorUserId_idx" ON "PublicCodingQuestion"("creatorUserId");
CREATE INDEX "PublicCodingQuestion_creatorIp_idx" ON "PublicCodingQuestion"("creatorIp");
CREATE INDEX "PublicCodingQuestion_expiresAt_idx" ON "PublicCodingQuestion"("expiresAt");

ALTER TABLE "PublicCodingQuestion"
ADD CONSTRAINT "PublicCodingQuestion_creatorUserId_fkey"
FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
