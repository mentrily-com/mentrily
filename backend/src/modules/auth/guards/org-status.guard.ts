import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../services/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class OrgStatusGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Super admins bypass organization status checks
    if (user?.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!user || !user.orgId) {
      // No org context means user is not part of an organization (shouldn't happen in normal flow)
      return true;
    }

    const cacheKey = `org:status:${user.orgId}`;
    const cachedData = await this.redis.get(cacheKey);

    if (cachedData) {
      const org = JSON.parse(cachedData);
      if (org.status !== 'Active') {
        throw new ForbiddenException(
          `This organization (${org.name}) is currently ${org.status.toLowerCase()}. Please contact support.`,
        );
      }
      return true;
    }

    // Fetch organization status
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { status: true, name: true },
    });

    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    // Cache the result for 15 minutes to reduce DB load
    await this.redis.set(cacheKey, JSON.stringify(org), 'EX', 900);

    if (org.status !== 'Active') {
      throw new ForbiddenException(
        `This organization (${org.name}) is currently ${org.status.toLowerCase()}. Please contact support.`,
      );
    }

    return true;
  }
}
