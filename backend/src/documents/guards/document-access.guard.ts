import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocumentAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId || !user.role) {
      throw new ForbiddenException('User identity not established');
    }

    const documentId = request.params.id || request.params.documentId;
    if (!documentId) {
      return true;
    }

    // ADMIN users bypass document access restrictions
    if (user.role === RoleName.ADMIN) {
      return true;
    }

    // Fetch document to locate associated caseId
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, caseId: true },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID '${documentId}' not found`);
    }

    // Verify user assignment to the document's parent case
    const assignment = await this.prisma.caseAssignment.findUnique({
      where: {
        caseId_userId: {
          caseId: document.caseId,
          userId: user.userId,
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException('Access denied: You are not assigned to the case containing this document');
    }

    return true;
  }
}
