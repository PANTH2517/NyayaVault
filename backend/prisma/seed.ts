import { PrismaClient, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, { encoding: 'utf8' });
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const prisma = new PrismaClient();

async function main() {
  console.log('Initiating total database purge (cases, audit logs, non-admin users, documents, incidents)...');

  // 1. Delete all Evidence Shares
  await prisma.evidenceShare.deleteMany({});
  console.log('Cleared evidence shares.');

  // 2. Delete all Security Incidents
  await prisma.securityIncident.deleteMany({});
  console.log('Cleared security incidents.');

  // 3. Delete all Audit Events
  await prisma.auditEvent.deleteMany({});
  console.log('Cleared audit events.');

  // 4. Delete all Approvals
  await prisma.approval.deleteMany({});
  console.log('Cleared approvals.');

  // 5. Delete all Document Versions
  await prisma.documentVersion.deleteMany({});
  console.log('Cleared document versions.');

  // 6. Delete all Documents
  await prisma.document.deleteMany({});
  console.log('Cleared documents.');

  // 7. Delete all Case Assignments
  await prisma.caseAssignment.deleteMany({});
  console.log('Cleared case assignments.');

  // 8. Delete all Cases
  await prisma.case.deleteMany({});
  console.log('Cleared cases.');

  // 9. Delete User Sessions, Password Reset Tokens, MFA Recovery Codes, Registration Requests
  await prisma.userSession.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.mfaRecoveryCode.deleteMany({});
  await prisma.registrationRequest.deleteMany({});
  console.log('Cleared sessions, tokens, and registration requests.');

  // 10. Delete Blockchain Anchors & Blocks
  await prisma.blockchainApplicationAnchor.deleteMany({});
  await prisma.blockchainEndorsement.deleteMany({});
  await prisma.blockchainConsensusProof.deleteMany({});
  await prisma.blockchainTransaction.deleteMany({});
  await prisma.blockchainBlock.deleteMany({});
  await prisma.blockchainChain.deleteMany({});
  console.log('Cleared blockchain records.');

  // 11. Delete all NON-ADMIN users
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        not: RoleName.ADMIN,
      },
    },
  });
  console.log(`Deleted ${deletedUsers.count} non-admin users.`);

  // 12. Ensure at least one clean active Admin user exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: RoleName.ADMIN },
  });

  if (!existingAdmin) {
    const adminPasswordHash = await argon2.hash('Admin@Nyaya2026');
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@nyayavault.gov.in',
        fullName: 'System Administrator',
        passwordHash: adminPasswordHash,
        role: RoleName.ADMIN,
        isActive: true,
      },
    });
    console.log(`Created primary Admin user: ${adminUser.email}`);
  } else {
    console.log(`Retained primary Admin user: ${existingAdmin.email}`);
  }

  console.log('Total purge complete. Database contains ONLY the Admin account and zero cases/audits/documents.');
}

main()
  .catch((e) => {
    console.error('Error during database purge:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
