-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "clerkId" TEXT,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "mustChangePassword" SET DEFAULT false,
ALTER COLUMN "mustChangePassword" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");
