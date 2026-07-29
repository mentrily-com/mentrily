import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import {
  PLAN_FEATURES,
  PlanKey,
  getEffectivePlanLimits,
  getRequiredPlanForFeature,
} from '../../config/plan-limits';
import { AlertService } from './alert.service';
import { Role } from '@prisma/client';

type CounterField =
  'studentCount' | 'courseCount' | 'storageUsedMb' | 'teacherSeatCount';

type OrgPlanShape = {
  plan: PlanKey;
  features: unknown;
};

@Injectable()
export class QuotaService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly alertService: AlertService,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private throwQuotaExceeded(
    resource: string,
    current: number,
    limit: number,
  ): never {
    throw new ForbiddenException({
      code: 'QUOTA_EXCEEDED',
      resource,
      current,
      limit,
      upgradeUrl: '/dashboard/creator/billing',
    });
  }

  /**
   * Seat holders for a role in an org are no longer just User.orgId/role —
   * a Learner can hold an ADDITIVE Teacher/Admin persona (a second-org
   * OrgMembership) without their flat User row ever pointing at this org.
   * Counting only the flat column undercounts (always reads toward 0 for
   * additive personas), which would let seat limits be bypassed. Counts the
   * union of both sources, deduped by user id, so a legacy home-org holder
   * and an additive-persona holder are never double counted.
   */
  private async countSeatHolders(
    orgId: string,
    roles: Role[],
  ): Promise<number> {
    const [flatUsers, memberships] = await Promise.all([
      this.prisma.user.findMany({
        where: { orgId, role: { in: roles } },
        select: { id: true },
      }),
      this.prisma.orgMembership.findMany({
        where: { orgId, role: { in: roles }, status: 'ACTIVE' },
        select: { userId: true },
      }),
    ]);

    const ids = new Set<string>();
    flatUsers.forEach((u) => ids.add(u.id));
    memberships.forEach((m) => ids.add(m.userId));
    return ids.size;
  }

  private getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private async getOrgPlan(orgId: string): Promise<OrgPlanShape> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, features: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return {
      plan: org.plan || 'FREE',
      features: org.features,
    };
  }

  private async getLimitsForOrg(orgId: string) {
    const org = await this.getOrgPlan(orgId);
    return getEffectivePlanLimits(org.plan, org.features);
  }

  private getPlanDefaults(plan: PlanKey = 'FREE') {
    return {
      plan,
      features: PLAN_FEATURES[plan] || PLAN_FEATURES.FREE,
      limits: getEffectivePlanLimits(plan),
    };
  }

  async getEffectiveFeatures(
    orgId?: string | null,
  ): Promise<Record<string, boolean>> {
    if (!orgId) {
      return this.getPlanDefaults('FREE').features;
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, features: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const plan = org.plan || 'FREE';
    const baseFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.FREE;
    const overrides =
      org.features &&
      typeof org.features === 'object' &&
      !Array.isArray(org.features)
        ? (org.features as Record<string, boolean>)
        : {};

    return {
      ...baseFeatures,
      ...overrides,
    };
  }

  async ensureFeatureEnabled(
    orgId: string | null | undefined,
    feature: string,
  ): Promise<void> {
    const effective = await this.getEffectiveFeatures(orgId);
    if (effective[feature] === true) {
      return;
    }

    throw new ForbiddenException({
      code: 'PLAN_FEATURE_REQUIRED',
      feature,
      requiredPlan: getRequiredPlanForFeature(feature),
      upgradeUrl: '/dashboard/creator/billing',
    });
  }

  async checkStudentQuota(orgId: string, additional = 1): Promise<void> {
    const [limits, accepted, pending] = await Promise.all([
      this.getLimitsForOrg(orgId),
      this.countSeatHolders(orgId, ['STUDENT']),
      this.prisma.pendingInvite.count({
        where: { orgId, role: 'STUDENT', expiresAt: { gt: new Date() } },
      }),
    ]);

    const current = accepted + pending;
    if (limits.students !== -1 && current + additional > limits.students) {
      this.throwQuotaExceeded('students', current, limits.students);
    }
  }

  async checkStudentQuotaForUser(
    userId: string,
    additional = 1,
  ): Promise<void> {
    const limits = this.getPlanDefaults('FREE').limits;
    const current = await this.prisma.user.count({
      where: {
        role: 'STUDENT',
        courses: {
          some: {
            creatorId: userId,
            orgId: null,
            NOT: { status: 'Archived' },
          },
        },
      },
    });

    if (limits.students !== -1 && current + additional > limits.students) {
      this.throwQuotaExceeded('students', current, limits.students);
    }
  }

  async checkCourseQuota(orgId: string, additional = 1): Promise<void> {
    const [limits, current] = await Promise.all([
      this.getLimitsForOrg(orgId),
      this.prisma.course.count({
        where: {
          orgId,
          NOT: { status: 'Archived' },
        },
      }),
    ]);

    if (limits.courses !== -1 && current + additional > limits.courses) {
      this.throwQuotaExceeded('courses', current, limits.courses);
    }
  }

  async checkCourseQuotaForUser(userId: string, additional = 1): Promise<void> {
    const limits = this.getPlanDefaults('FREE').limits;
    const current = await this.prisma.course.count({
      where: {
        creatorId: userId,
        orgId: null,
        NOT: { status: 'Archived' },
      },
    });

    if (limits.courses !== -1 && current + additional > limits.courses) {
      this.throwQuotaExceeded('courses', current, limits.courses);
    }
  }

  async checkStorageQuota(orgId: string, additionalMb: number): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, features: true, storageUsedMb: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const limit = getEffectivePlanLimits(
      org.plan || 'FREE',
      org.features,
    ).storageMb;
    const current = Number(org.storageUsedMb || 0);
    if (limit !== -1 && current + additionalMb > limit) {
      this.throwQuotaExceeded('storageMb', current, limit);
    }
  }

  async checkAdminSeatQuota(orgId: string, additional = 1): Promise<void> {
    const [limits, accepted, pending] = await Promise.all([
      this.getLimitsForOrg(orgId),
      this.countSeatHolders(orgId, ['ADMIN']),
      this.prisma.pendingInvite.count({
        where: { orgId, role: 'ADMIN', expiresAt: { gt: new Date() } },
      }),
    ]);

    const current = accepted + pending;
    if (limits.adminSeats !== -1 && current + additional > limits.adminSeats) {
      this.throwQuotaExceeded('adminSeats', current, limits.adminSeats);
    }
  }

  async checkTeacherSeatQuota(orgId: string, additional = 1): Promise<void> {
    const [limits, accepted, pending] = await Promise.all([
      this.getLimitsForOrg(orgId),
      this.countSeatHolders(orgId, ['TEACHER']),
      this.prisma.pendingInvite.count({
        where: { orgId, role: 'TEACHER', expiresAt: { gt: new Date() } },
      }),
    ]);

    const current = accepted + pending;
    if (
      limits.teacherSeats !== -1 &&
      current + additional > limits.teacherSeats
    ) {
      this.throwQuotaExceeded('teacherSeats', current, limits.teacherSeats);
    }
  }

  async checkSeatQuota(orgId: string, additional = 1): Promise<void> {
    const [limits, accepted, pending] = await Promise.all([
      this.getLimitsForOrg(orgId),
      this.countSeatHolders(orgId, ['ADMIN', 'TEACHER']),
      this.prisma.pendingInvite.count({
        where: {
          orgId,
          role: { in: ['ADMIN', 'TEACHER'] },
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    const current = accepted + pending;
    if (limits.seats !== -1 && current + additional > limits.seats) {
      this.throwQuotaExceeded('seats', current, limits.seats);
    }
  }

  async checkMonthlyExamQuota(input: {
    orgId?: string | null;
    userId?: string | null;
    additional?: number;
  }): Promise<void> {
    const additional = Number(input.additional || 1);
    const monthStart = this.getMonthStart();

    if (input.orgId) {
      const limits = await this.getLimitsForOrg(input.orgId);
      if (limits.examsPerMonth === -1) return;

      const current = await this.prisma.usageLedger.count({
        where: {
          orgId: input.orgId,
          eventType: 'exam.created',
          createdAt: { gte: monthStart },
        },
      });

      if (current + additional > limits.examsPerMonth) {
        this.throwQuotaExceeded('examsPerMonth', current, limits.examsPerMonth);
      }

      return;
    }

    if (!input.userId) {
      throw new NotFoundException('User context required');
    }

    const limits = this.getPlanDefaults('FREE').limits;
    if (limits.examsPerMonth === -1) return;

    const current = await this.prisma.exam.count({
      where: {
        creatorId: input.userId,
        orgId: null,
        createdAt: { gte: monthStart },
      },
    });

    if (current + additional > limits.examsPerMonth) {
      this.throwQuotaExceeded('examsPerMonth', current, limits.examsPerMonth);
    }
  }

  async recordExamCreated(input: {
    orgId?: string | null;
    userId?: string | null;
    examId: string;
  }): Promise<void> {
    if (!input.orgId) {
      return;
    }

    await this.prisma.usageLedger.create({
      data: {
        orgId: input.orgId,
        eventType: 'exam.created',
        valueNum: 1,
        meta: {
          examId: input.examId,
          userId: input.userId || null,
        } as any,
      },
    });
  }

  async checkExamQuota(
    orgId: string,
    courseId?: string,
    additional = 1,
  ): Promise<void> {
    const limits = await this.getLimitsForOrg(orgId);
    if (limits.examsPerCourse === -1) return;

    let current = 0;
    if (courseId) {
      current = await this.prisma.courseTest.count({
        where: { courseId, orgId },
      });
    } else {
      current = await this.prisma.exam.count({ where: { orgId } });
    }

    if (current + additional > limits.examsPerCourse) {
      this.throwQuotaExceeded('examsPerCourse', current, limits.examsPerCourse);
    }
  }

  async checkModuleQuota(
    orgId: string,
    courseId?: string,
    additional = 0,
  ): Promise<void> {
    const limits = await this.getLimitsForOrg(orgId);
    if (limits.modulesPerCourse === -1) return;

    const current = courseId
      ? await this.prisma.courseModule.count({
          where: { courseId, course: { orgId } },
        })
      : 0;

    if (current + additional > limits.modulesPerCourse) {
      this.throwQuotaExceeded(
        'modulesPerCourse',
        current,
        limits.modulesPerCourse,
      );
    }
  }

  async checkQuestionTypeAllowed(input: {
    orgId?: string | null;
    plan?: PlanKey;
    rawFeatures?: unknown;
    types: string[];
  }): Promise<void> {
    const normalizedTypes = Array.from(
      new Set(
        (input.types || [])
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    if (normalizedTypes.length === 0) {
      return;
    }

    const limits = input.orgId
      ? await this.getLimitsForOrg(input.orgId)
      : getEffectivePlanLimits(input.plan || 'FREE', input.rawFeatures);

    if (limits.allowedQuestionTypes.includes('*')) {
      return;
    }

    const deniedType = normalizedTypes.find(
      (type) => !limits.allowedQuestionTypes.includes(type),
    );
    if (!deniedType) {
      return;
    }

    throw new ForbiddenException({
      code: 'PLAN_FEATURE_REQUIRED',
      feature: `questionType:${deniedType}`,
      requiredPlan: 'STARTER',
      upgradeUrl: '/dashboard/creator/billing',
    });
  }

  async incrementCounter(
    orgId: string | null | undefined,
    field: CounterField,
    amount: number,
  ): Promise<void> {
    if (!orgId || !amount) return;

    const { error } = await (this.supabase.client as any).rpc(
      'adjust_org_counter',
      {
        p_org_id: orgId,
        p_field: field,
        p_delta: amount,
      },
    );

    if (error) {
      throw new NotFoundException(
        error.message || 'Failed to increment organization counter',
      );
    }

    if (field === 'storageUsedMb') {
      await this.alertService.checkStorageAlert(orgId);
    }

    if (field === 'studentCount') {
      await this.alertService.checkStudentAlert(orgId);
    }
  }

  async decrementCounter(
    orgId: string | null | undefined,
    field: CounterField,
    amount: number,
  ): Promise<void> {
    if (!orgId || !amount) return;

    const { error } = await (this.supabase.client as any).rpc(
      'adjust_org_counter',
      {
        p_org_id: orgId,
        p_field: field,
        p_delta: -Math.abs(amount),
      },
    );

    if (error) {
      throw new NotFoundException(
        error.message || 'Failed to decrement organization counter',
      );
    }
  }

  async recalculateCounters(orgId: string | null | undefined): Promise<void> {
    if (!orgId) return;

    const [studentCount, teacherSeatCount, courseCount, org] =
      await Promise.all([
        this.prisma.user.count({
          where: {
            role: 'STUDENT',
            OR: [{ orgId }, { courses: { some: { orgId } } }],
          },
        }),
        this.prisma.user.count({
          where: { orgId, role: { in: ['ADMIN', 'TEACHER'] } },
        }),
        this.prisma.course.count({
          where: { orgId, NOT: { status: 'Archived' } },
        }),
        this.prisma.organization.findUnique({
          where: { id: orgId },
          select: { storageUsedMb: true },
        }),
      ]);

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        studentCount,
        teacherSeatCount,
        courseCount,
        storageUsedMb: Number(org?.storageUsedMb || 0),
      },
    });
  }

  async getPersonalUsage(userId: string) {
    const monthStart = this.getMonthStart();
    const [students, courses, monthlyExams] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: 'STUDENT',
          courses: {
            some: {
              creatorId: userId,
              orgId: null,
              NOT: { status: 'Archived' },
            },
          },
        },
      }),
      this.prisma.course.count({
        where: {
          creatorId: userId,
          orgId: null,
          NOT: { status: 'Archived' },
        },
      }),
      this.prisma.exam.count({
        where: {
          creatorId: userId,
          orgId: null,
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    return {
      students,
      courses,
      storageMb: 0,
      seats: 1,
      adminSeats: 0,
      teacherSeats: 0,
      monthlyExams,
    };
  }
}
