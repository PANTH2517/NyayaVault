-- Additive Migration: Add RegistrationStatus enum and RegistrationRequest table
-- Created At: 2026-09-04
-- Safety: Additive only. Does not alter or drop any existing tables.

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REGISTRATION_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REGISTRATION_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REGISTRATION_REJECTED';

-- CreateTable
CREATE TABLE "registration_requests" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "requestedRole" "RoleName" NOT NULL DEFAULT 'INVESTIGATING_OFFICER',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_requests_email_key" ON "registration_requests"("email");

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
