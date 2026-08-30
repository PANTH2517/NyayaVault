import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CaseAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId || !user.role) {
      throw new ForbiddenException('User identity not established');
    }

    // Extract target caseId from route params (:id or :caseId)
    const caseId = request.params.id || request.params.caseId;

    if (!caseId) {
      // If endpoint doesn't target a specific case parameter, skip CBAC check
      return true;
    }

    // ADMIN users bypass case-specific assignment checks
    if (user.role === RoleName.ADMIN) {
      return true;
    }

    // For non-admin users (INVESTIGATING_OFFICER, SUPERVISOR, PROSECUTOR), verify case assignment in database
    const assignment = await this.prisma.caseAssignment.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: user.userId,
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException('Access denied: You are not assigned to this case');
    }

    return true;
  }
}
