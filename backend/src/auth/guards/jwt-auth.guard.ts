import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_key_for_local_testing_only';
      payload = await this.jwtService.verifyAsync(token, { secret });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // Verify account active status in DB to ensure immediate deactivation enforcement
    let user: { id: string; email: string; role: any; isActive: boolean } | null = null;
    let retries = 2;
    while (retries >= 0) {
      try {
        user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, role: true, isActive: true },
        });
        break;
      } catch (dbErr) {
        if (retries === 0) {
          throw new UnauthorizedException('Authentication database error. Access denied.');
        }
        retries--;
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or disabled');
    }

    // Attach user payload to request
    request.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return true;
  }
}
