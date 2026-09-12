import { PrismaClient } from '@prisma/client';
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
  console.log('Cleaning up dummy seed users and cases from database...');

  const dummyEmails = [
    'admin@nyayavault.gov.in',
    'io.sharma@nyayavault.gov.in',
    'super.verma@nyayavault.gov.in',
    'prosecutor.mehta@nyayavault.gov.in',
  ];

  const dummyCaseNumbers = [
    'CR-2026-0042',
    'CR-2026-0108',
    'CR-2026-0199',
  ];

  const dummyUsers = await prisma.user.findMany({
    where: { email: { in: dummyEmails } },
    select: { id: true },
  });
  const dummyUserIds = dummyUsers.map((u) => u.id);

  const dummyCases = await prisma.case.findMany({
    where: { caseNumber: { in: dummyCaseNumbers } },
    select: { id: true },
  });
  const dummyCaseIds = dummyCases.map((c) => c.id);

  if (dummyCaseIds.length > 0 || dummyUserIds.length > 0) {
    await prisma.evidenceShare.deleteMany({
      where: {
        OR: [
          { caseId: { in: dummyCaseIds } },
          { createdById: { in: dummyUserIds } },
        ],
      },
    });

    await prisma.securityIncident.deleteMany({
      where: {
        OR: [
          { caseId: { in: dummyCaseIds } },
          { reportedById: { in: dummyUserIds } },
        ],
      },
    });

    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { caseId: { in: dummyCaseIds } },
          { userId: { in: dummyUserIds } },
        ],
      },
    });

    await prisma.approval.deleteMany({
      where: {
        OR: [
          { requestedById: { in: dummyUserIds } },
          { approvedById: { in: dummyUserIds } },
          { document: { caseId: { in: dummyCaseIds } } },
        ],
      },
    });

    await prisma.documentVersion.deleteMany({
      where: {
        OR: [
          { createdById: { in: dummyUserIds } },
          { document: { caseId: { in: dummyCaseIds } } },
        ],
      },
    });

    await prisma.document.deleteMany({
      where: {
        OR: [
          { caseId: { in: dummyCaseIds } },
          { createdById: { in: dummyUserIds } },
        ],
      },
    });

    await prisma.caseAssignment.deleteMany({
      where: {
        OR: [
          { caseId: { in: dummyCaseIds } },
          { userId: { in: dummyUserIds } },
        ],
      },
    });

    await prisma.case.deleteMany({
      where: {
        OR: [
          { id: { in: dummyCaseIds } },
          { createdById: { in: dummyUserIds } },
        ],
      },
    });

    await prisma.refreshToken.deleteMany({
      where: { userId: { in: dummyUserIds } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: dummyUserIds } },
    });

    console.log(`Successfully purged ${dummyUserIds.length} dummy users and ${dummyCaseIds.length} dummy cases.`);
  } else {
    console.log('No dummy users or cases found in database.');
  }

  console.log('Seed cleanup step complete.');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
