-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "encryptionVersion" INTEGER;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "encryptionKeyVersion" INTEGER;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "isEncrypted" BOOLEAN NOT NULL DEFAULT false;
