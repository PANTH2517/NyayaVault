-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'MFA_ENROLLMENT_STARTED';
ALTER TYPE "AuditEventType" ADD VALUE 'MFA_ENABLED';
ALTER TYPE "AuditEventType" ADD VALUE 'MFA_LOGIN_SUCCESS';
ALTER TYPE "AuditEventType" ADD VALUE 'MFA_LOGIN_FAILURE';
ALTER TYPE "AuditEventType" ADD VALUE 'MFA_RECOVERY_CODE_USED';
ALTER TYPE "AuditEventType" ADD VALUE 'MFA_RECOVERY_CODES_REGENERATED';
ALTER TYPE "AuditEventType" ADD VALUE 'MFA_DISABLED';
ALTER TYPE "AuditEventType" ADD VALUE 'MFA_ADMIN_RESET';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecretEncrypted" TEXT,
ADD COLUMN     "mfaEnrolledAt" TIMESTAMP(3),
ADD COLUMN     "mfaLastUsedTimeStep" INTEGER;

-- CreateTable
CREATE TABLE "mfa_recovery_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mfa_recovery_codes_userId_idx" ON "mfa_recovery_codes"("userId");

-- AddForeignKey
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
