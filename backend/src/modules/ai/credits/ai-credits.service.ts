import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../services/prisma/prisma.service';
import type { AiActor } from '../engine/ai-types';
import { creditsForUsage } from '../engine/ai-types';
import type { AiCallMeta } from '../engine/omniroute.service';
import { AiPlanContext, AiPlanService } from './ai-plan.service';

export interface CreditReservation {
  id: string;
  scope: string;
  period: string;
  amount: number;
  actor: AiActor;
}

const RESERVATION_TTL_MS = 45 * 60 * 1000;
const COUNTER_TTL_SECONDS = 40 * 24 * 3600;
const ACTIVE_JOB_WINDOW_MS = 30 * 60 * 1000;

// Atomic check-and-reserve: used + live reservations + amount must fit the
// limit. Reservations are ZSET members "id|amount" scored by expiry, so a
// crashed request frees its hold automatically.
const RESERVE_SCRIPT = `
local usedKey = KEYS[1]
local resKey = KEYS[2]
local limit = tonumber(ARGV[1])
local amount = tonumber(ARGV[2])
local member = ARGV[3]
local now = tonumber(ARGV[4])
local expiry = tonumber(ARGV[5])
local ttl = tonumber(ARGV[6])
redis.call('ZREMRANGEBYSCORE', resKey, '-inf', now)
local used = tonumber(redis.call('GET', usedKey) or '0')
local reserved = 0
for _, m in ipairs(redis.call('ZRANGE', resKey, 0, -1)) do
  local sep = string.find(m, '|', 1, true)
  if sep then reserved = reserved + tonumber(string.sub(m, sep + 1)) end
end
if limit >= 0 and used + reserved + amount > limit then
  return {0, used, reserved}
end
redis.call('ZADD', resKey, expiry, member)
redis.call('EXPIRE', resKey, ttl)
return {1, used, reserved}
`;

@Injectable()
export class AiCreditsService {
  private readonly logger = new Logger(AiCreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly plans: AiPlanService,
  ) {}

  period(date = new Date()): string {
    return date.toISOString().slice(0, 7);
  }

  private periodStart(period: string): Date {
    return new Date(`${period}-01T00:00:00.000Z`);
  }

