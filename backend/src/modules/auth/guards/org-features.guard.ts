import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../services/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class OrgFeaturesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.get<string>(
      'orgFeature',
      context.getHandler(),
    );

    if (!requiredFeature) {
      return true; // No feature requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Super admins bypass feature checks
    if (user?.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!user || !user.orgId) {
      return true;
    }

    const cacheKey = `org:features:${user.orgId}`;
    const cachedData = await this.redis.get(cacheKey);
    let features: any = null;

    if (cachedData !== null) {
      features = JSON.parse(cachedData);
    } else {
      // Fetch organization features
      const org = await this.prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { features: true },
      });

      features = org?.features || null;

      // Cache for 30 minutes
      await this.redis.set(cacheKey, JSON.stringify(features), 'EX', 1800);
    }

    if (!features) {
      // No features defined = allow all (backward compatibility)
      return true;
    }

    const isFeatureEnabled = features[requiredFeature];

    if (isFeatureEnabled === false) {
      throw new ForbiddenException(
        `This feature (${requiredFeature}) is disabled for your organization. Contact your administrator.`,
      );
    }

    return true;
  }
}
