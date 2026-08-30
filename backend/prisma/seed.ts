import { PrismaClient, RoleName, CaseStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding development users with Argon2 password hashes...');

  // Compute Argon2 hashes for development credentials
  const adminPasswordHash = await argon2.hash('Admin@Nyaya2026');
  const ioPasswordHash = await argon2.hash('Officer@Nyaya2026');
  const superPasswordHash = await argon2.hash('Super@Nyaya2026');
  const prosecutorPasswordHash = await argon2.hash('Prosecutor@Nyaya2026');

  // 1. Seed Development Users for each core role
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nyayavault.gov.in' },
    update: {
      passwordHash: adminPasswordHash,
    },
    create: {
      email: 'admin@nyayavault.gov.in',
      fullName: 'System Administrator',
      passwordHash: adminPasswordHash,
      role: RoleName.ADMIN,
    },
  });

  const ioUser = await prisma.user.upsert({
    where: { email: 'io.sharma@nyayavault.gov.in' },
    update: {
      passwordHash: ioPasswordHash,
    },
    create: {
      email: 'io.sharma@nyayavault.gov.in',
      fullName: 'Inspector R. Sharma',
      passwordHash: ioPasswordHash,
      role: RoleName.INVESTIGATING_OFFICER,
    },
  });

  const supervisorUser = await prisma.user.upsert({
    where: { email: 'super.verma@nyayavault.gov.in' },
    update: {
      passwordHash: superPasswordHash,
    },
    create: {
      email: 'super.verma@nyayavault.gov.in',
      fullName: 'Superintendent A. Verma',
      passwordHash: superPasswordHash,
      role: RoleName.SUPERVISOR,
    },
  });

  const prosecutorUser = await prisma.user.upsert({
    where: { email: 'prosecutor.mehta@nyayavault.gov.in' },
    update: {
      passwordHash: prosecutorPasswordHash,
    },
    create: {
      email: 'prosecutor.mehta@nyayavault.gov.in',
      fullName: 'Public Prosecutor K. Mehta',
      passwordHash: prosecutorPasswordHash,
      role: RoleName.PROSECUTOR,
    },
  });

  console.log(`Seeded 4 development users with Argon2 password hashes:`);
  console.log(`  - ${adminUser.email} (Role: ${adminUser.role})`);
  console.log(`  - ${ioUser.email} (Role: ${ioUser.role})`);
  console.log(`  - ${supervisorUser.email} (Role: ${supervisorUser.role})`);
  console.log(`  - ${prosecutorUser.email} (Role: ${prosecutorUser.role})`);

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
