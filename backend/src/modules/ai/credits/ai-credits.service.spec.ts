import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { AiCreditsService } from './ai-credits.service';
import { AiPlanService } from './ai-plan.service';
import { PrismaService } from '../../../services/prisma/prisma.service';
import Redis from 'ioredis';

describe('AiCreditsService', () => {
  let service: AiCreditsService;
  let prisma: Partial<PrismaService>;
  let redis: Partial<Redis>;
  let plans: Partial<AiPlanService>;

  beforeEach(() => {
    prisma = {
      aiUsage: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { credits: 50 } }),
        create: jest.fn().mockResolvedValue({ id: 'usage-1' }),
        groupBy: jest.fn().mockResolvedValue([]),
      } as any,
      aiJob: {
        count: jest.fn().mockResolvedValue(0),
      } as any,
    };
    redis = {
      get: jest.fn().mockResolvedValue('50'),
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue([1, 50, 0]),
      zrem: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      decr: jest.fn().mockResolvedValue(0),
      incrby: jest.fn().mockResolvedValue(60),
      expire: jest.fn().mockResolvedValue(1),
    };
    plans = {
      limit: jest.fn().mockReturnValue(100),
      hasFeature: jest.fn().mockReturnValue(true),
      resolve: jest.fn().mockResolvedValue({
        plan: 'FREE',
        limits: {},
        features: {},
        scope: 'user:user-1',
        unlimited: false,
      }),
    };
    service = new AiCreditsService(
      prisma as PrismaService,
      redis as Redis,
      plans as AiPlanService,
    );
  });

  describe('period formatting', () => {
    it('formats year and month as YYYY-MM', () => {
      const d = new Date('2026-09-14T12:00:00Z');
      expect(service.period(d)).toBe('2026-09');
    });
  });

  describe('reserve', () => {
    const actor = { userId: 'u1', orgId: 'org1', role: 'TEACHER' };
    const ctx = {
      plan: 'STARTER' as const,
      limits: {} as any,
      features: {},
      scope: 'org:org1',
      unlimited: false,
    };

    it('successfully reserves credits when within limit', async () => {
      (redis.eval as jest.Mock).mockResolvedValue([1, 20, 0]);

      const reservation = await service.reserve(actor, ctx, 15);

      expect(reservation.scope).toBe('org:org1');
      expect(reservation.amount).toBe(15);
      expect(redis.eval).toHaveBeenCalled();
    });

    it('passes custom ttlMs to Lua script', async () => {
      const customTtl = 180_000;
      await service.reserve(actor, ctx, 10, customTtl);

      const evalArgs = (redis.eval as jest.Mock).mock.calls[0];
      const expiryArg = Number(evalArgs[8]);
      const now = Date.now();
      // expiry should be approximately now + customTtl (within 2 seconds)
      expect(expiryArg - now).toBeGreaterThanOrEqual(customTtl - 2000);
      expect(expiryArg - now).toBeLessThanOrEqual(customTtl + 2000);
    });

    it('throws QUOTA_EXCEEDED with upgrade url and reset date when over limit', async () => {
      (redis.eval as jest.Mock).mockResolvedValue([0, 95, 10]);

      await expect(service.reserve(actor, ctx, 20)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('release', () => {
    it('removes member from Redis ZSET', async () => {
      const reservation = {
        id: 'res-123',
        scope: 'org:org1',
        period: '2026-09',
        amount: 25,
        actor: { userId: 'u1', orgId: 'org1', role: 'TEACHER' },
      };

      await service.release(reservation);

      expect(redis.zrem).toHaveBeenCalledWith(
        'ai:credits:res:org:org1:2026-09',
        'res-123|25',
      );
    });

    it('handles null or undefined reservation safely', async () => {
      await expect(service.release(null)).resolves.not.toThrow();
      await expect(service.release(undefined)).resolves.not.toThrow();
    });
  });

  describe('acquireJobSlot', () => {
    const actor = { userId: 'u1', orgId: 'org1', role: 'TEACHER' };
    const ctx = {
      plan: 'FREE' as const,
      limits: {} as any,
      features: {},
      scope: 'org:org1',
      unlimited: false,
    };

    it('grants slot and returns cleanup callback when under limit', async () => {
      (plans.limit as jest.Mock).mockReturnValue(1);
      (redis.incr as jest.Mock).mockResolvedValue(1);
      (prisma.aiJob!.count as jest.Mock).mockResolvedValue(0);

      const release = await service.acquireJobSlot(actor, ctx);
      expect(release).toBeInstanceOf(Function);

      await release();
      expect(redis.decr).toHaveBeenCalledWith('ai:job_hold:org:org1');
    });

    it('rejects and decrements hold when concurrent slot limit is exceeded', async () => {
      (plans.limit as jest.Mock).mockReturnValue(1);
      (redis.incr as jest.Mock).mockResolvedValue(2); // Second concurrent hold
      (prisma.aiJob!.count as jest.Mock).mockResolvedValue(0);

      await expect(service.acquireJobSlot(actor, ctx)).rejects.toThrow(
        HttpException,
      );
      expect(redis.decr).toHaveBeenCalledWith('ai:job_hold:org:org1');
    });

    it('bypasses concurrency check when limit is unlimited (-1)', async () => {
      (plans.limit as jest.Mock).mockReturnValue(-1);

      const release = await service.acquireJobSlot(actor, ctx);
      expect(redis.incr).not.toHaveBeenCalled();
      await release();
    });
  });

  describe('consumeMessage', () => {
    const ctx = {
      plan: 'FREE' as const,
      limits: {} as any,
      features: {},
      scope: 'user:u1',
      unlimited: false,
    };

    it('increments daily counter and sets TTL on first message', async () => {
      (plans.limit as jest.Mock).mockReturnValue(15);
      (redis.incr as jest.Mock).mockResolvedValue(1);

      await service.consumeMessage(ctx);

      expect(redis.incr).toHaveBeenCalled();
      expect(redis.expire).toHaveBeenCalledWith(expect.stringContaining('ai:msgs:user:u1:'), 2 * 24 * 3600);
    });

    it('decrements and throws QUOTA_EXCEEDED when daily allowance is exceeded', async () => {
      (plans.limit as jest.Mock).mockReturnValue(15);
      (redis.incr as jest.Mock).mockResolvedValue(16);

      await expect(service.consumeMessage(ctx)).rejects.toThrow(ForbiddenException);
      expect(redis.decr).toHaveBeenCalled();
    });

    it('bypasses message consumption when limit is unlimited (-1)', async () => {
      (plans.limit as jest.Mock).mockReturnValue(-1);

      await service.consumeMessage(ctx);
      expect(redis.incr).not.toHaveBeenCalled();
    });
  });
});