  private nextPeriodStart(period: string): Date {
    const start = this.periodStart(period);
    return new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    );
  }

  private usedKey(scope: string, period: string) {
    return `ai:credits:used:${scope}:${period}`;
  }

  private reservationKey(scope: string, period: string) {
    return `ai:credits:res:${scope}:${period}`;
  }

  private scopeWhere(scope: string) {
    const [kind, id] = scope.split(':');
    return kind === 'org' ? { orgId: id } : { orgId: null, userId: id };
  }

  /** Redis is a cache over the AiUsage ledger; rebuild it on a miss. */
  private async ensureCounter(scope: string, period: string): Promise<number> {
    const key = this.usedKey(scope, period);
    const cached = await this.redis.get(key);
    if (cached !== null) return Number(cached);

    const aggregate = await this.prisma.aiUsage.aggregate({
      _sum: { credits: true },
      where: {
        ...this.scopeWhere(scope),
        createdAt: {
          gte: this.periodStart(period),
          lt: this.nextPeriodStart(period),
        },
      },
    });
    const used = aggregate._sum.credits ?? 0;
    await this.redis.set(key, String(used), 'EX', COUNTER_TTL_SECONDS, 'NX');
    return Number((await this.redis.get(key)) ?? used);
  }

  async reserve(
    actor: AiActor,
    ctx: AiPlanContext,
    amount: number,
  ): Promise<CreditReservation> {
    const period = this.period();
    const reservation: CreditReservation = {
      id: randomUUID(),
      scope: ctx.scope,
      period,
      amount: Math.max(1, Math.ceil(amount)),
      actor,
    };
    const limit = this.plans.limit(ctx, 'aiCreditsPerMonth');
    await this.ensureCounter(ctx.scope, period);

    const now = Date.now();
    const [ok, used, reserved] = (await this.redis.eval(
      RESERVE_SCRIPT,
      2,
      this.usedKey(ctx.scope, period),
      this.reservationKey(ctx.scope, period),
      String(limit),
      String(reservation.amount),
      `${reservation.id}|${reservation.amount}`,
      String(now),
      String(now + RESERVATION_TTL_MS),
      String(COUNTER_TTL_SECONDS),
    )) as [number, number, number];

    if (ok !== 1) {
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        resource: 'aiCreditsPerMonth',
        current: Number(used) + Number(reserved),
        limit,
        required: reservation.amount,
        resetsAt: this.nextPeriodStart(period).toISOString(),
        upgradeUrl: '/dashboard/creator/billing',
        message:
          Number(used) + Number(reserved) >= limit
            ? `You've used all ${limit} AI credits for this month.`
            : `This needs about ${reservation.amount} AI credits, but only ${Math.max(0, limit - Number(used) - Number(reserved))} are left this month.`,
      });
    }
    return reservation;
  }

  async release(reservation: CreditReservation | null | undefined) {
    if (!reservation) return;
    await this.redis
      .zrem(
        this.reservationKey(reservation.scope, reservation.period),
        `${reservation.id}|${reservation.amount}`,
      )
      .catch(() => undefined);
  }

  /**
   * Writes one ledger row for a model call and bumps the monthly counter.
   * Failed calls are billed for the tokens they actually consumed.
   */
  async charge(
    reservation: CreditReservation,
    meta: AiCallMeta,
    operation: string,
    extra: {
      jobId?: string | null;
      conversationId?: string | null;
      success?: boolean;
      errorMessage?: string | null;
    } = {},
  ): Promise<number> {
    const credits = creditsForUsage(meta.tier, meta.usage);
    try {
      await this.prisma.aiUsage.create({
        data: {
          orgId: reservation.actor.orgId,
          userId: reservation.actor.userId,
          provider: meta.provider,
          model: meta.resolvedModel,
          tier: meta.tier,
          operation,
          promptTokens: meta.usage.inputTokens,
          completionTokens: meta.usage.outputTokens,
          totalTokens: meta.usage.totalTokens,
          cachedTokens: meta.usage.cachedTokens,
          credits,
          costUsd: meta.costUsd,
          latencyMs: meta.latencyMs,
          requestId: reservation.id,
          jobId: extra.jobId ?? null,
          conversationId: extra.conversationId ?? null,
          success: extra.success ?? true,
          errorMessage: extra.errorMessage?.slice(0, 1000) ?? null,
        },
      });
      if (credits > 0) {
        await this.ensureCounter(reservation.scope, reservation.period);
        await this.redis.incrby(
          this.usedKey(reservation.scope, reservation.period),
          credits,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to record AI usage (${operation}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return credits;
  }

  /** Daily Studio message allowance. Counted when a message is accepted. */
  async consumeMessage(ctx: AiPlanContext): Promise<void> {
    const limit = this.plans.limit(ctx, 'aiMessagesPerDay');
    if (limit < 0) return;
    const day = new Date().toISOString().slice(0, 10);
    const key = `ai:msgs:${ctx.scope}:${day}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 2 * 24 * 3600);
    if (count > limit) {
      await this.redis.decr(key);
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        resource: 'aiMessagesPerDay',
        current: limit,
        limit,
        upgradeUrl: '/dashboard/creator/billing',
        message: `You've reached today's limit of ${limit} AI Studio messages.`,
      });
    }
  }

  async messagesToday(scope: string): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    return Number((await this.redis.get(`ai:msgs:${scope}:${day}`)) ?? 0);
  }

  async assertJobSlot(actor: AiActor, ctx: AiPlanContext): Promise<void> {
    const limit = this.plans.limit(ctx, 'aiConcurrentJobs');
    if (limit < 0) return;
    const active = await this.prisma.aiJob.count({
      where: {
        ...(actor.orgId ? { orgId: actor.orgId } : { userId: actor.userId }),
        status: { in: ['queued', 'running'] },
        createdAt: { gte: new Date(Date.now() - ACTIVE_JOB_WINDOW_MS) },
      },
    });
    if (active >= limit) {
      throw new HttpException(
        {
          code: 'AI_CONCURRENCY_LIMIT',
          limit,
          message:
            limit === 1
              ? 'A generation is already running. Wait for it to finish, then try again.'
              : `Your plan allows ${limit} generations at a time. Wait for one to finish, then try again.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async summary(actor: AiActor) {
    const ctx = await this.plans.resolve(actor);
    const period = this.period();
    const used = await this.ensureCounter(ctx.scope, period);
    const byOperation = await this.prisma.aiUsage.groupBy({
      by: ['operation'],
      _sum: { credits: true },
      where: {
        ...this.scopeWhere(ctx.scope),
        createdAt: { gte: this.periodStart(period) },
      },
    });
    const limit = this.plans.limit(ctx, 'aiCreditsPerMonth');
    return {
      plan: ctx.plan,
      period,
      resetsAt: this.nextPeriodStart(period).toISOString(),
      credits: {
        used,
        limit,
        remaining: limit < 0 ? -1 : Math.max(0, limit - used),
      },
      messages: {
        usedToday: await this.messagesToday(ctx.scope),
        limit: this.plans.limit(ctx, 'aiMessagesPerDay'),
      },
      limits: {
        maxQuestionsPerGeneration: this.plans.limit(
          ctx,
          'aiMaxQuestionsPerGeneration',
        ),
        concurrentJobs: this.plans.limit(ctx, 'aiConcurrentJobs'),
        maxReferences: this.plans.limit(ctx, 'aiMaxReferences'),
      },
      features: {
        aiStudio: this.plans.hasFeature(ctx, 'aiStudio'),
        aiExams: this.plans.hasFeature(ctx, 'aiExams'),
        aiProTier: this.plans.hasFeature(ctx, 'aiProTier'),
      },
      byOperation: byOperation
        .map((row) => ({
          operation: row.operation,
          credits: row._sum.credits ?? 0,
        }))
        .sort((a, b) => b.credits - a.credits),
    };
  }

  /** Monthly credits used, for the billing usage overview. */
  async usedThisMonth(input: {
    orgId?: string | null;
    userId?: string | null;
  }): Promise<number> {
    const scope = input.orgId
      ? `org:${input.orgId}`
      : input.userId
        ? `user:${input.userId}`
        : null;
    if (!scope) return 0;
    return this.ensureCounter(scope, this.period());
  }
}
