-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'SHARE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'SHARE_ACCESSED';
ALTER TYPE "AuditEventType" ADD VALUE 'SHARE_ACCESS_DENIED';
ALTER TYPE "AuditEventType" ADD VALUE 'SHARE_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE 'SHARE_EXPIRED';

-- CreateTable
CREATE TABLE "evidence_shares" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "status" "ShareStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_shares_tokenHash_key" ON "evidence_shares"("tokenHash");

-- CreateIndex
CREATE INDEX "evidence_shares_tokenHash_idx" ON "evidence_shares"("tokenHash");

-- CreateIndex
CREATE INDEX "evidence_shares_versionId_idx" ON "evidence_shares"("versionId");

-- CreateIndex
CREATE INDEX "evidence_shares_caseId_idx" ON "evidence_shares"("caseId");

-- CreateIndex
CREATE INDEX "evidence_shares_targetUserId_idx" ON "evidence_shares"("targetUserId");

-- CreateIndex
CREATE INDEX "evidence_shares_issuedById_idx" ON "evidence_shares"("issuedById");

-- AddForeignKey
ALTER TABLE "evidence_shares" ADD CONSTRAINT "evidence_shares_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_shares" ADD CONSTRAINT "evidence_shares_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_shares" ADD CONSTRAINT "evidence_shares_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_shares" ADD CONSTRAINT "evidence_shares_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_shares" ADD CONSTRAINT "evidence_shares_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
