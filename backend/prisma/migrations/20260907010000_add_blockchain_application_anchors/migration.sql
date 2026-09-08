-- CreateEnum
CREATE TYPE "BlockchainAnchorStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "blockchain_application_anchors" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "policyId" TEXT NOT NULL DEFAULT 'STANDARD_ANCHOR',
    "originatingNode" TEXT NOT NULL,
    "caseId" TEXT,
    "documentId" TEXT,
    "versionId" TEXT,
    "auditSequenceNumber" BIGINT,
    "evidenceHash" TEXT,
    "blockchainTxId" TEXT,
    "blockHash" TEXT,
    "blockHeight" BIGINT,
    "status" "BlockchainAnchorStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockchain_application_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_application_anchors_idempotencyKey_key" ON "blockchain_application_anchors"("idempotencyKey");

-- CreateIndex
CREATE INDEX "blockchain_application_anchors_idempotencyKey_idx" ON "blockchain_application_anchors"("idempotencyKey");

-- CreateIndex
CREATE INDEX "blockchain_application_anchors_versionId_idx" ON "blockchain_application_anchors"("versionId");

-- CreateIndex
CREATE INDEX "blockchain_application_anchors_documentId_idx" ON "blockchain_application_anchors"("documentId");

-- CreateIndex
CREATE INDEX "blockchain_application_anchors_caseId_idx" ON "blockchain_application_anchors"("caseId");

-- CreateIndex
CREATE INDEX "blockchain_application_anchors_status_idx" ON "blockchain_application_anchors"("status");
