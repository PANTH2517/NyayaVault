import { PrismaClient, RoleName, CaseStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Note: Authentication flow and Argon2 password hashing are implemented in Milestone 3.
// This DEV_HASH_PLACEHOLDER is a non-functional development string for initial schema seeding.
const DEV_HASH_PLACEHOLDER = 'DEV_HASH_PLACEHOLDER_REPLACE_IN_MILESTONE_3';

async function main() {
  console.log('Seeding initial development data for NyayaVault...');

  // 1. Seed Development Users for each core role
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nyayavault.gov.in' },
    update: {},
    create: {
      email: 'admin@nyayavault.gov.in',
      fullName: 'System Administrator',
      passwordHash: DEV_HASH_PLACEHOLDER,
      role: RoleName.ADMIN,
    },
  });

  const ioUser = await prisma.user.upsert({
    where: { email: 'io.sharma@nyayavault.gov.in' },
    update: {},
    create: {
      email: 'io.sharma@nyayavault.gov.in',
      fullName: 'Inspector R. Sharma',
      passwordHash: DEV_HASH_PLACEHOLDER,
      role: RoleName.INVESTIGATING_OFFICER,
    },
  });

  const supervisorUser = await prisma.user.upsert({
    where: { email: 'super.verma@nyayavault.gov.in' },
    update: {},
    create: {
      email: 'super.verma@nyayavault.gov.in',
      fullName: 'Superintendent A. Verma',
      passwordHash: DEV_HASH_PLACEHOLDER,
      role: RoleName.SUPERVISOR,
    },
  });

  const prosecutorUser = await prisma.user.upsert({
    where: { email: 'prosecutor.mehta@nyayavault.gov.in' },
    update: {},
    create: {
      email: 'prosecutor.mehta@nyayavault.gov.in',
      fullName: 'Public Prosecutor K. Mehta',
      passwordHash: DEV_HASH_PLACEHOLDER,
      role: RoleName.PROSECUTOR,
    },
  });

  console.log(`Seeded 4 development users (${adminUser.email}, ${ioUser.email}, ${supervisorUser.email}, ${prosecutorUser.email})`);

  // 2. Seed Sample Cases
  const sampleCase1 = await prisma.case.upsert({
    where: { caseNumber: 'CR-2026-0042' },
    update: {},
    create: {
      caseNumber: 'CR-2026-0042',
      title: 'State vs. Cyber Intruders Investigation',
      description: 'Investigation into unauthorized digital data exfiltration and forgery.',
      status: CaseStatus.UNDER_INVESTIGATION,
      createdById: ioUser.id,
    },
  });

  const sampleCase2 = await prisma.case.upsert({
    where: { caseNumber: 'CR-2026-0108' },
    update: {},
    create: {
      caseNumber: 'CR-2026-0108',
      title: 'Financial Forensics Audit Case',
      description: 'Audit of fraudulent digital transaction records and falsified evidence.',
      status: CaseStatus.OPEN,
      createdById: supervisorUser.id,
    },
  });

  console.log(`Seeded 2 sample cases (${sampleCase1.caseNumber}, ${sampleCase2.caseNumber})`);

  // 3. Seed Case Assignments
  await prisma.caseAssignment.upsert({
    where: {
      caseId_userId: {
        caseId: sampleCase1.id,
        userId: ioUser.id,
      },
    },
    update: {},
    create: {
      caseId: sampleCase1.id,
      userId: ioUser.id,
      roleInCase: 'Lead Investigator',
    },
  });

  await prisma.caseAssignment.upsert({
    where: {
      caseId_userId: {
        caseId: sampleCase1.id,
        userId: prosecutorUser.id,
      },
    },
    update: {},
    create: {
      caseId: sampleCase1.id,
      userId: prosecutorUser.id,
      roleInCase: 'Assigned Prosecutor',
    },
  });

  console.log('Seeded initial case assignments.');
  console.log('Development seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
