import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentType, IncidentSeverity, IncidentStatus, RoleName } from '@prisma/client';
import { UserPayload } from '../auth/decorators/current-user.decorator';

export interface CreateIncidentInput {
  incidentType: IncidentType;
  severity?: IncidentSeverity;
  caseId?: string;
  documentId?: string;
  versionId?: string;
  description: string;
}

@Injectable()
export class SecurityIncidentsService {
  private readonly logger = new Logger(SecurityIncidentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create security incident with deduplication for open incidents
   */
  async createIncident(input: CreateIncidentInput) {
    const { incidentType, severity = IncidentSeverity.HIGH, caseId, documentId, versionId, description } = input;

    // Deduplication check for OPEN / INVESTIGATING incidents on the same document/version
    if (documentId && versionId) {
      const existing = await this.prisma.securityIncident.findFirst({
        where: {
          documentId,
          versionId,
          incidentType,
          status: { in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING] },
        },
      });

      if (existing) {
        this.logger.warn(`Deduplicated security incident for document '${documentId}' version '${versionId}' (ID: ${existing.id})`);
        return existing;
      }
    }

    const incident = await this.prisma.securityIncident.create({
      data: {
        incidentType,
        severity,
        caseId: caseId || null,
        documentId: documentId || null,
        versionId: versionId || null,
        status: IncidentStatus.OPEN,
        description,
      },
    });

    this.logger.log(`Created Security Incident '${incident.id}' (${incidentType}, ${severity})`);
    return incident;
  }

  /**
   * Find security incidents accessible to user
   */
  async findAllForUser(user: UserPayload) {
    if (user.role === RoleName.ADMIN) {
      return this.prisma.securityIncident.findMany({
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          document: { select: { id: true, title: true } },
        },
        orderBy: { detectedAt: 'desc' },
      });
    }

    // Filter incidents by assigned cases for SUPERVISOR, INVESTIGATING_OFFICER, PROSECUTOR
    return this.prisma.securityIncident.findMany({
      where: {
        case: {
          assignments: {
            some: {
              userId: user.userId,
            },
          },
        },
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        document: { select: { id: true, title: true } },
      },
      orderBy: { detectedAt: 'desc' },
    });
  }

  /**
   * Find single security incident by ID
   */
  async findOne(id: string, user: UserPayload) {
    const incident = await this.prisma.securityIncident.findUnique({
      where: { id },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        document: { select: { id: true, title: true } },
        version: true,
      },
    });

    if (!incident) {
      throw new NotFoundException(`Security incident with ID '${id}' not found`);
    }

    if (user.role === RoleName.ADMIN) {
      return incident;
    }

    // Verify user case assignment if incident is associated with a case
    if (incident.caseId) {
      const assignment = await this.prisma.caseAssignment.findUnique({
        where: {
          caseId_userId: {
            caseId: incident.caseId,
            userId: user.userId,
          },
        },
      });

      if (!assignment) {
        throw new ForbiddenException('Access denied to this security incident');
      }
    }

    return incident;
  }

  /**
   * Update incident status (ADMIN only)
   */
  async updateStatus(id: string, status: IncidentStatus) {
    const incident = await this.prisma.securityIncident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Security incident with ID '${id}' not found`);
    }

    const resolvedAt = status === IncidentStatus.RESOLVED || status === IncidentStatus.DISMISSED ? new Date() : null;

    return this.prisma.securityIncident.update({
      where: { id },
      data: {
        status,
        resolvedAt,
      },
    });
  }
}
