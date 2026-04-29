import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../services/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  PLAN_FEATURES,
  PlanKey,
  getRequiredPlanForFeature,
} from '../../../config/plan-limits';
import { REQUIRED_PLAN_FEATURE_KEY } from '../plan.decorator';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRED_PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (user?.role === 'SUPER_ADMIN') {
      return true;
    }

    const orgId = String(user?.orgId || '').trim();
    const cacheKey = orgId
      ? `org:effective_features:${orgId}`
      : `user:effective_features:${String(user?.id || '').trim()}`;
    const cached = await this.redis.get(cacheKey);

    let effectiveFeatures: Record<string, boolean> = {};
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        effectiveFeatures = (parsed?.features || parsed) as Record<
          string,
          boolean
        >;
      } catch {
        effectiveFeatures = {};
      }
    }

    if (!cached && orgId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true, features: true },
      });

      if (!org) {
        throw new ForbiddenException('Organization not found');
      }

      const plan = (org.plan as PlanKey) || 'FREE';
      const baseFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.FREE;
      const overrides =
        org.features &&
        typeof org.features === 'object' &&
        !Array.isArray(org.features)
          ? (org.features as Record<string, boolean>)
          : {};

      effectiveFeatures = {
        ...baseFeatures,
        ...overrides,
      };

      await this.redis.set(
        cacheKey,
        JSON.stringify({ plan, features: effectiveFeatures }),
        'EX',
        1800,
      );
    }

    if (!cached && !orgId) {
      effectiveFeatures = PLAN_FEATURES.FREE;
      await this.redis.set(
        cacheKey,
        JSON.stringify({ plan: 'FREE', features: effectiveFeatures }),
        'EX',
        1800,
      );
    }

    if (effectiveFeatures[requiredFeature] !== true) {
      throw new ForbiddenException({
        code: 'PLAN_FEATURE_REQUIRED',
        feature: requiredFeature,
        requiredPlan: getRequiredPlanForFeature(requiredFeature),
        upgradeUrl: '/dashboard/creator/billing',
      });
    }

    return true;
  }
}
