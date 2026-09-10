-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'EVIDENCE_METADATA_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'EVIDENCE_CLASSIFIED';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "description" TEXT,
ADD COLUMN "exhibitNumber" TEXT,
ADD COLUMN "metadata" JSONB,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "documents_tags_idx" ON "documents" USING GIN ("tags");
