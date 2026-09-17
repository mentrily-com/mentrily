import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../../../services/prisma/prisma.service';
import {
  PLAN_FEATURES,
  PlanKey,
  getEffectivePlanLimits,
  getRequiredPlanForFeature,
} from '../../../config/plan-limits';
import type { AiActor, AiTier } from '../engine/ai-types';

type Limits = ReturnType<typeof getEffectivePlanLimits>;

export interface AiPlanContext {
  plan: PlanKey;
  limits: Limits;
  features: Record<string, unknown>;
  /** Billing scope: the org, or the user for org-less personal creators. */
  scope: string;
  unlimited: boolean;
}

export type AiFeature = 'aiStudio' | 'aiExams' | 'aiProTier';

const CACHE_TTL_SECONDS = 60;

/**
 * Resolves the caller's effective plan exactly like PlanGuard does (a
 * canceled or expired plan falls back to FREE and drops overrides), so AI
 * limits always agree with every other plan gate in the app.
 */
@Injectable()
export class AiPlanService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async resolve(actor: AiActor): Promise<AiPlanContext> {
    let orgId = actor.orgId;
    if (!orgId) {
      const user = await this.prisma.user.findUnique({
        where: { id: actor.userId },
        select: { orgId: true, lastActiveOrgId: true },
      });
      orgId = user?.orgId ?? user?.lastActiveOrgId ?? null;
      if (!orgId) {
        const personalOrg = await this.prisma.organization.findFirst({
          where: { provisionedFromUserId: actor.userId },
          select: { id: true },
        });
        orgId = personalOrg?.id ?? null;
      }
    }

    if (!orgId) {
      const unlimited = actor.role === 'SUPER_ADMIN';
      return {
        plan: 'FREE',
        limits: getEffectivePlanLimits('FREE'),
        features: { ...PLAN_FEATURES.FREE },
        scope: `user:${actor.userId}`,
        unlimited,
      };
    }

    const cacheKey = `ai:plan:${orgId}`;
    const cached = await this.redis.get(cacheKey);
    let plan: PlanKey;
    let rawFeatures: unknown;

    if (cached) {
      const parsed = JSON.parse(cached) as { plan: PlanKey; features: unknown };
      plan = parsed.plan;
      rawFeatures = parsed.features;
    } else {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          plan: true,
          features: true,
          planStatus: true,
          planExpiresAt: true,
        },
      });
      if (!org) throw new ForbiddenException('Organization not found');

      const inactive =
        org.planStatus === 'CANCELED' ||
        (org.planExpiresAt && org.planExpiresAt.getTime() < Date.now());
      plan = inactive ? 'FREE' : ((org.plan as PlanKey) ?? 'FREE');
      rawFeatures = inactive ? null : org.features;
      await this.redis.set(
        cacheKey,
        JSON.stringify({ plan, features: rawFeatures }),
        'EX',
        CACHE_TTL_SECONDS,
      );
    }

    const overrides =
      rawFeatures &&
      typeof rawFeatures === 'object' &&
      !Array.isArray(rawFeatures)
        ? (rawFeatures as Record<string, unknown>)
        : {};

    return {
      plan,
      limits: getEffectivePlanLimits(plan, rawFeatures),
      features: {
        ...(PLAN_FEATURES[plan] ?? PLAN_FEATURES.FREE),
        ...overrides,
      },
      scope: `org:${orgId}`,
      unlimited: actor.role === 'SUPER_ADMIN',
    };
  }

  hasFeature(ctx: AiPlanContext, feature: AiFeature): boolean {
    return ctx.unlimited || ctx.features[feature] === true;
  }

  assertFeature(ctx: AiPlanContext, feature: AiFeature): void {
    if (this.hasFeature(ctx, feature)) return;
    throw new ForbiddenException({
      code: 'PLAN_FEATURE_REQUIRED',
      feature,
      requiredPlan: getRequiredPlanForFeature(feature),
      upgradeUrl: '/dashboard/creator/billing',
      message:
        feature === 'aiExams'
          ? 'Full AI course and exam generation is available on the Starter plan and above.'
          : feature === 'aiProTier'
            ? 'The highest-quality AI tier is available on the Pro plan and above.'
            : 'AI Studio is not available on your plan.',
    });
  }

  /** Pro tier silently falls back to standard when the plan doesn't include it. */
  effectiveTier(ctx: AiPlanContext, requested: AiTier): AiTier {
    if (requested === 'pro' && !this.hasFeature(ctx, 'aiProTier')) {
      return 'standard';
    }
    return requested;
  }

  limit(ctx: AiPlanContext, key: keyof Limits): number {
    if (ctx.unlimited) return -1;
    const value = Number(ctx.limits[key]);
    return Number.isFinite(value) ? value : 0;
  }
}
