import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from '../auth/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(user: UserPayload) {
    const isAdmin = user.role === RoleName.ADMIN;

    if (isAdmin) {
      const [
        totalCases,
        totalDocuments,
        underReviewCount,
        approvedCount,
        sealedCount,
        openIncidentsCount,
        recentActivityRaw,
      ] = await Promise.all([
        this.prisma.case.count(),
        this.prisma.document.count(),
        this.prisma.document.count({ where: { currentStatus: 'UNDER_REVIEW' } }),
        this.prisma.document.count({ where: { currentStatus: 'APPROVED' } }),
        this.prisma.document.count({ where: { currentStatus: 'SEALED' } }),
        this.prisma.securityIncident.count({ where: { status: 'OPEN' } }),
        this.prisma.auditEvent.findMany({
          orderBy: { sequenceNumber: 'desc' },
          take: 10,
          include: {
            user: { select: { fullName: true, role: true, email: true } },
          },
        }),
      ]);

      const recentActivity = recentActivityRaw.map((event) => ({
        ...event,
        sequenceNumber: event.sequenceNumber.toString(),
      }));

      return {
        role: user.role,
        totalCases,
        totalDocuments,
        underReviewCount,
        approvedCount,
        sealedCount,
        openIncidentsCount,
        recentActivity,
      };
    } else {
      const assignedAssignments = await this.prisma.caseAssignment.findMany({
        where: { userId: user.userId },
        select: { caseId: true },
      });

      const assignedCaseIds = assignedAssignments.map((a) => a.caseId);

      const [
        totalCases,
        totalDocuments,
        underReviewCount,
        approvedCount,
        sealedCount,
        openIncidentsCount,
        recentActivityRaw,
      ] = await Promise.all([
        assignedCaseIds.length,
        this.prisma.document.count({ where: { caseId: { in: assignedCaseIds } } }),
        this.prisma.document.count({
          where: { caseId: { in: assignedCaseIds }, currentStatus: 'UNDER_REVIEW' },
        }),
        this.prisma.document.count({
          where: { caseId: { in: assignedCaseIds }, currentStatus: 'APPROVED' },
        }),
        this.prisma.document.count({
          where: { caseId: { in: assignedCaseIds }, currentStatus: 'SEALED' },
        }),
        this.prisma.securityIncident.count({
          where: { caseId: { in: assignedCaseIds }, status: 'OPEN' },
        }),
        this.prisma.auditEvent.findMany({
          where: {
            OR: [
              { caseId: { in: assignedCaseIds } },
              { userId: user.userId },
            ],
          },
          orderBy: { sequenceNumber: 'desc' },
          take: 10,
          include: {
            user: { select: { fullName: true, role: true, email: true } },
          },
        }),
      ]);

      const recentActivity = recentActivityRaw.map((event) => ({
        ...event,
        sequenceNumber: event.sequenceNumber.toString(),
      }));

      return {
        role: user.role,
        totalCases,
        totalDocuments,
        underReviewCount,
        approvedCount,
        sealedCount,
        openIncidentsCount,
        recentActivity,
      };
    }
  }
}
