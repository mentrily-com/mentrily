import { ForbiddenException } from '@nestjs/common';
import { AiPlanService } from './ai-plan.service';
import { PrismaService } from '../../../services/prisma/prisma.service';
import Redis from 'ioredis';

describe('AiPlanService', () => {
  let service: AiPlanService;
  let prisma: Partial<PrismaService>;
  let redis: Partial<Redis>;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      } as any,
      organization: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      } as any,
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new AiPlanService(prisma as PrismaService, redis as Redis);
  });

  describe('resolve', () => {
    it('resolves organization directly if actor has orgId', async () => {
      (prisma.organization!.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-1',
        plan: 'PRO',
        planStatus: 'ACTIVE',
        planExpiresAt: null,
        features: null,
      });

      const ctx = await service.resolve({
        userId: 'user-1',
        orgId: 'org-1',
        role: 'TEACHER',
      });

      expect(ctx.plan).toBe('PRO');
      expect(ctx.scope).toBe('org:org-1');
      expect(ctx.limits.aiCreditsPerMonth).toBe(8000);
      expect(ctx.features.aiProTier).toBe(true);
      expect(ctx.unlimited).toBe(false);
    });

    it('resolves home org if actor.orgId is missing but user has orgId in DB', async () => {
      (prisma.user!.findUnique as jest.Mock).mockResolvedValue({
        orgId: 'home-org-123',
        lastActiveOrgId: null,
      });
      (prisma.organization!.findUnique as jest.Mock).mockResolvedValue({
        id: 'home-org-123',
        plan: 'STARTER',
        planStatus: 'ACTIVE',
        planExpiresAt: null,
        features: null,
      });

      const ctx = await service.resolve({
        userId: 'user-1',
        orgId: null,
        role: 'TEACHER',
      });

      expect(ctx.plan).toBe('STARTER');
      expect(ctx.scope).toBe('org:home-org-123');
      expect(ctx.limits.aiCreditsPerMonth).toBe(2500);
      expect(ctx.features.aiExams).toBe(true);
    });

    it('resolves personal school if user has provisionedFromUserId org', async () => {
      (prisma.user!.findUnique as jest.Mock).mockResolvedValue({
        orgId: null,
        lastActiveOrgId: null,
      });
      (prisma.organization!.findFirst as jest.Mock).mockResolvedValue({
        id: 'personal-org-456',
      });
      (prisma.organization!.findUnique as jest.Mock).mockResolvedValue({
        id: 'personal-org-456',
        plan: 'PRO',
        planStatus: 'ACTIVE',
        planExpiresAt: null,
        features: null,
      });

      const ctx = await service.resolve({
        userId: 'solo-creator-1',
        orgId: null,
        role: 'TEACHER',
      });

      expect(ctx.plan).toBe('PRO');
      expect(ctx.scope).toBe('org:personal-org-456');
    });

    it('falls back to FREE plan if user is truly org-less', async () => {
      (prisma.user!.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization!.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = await service.resolve({
        userId: 'student-99',
        orgId: null,
        role: 'STUDENT',
      });

      expect(ctx.plan).toBe('FREE');
      expect(ctx.scope).toBe('user:student-99');
      expect(ctx.limits.aiCreditsPerMonth).toBe(100);
      expect(ctx.features.aiExams).toBe(false);
      expect(ctx.unlimited).toBe(false);
    });

    it('marks SUPER_ADMIN as unlimited even without org', async () => {
      (prisma.user!.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization!.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = await service.resolve({
        userId: 'admin-1',
        orgId: null,
        role: 'SUPER_ADMIN',
      });

      expect(ctx.unlimited).toBe(true);
      expect(service.limit(ctx, 'aiCreditsPerMonth')).toBe(-1);
    });

    it('falls back to FREE when organization plan is CANCELED or expired', async () => {
      (prisma.organization!.findUnique as jest.Mock).mockResolvedValue({
        id: 'org-canceled',
        plan: 'PRO',
        planStatus: 'CANCELED',
        planExpiresAt: null,
        features: null,
      });

      const ctx = await service.resolve({
        userId: 'user-2',
        orgId: 'org-canceled',
        role: 'TEACHER',
      });

      expect(ctx.plan).toBe('FREE');
      expect(ctx.limits.aiCreditsPerMonth).toBe(100);
      expect(ctx.features.aiProTier).toBe(false);
    });

    it('uses cached plan from Redis when available', async () => {
      (redis.get as jest.Mock).mockResolvedValue(
        JSON.stringify({ plan: 'ENTERPRISE', features: null }),
      );

      const ctx = await service.resolve({
        userId: 'user-3',
        orgId: 'org-cached',
        role: 'TEACHER',
      });

      expect(prisma.organization!.findUnique).not.toHaveBeenCalled();
      expect(ctx.plan).toBe('ENTERPRISE');
      expect(ctx.limits.aiCreditsPerMonth).toBe(30000);
    });
  });

  describe('feature and tier asserts', () => {
    it('assertFeature throws ForbiddenException with upgrade metadata when missing', () => {
      const ctx = {
        plan: 'FREE' as const,
        limits: {} as any,
        features: { aiStudio: true, aiExams: false },
        scope: 'org:1',
        unlimited: false,
      };

      expect(() => service.assertFeature(ctx, 'aiExams')).toThrow(ForbiddenException);
    });

    it('assertFeature passes when feature is true or unlimited', () => {
      const ctx = {
        plan: 'STARTER' as const,
        limits: {} as any,
        features: { aiStudio: true, aiExams: true },
        scope: 'org:1',
        unlimited: false,
      };

      expect(() => service.assertFeature(ctx, 'aiExams')).not.toThrow();
    });

    it('downgrades pro tier to standard if aiProTier is not enabled', () => {
      const ctx = {
        plan: 'STARTER' as const,
        limits: {} as any,
        features: { aiStudio: true, aiExams: true, aiProTier: false },
        scope: 'org:1',
        unlimited: false,
      };

      expect(service.effectiveTier(ctx, 'pro')).toBe('standard');
      expect(service.effectiveTier(ctx, 'standard')).toBe('standard');
    });

    it('allows pro tier if aiProTier is enabled', () => {
      const ctx = {
        plan: 'PRO' as const,
        limits: {} as any,
        features: { aiStudio: true, aiExams: true, aiProTier: true },
        scope: 'org:1',
        unlimited: false,
      };

      expect(service.effectiveTier(ctx, 'pro')).toBe('pro');
    });
  });
});
