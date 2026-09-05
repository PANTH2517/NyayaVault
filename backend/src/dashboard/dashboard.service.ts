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
      const totalCases = await this.prisma.case.count();
      const totalDocuments = await this.prisma.document.count();
      const underReviewCount = await this.prisma.document.count({ where: { currentStatus: 'UNDER_REVIEW' } });
      const approvedCount = await this.prisma.document.count({ where: { currentStatus: 'APPROVED' } });
      const sealedCount = await this.prisma.document.count({ where: { currentStatus: 'SEALED' } });
      const openIncidentsCount = await this.prisma.securityIncident.count({ where: { status: 'OPEN' } });
      const recentActivityRaw = await this.prisma.auditEvent.findMany({
        orderBy: { sequenceNumber: 'desc' },
        take: 10,
        include: {
          user: { select: { fullName: true, role: true, email: true } },
        },
      });

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

      const totalCases = assignedCaseIds.length;
      const totalDocuments = await this.prisma.document.count({ where: { caseId: { in: assignedCaseIds } } });
      const underReviewCount = await this.prisma.document.count({
        where: { caseId: { in: assignedCaseIds }, currentStatus: 'UNDER_REVIEW' },
      });
      const approvedCount = await this.prisma.document.count({
        where: { caseId: { in: assignedCaseIds }, currentStatus: 'APPROVED' },
      });
      const sealedCount = await this.prisma.document.count({
        where: { caseId: { in: assignedCaseIds }, currentStatus: 'SEALED' },
      });
      const openIncidentsCount = await this.prisma.securityIncident.count({
        where: { caseId: { in: assignedCaseIds }, status: 'OPEN' },
      });
      const recentActivityRaw = await this.prisma.auditEvent.findMany({
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
      });

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
