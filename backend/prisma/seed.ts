import {
  PrismaClient,
  RoleName,
  CaseStatus,
  DocumentClassification,
  DocumentStatus,
  AuditEventType,
} from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

import * as fs from 'fs';
import * as path from 'path';
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, { encoding: 'utf8' });
  envContent.split(/\r?\n/).forEach(line => {
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
  console.log('Seeding development users with Argon2 password hashes...');

  // Compute Argon2 hashes for development credentials
  const adminPasswordHash = await argon2.hash('Admin@Nyaya2026');
  const ioPasswordHash = await argon2.hash('Officer@Nyaya2026');
  const superPasswordHash = await argon2.hash('Super@Nyaya2026');
  const prosecutorPasswordHash = await argon2.hash('Prosecutor@Nyaya2026');

  // 1. Seed Development Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nyayavault.gov.in' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@nyayavault.gov.in',
      fullName: 'System Administrator',
      passwordHash: adminPasswordHash,
      role: RoleName.ADMIN,
    },
  });

  const ioUser = await prisma.user.upsert({
    where: { email: 'io.sharma@nyayavault.gov.in' },
    update: { passwordHash: ioPasswordHash },
    create: {
      email: 'io.sharma@nyayavault.gov.in',
      fullName: 'Inspector R. Sharma',
      passwordHash: ioPasswordHash,
      role: RoleName.INVESTIGATING_OFFICER,
    },
  });

  const supervisorUser = await prisma.user.upsert({
    where: { email: 'super.verma@nyayavault.gov.in' },
    update: { passwordHash: superPasswordHash },
    create: {
      email: 'super.verma@nyayavault.gov.in',
      fullName: 'Superintendent A. Verma',
      passwordHash: superPasswordHash,
      role: RoleName.SUPERVISOR,
    },
  });

  const prosecutorUser = await prisma.user.upsert({
    where: { email: 'prosecutor.mehta@nyayavault.gov.in' },
    update: { passwordHash: prosecutorPasswordHash },
    create: {
      email: 'prosecutor.mehta@nyayavault.gov.in',
      fullName: 'Public Prosecutor K. Mehta',
      passwordHash: prosecutorPasswordHash,
      role: RoleName.PROSECUTOR,
    },
  });

  console.log('Seeded 4 core role users:');
  console.log(`  - ADMIN: ${adminUser.email}`);
  console.log(`  - INVESTIGATING_OFFICER: ${ioUser.email}`);
  console.log(`  - SUPERVISOR: ${supervisorUser.email}`);
  console.log(`  - PROSECUTOR: ${prosecutorUser.email}`);

  // 2. Seed Sample Cases
  const case1 = await prisma.case.upsert({
    where: { caseNumber: 'CR-2026-0042' },
    update: {},
    create: {
      caseNumber: 'CR-2026-0042',
      title: 'State vs. Cyber Intruders Investigation',
      description: 'Investigation into unauthorized digital data exfiltration, system intrusion, and evidence forgery.',
      status: CaseStatus.UNDER_INVESTIGATION,
      createdById: ioUser.id,
    },
  });

  const case2 = await prisma.case.upsert({
    where: { caseNumber: 'CR-2026-0108' },
    update: {},
    create: {
      caseNumber: 'CR-2026-0108',
      title: 'Financial Forensics Audit Case',
      description: 'Audit of fraudulent digital transaction records and falsified ledger statements.',
      status: CaseStatus.OPEN,
      createdById: supervisorUser.id,
    },
  });

  const case3 = await prisma.case.upsert({
    where: { caseNumber: 'CR-2026-0199' },
    update: {},
    create: {
      caseNumber: 'CR-2026-0199',
      title: 'State vs. Corporate Fraud Network',
      description: 'Investigation into shell companies, illegal fund transfers, and document tampering.',
      status: CaseStatus.UNDER_INVESTIGATION,
      createdById: ioUser.id,
    },
  });

  console.log(`Seeded 3 cases: ${case1.caseNumber}, ${case2.caseNumber}, ${case3.caseNumber}`);

  // 3. Seed Case Assignments
  await prisma.caseAssignment.upsert({
    where: { caseId_userId: { caseId: case1.id, userId: ioUser.id } },
    update: {},
    create: { caseId: case1.id, userId: ioUser.id, roleInCase: 'Lead Investigator' },
  });

  await prisma.caseAssignment.upsert({
    where: { caseId_userId: { caseId: case1.id, userId: supervisorUser.id } },
    update: {},
    create: { caseId: case1.id, userId: supervisorUser.id, roleInCase: 'Supervising Officer' },
  });

  await prisma.caseAssignment.upsert({
    where: { caseId_userId: { caseId: case1.id, userId: prosecutorUser.id } },
    update: {},
    create: { caseId: case1.id, userId: prosecutorUser.id, roleInCase: 'Assigned Prosecutor' },
  });

  await prisma.caseAssignment.upsert({
    where: { caseId_userId: { caseId: case2.id, userId: supervisorUser.id } },
    update: {},
    create: { caseId: case2.id, userId: supervisorUser.id, roleInCase: 'Audit Lead' },
  });

  await prisma.caseAssignment.upsert({
    where: { caseId_userId: { caseId: case3.id, userId: ioUser.id } },
    update: {},
    create: { caseId: case3.id, userId: ioUser.id, roleInCase: 'Primary Officer' },
  });

  console.log('Seeded case assignments for CBAC testing.');

  // 4. Seed Initial Documents for Case 1
  const doc1Content = Buffer.from('Official First Information Report (FIR) - Cyber Intrusion Case CR-2026-0042');
  const doc1Hash = crypto.createHash('sha256').update(doc1Content).digest('hex');

  const existingDoc1 = await prisma.document.findFirst({ where: { caseId: case1.id, title: 'First Information Report (FIR)' } });
  if (!existingDoc1) {
    const doc1 = await prisma.document.create({
      data: {
        caseId: case1.id,
        title: 'First Information Report (FIR)',
        documentType: 'FIR',
        classification: DocumentClassification.CONFIDENTIAL,
        currentStatus: DocumentStatus.APPROVED,
        createdById: ioUser.id,
      },
    });

    const v1 = await prisma.documentVersion.create({
      data: {
        documentId: doc1.id,
        versionNumber: 1,
        storagePath: `cases/${case1.id}/documents/${doc1.id}/versions/1/fir.pdf`,
        fileSizeBytes: BigInt(doc1Content.length),
        mimeType: 'application/pdf',
        sha256Hash: doc1Hash,
        createdById: ioUser.id,
      },
    });

    await prisma.document.update({
      where: { id: doc1.id },
      data: { currentVersionId: v1.id },
    });

    await prisma.approval.create({
      data: {
        documentId: doc1.id,
        versionId: v1.id,
        requestedById: ioUser.id,
        approvedById: supervisorUser.id,
        status: DocumentStatus.APPROVED,
        comments: 'Verified and approved by Superintendent Verma.',
        decidedAt: new Date(),
      },
    });

    // Record Genesis Audit Event
    const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const canonicalStr = `1|DOCUMENT_UPLOADED|${ioUser.id}|${case1.id}|${doc1.id}|${v1.id}|Uploaded FIR (Version 1)|{"sha256Hash":"${doc1Hash}"}`;
    const currentHash = crypto.createHash('sha256').update(`${genesisHash}|${canonicalStr}`).digest('hex');

    await prisma.auditEvent.create({
      data: {
        eventType: AuditEventType.DOCUMENT_UPLOADED,
        userId: ioUser.id,
        caseId: case1.id,
        documentId: doc1.id,
        versionId: v1.id,
        action: `Uploaded original document 'First Information Report (FIR)' (Version 1)`,
        metadata: { sha256Hash: doc1Hash, fileSizeBytes: doc1Content.length, mimeType: 'application/pdf' },
        previousEventHash: genesisHash,
        currentEventHash: currentHash,
      },
    });

    console.log(`Seeded Document 1: FIR (${doc1.id}) with Version 1 and Audit Event`);
  }

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
