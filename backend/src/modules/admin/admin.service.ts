import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { Role } from '@prisma/client';
import { QuotaService } from '../billing/quota.service';
import { getEffectivePlanLimits, type PlanKey } from '../../config/plan-limits';
import { getPublicAppUrl } from '../../config/app-brand';

type InviteInput = {
  email?: string;
  name?: string;
  role?: string | Role;
  dept?: string;
  id?: string;
};

type InviteResult = {
  email: string;
  success: boolean;
  invited?: boolean;
  alreadyInvited?: boolean;
  role?: Role;
  name?: string | null;
  department?: string | null;
  rollNumber?: string | null;
  pendingInviteId?: string | null;
  error?: string;
  clerkInvitationId?: string | null;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly supabase: SupabaseService,
    private quotaService: QuotaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private getClerkClient(): ClerkClient {
    const secretKey = String(process.env.CLERK_SECRET_KEY || '').trim();
    if (!secretKey) {
      throw new InternalServerErrorException('Missing CLERK_SECRET_KEY');
    }

    return createClerkClient({ secretKey });
  }

  private getOrganizationInvitationUrl(orgDomain?: string | null): string {
    const fallbackBase = getPublicAppUrl().replace(/\/+$/, '');

    const rawOrgDomain = String(orgDomain || '')
      .trim()
      .replace(/\/+$/, '');
    if (!rawOrgDomain) return `${fallbackBase}/signup`;

    if (/^https?:\/\//i.test(rawOrgDomain)) {
      return `${rawOrgDomain}/signup`;
    }

    const protocol = rawOrgDomain.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${rawOrgDomain}/signup`;
  }

  private normalizeRole(role?: string | Role): Role {
    if (!role) return Role.STUDENT;
    const value = String(role).trim().toUpperCase();
    const normalized = (value === 'USER' ? Role.STUDENT : value) as Role;

    if (
      normalized !== Role.STUDENT &&
      normalized !== Role.TEACHER &&
      normalized !== Role.ADMIN
    ) {
      throw new BadRequestException('Invalid role');
    }

    return normalized;
  }

  private normalizeEmail(email?: string): string {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException('Email is required');
    }
    return normalized;
  }

  private sanitizeOptionalText(value?: string | null): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private getInviteExpiresAt(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  private buildInviteMetadata(params: {
    orgId: string;
    role: Role;
    name?: string | null;
    department?: string | null;
    rollNumber?: string | null;
    invitedById?: string | null;
  }) {
    return {
      appRole: params.role,
      orgId: params.orgId,
      name: params.name || undefined,
      department: params.department || undefined,
      rollNumber: params.rollNumber || undefined,
      invitedById: params.invitedById || undefined,
      source: 'mentrily_invite',
    };
  }

  private async revokeClerkInvitationIfPossible(
    clerkClient: ClerkClient,
    clerkInvitationId?: string | null,
  ): Promise<void> {
    if (!clerkInvitationId) return;

    try {
      await (clerkClient.invitations as any).revokeInvitation(
        clerkInvitationId,
      );
    } catch {
      try {
        await (clerkClient.invitations as any).revokeInvitation({
          invitationId: clerkInvitationId,
        });
      } catch {
        // The local invite is stale if Clerk already expired/revoked it.
      }
    }
  }

  private async enforceInviteQuota(
    org: any,
    role: Role,
    additional: number,
  ): Promise<void> {
    const orgId = String(org.id || '');
    if (!orgId || additional <= 0) return;

    if (role === Role.STUDENT) {
      await this.quotaService.checkStudentQuota(orgId, additional);
    } else if (role === Role.TEACHER) {
      await this.quotaService.checkTeacherSeatQuota(orgId, additional);
    } else if (role === Role.ADMIN) {
      await this.quotaService.checkAdminSeatQuota(orgId, additional);
      await this.enforceAdminSeatCap(orgId, org.maxAdminSeats, additional);
    }

    const pendingCount = await this.prisma.pendingInvite.count({
      where: {
        orgId,
        role,
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingCount <= 0) return;

    const limits = getEffectivePlanLimits(
      (org.plan as PlanKey) || 'FREE',
      org.features,
    );

    const currentAccepted = await this.prisma.user.count({
      where: { orgId, role },
    });

    if (
      role === Role.STUDENT &&
      limits.students !== -1 &&
      currentAccepted + pendingCount + additional > limits.students
    ) {
      throw new ForbiddenException({
        code: 'STUDENT_LIMIT_EXCEEDED',
        message: 'No available user seats on the current plan',
        upgradeUrl: '/dashboard/creator/billing',
      });
    }

    if (
      role === Role.TEACHER &&
      limits.teacherSeats !== -1 &&
      currentAccepted + pendingCount + additional > limits.teacherSeats
    ) {
      throw new ForbiddenException({
        code: 'TEACHER_SEAT_LIMIT_EXCEEDED',
        message: 'No available teacher seats on the current plan',
        upgradeUrl: '/dashboard/creator/billing',
      });
    }

    if (
      role === Role.ADMIN &&
      limits.adminSeats !== -1 &&
      currentAccepted + pendingCount + additional > limits.adminSeats
    ) {
      throw new ForbiddenException({
        code: 'ADMIN_SEAT_LIMIT_EXCEEDED',
        message: 'No available admin seats on the current plan',
        upgradeUrl: '/dashboard/creator/billing',
      });
    }
  }

  private async enforceAdminSeatCap(
    orgId: string,
    maxAdminSeats?: number | null,
    additional = 1,
  ): Promise<void> {
    const normalizedCap = Number(maxAdminSeats || 0);
    if (!Number.isFinite(normalizedCap) || normalizedCap <= 0) {
      return;
    }

    const currentAdmins = await this.prisma.user.count({
      where: { orgId, role: 'ADMIN' },
    });

    if (currentAdmins + additional > normalizedCap) {
      throw new ForbiddenException({
        code: 'ADMIN_SEAT_LIMIT_EXCEEDED',
        message: 'No available admin seats for this organization',
      });
    }
  }

  private getEffectiveOrgId(user: any, targetOrgId?: string): string {
    if (user.role === 'SUPER_ADMIN') {
      if (targetOrgId) return targetOrgId;
      if (user.orgId) return user.orgId;
      // If Super Admin and no targetOrgId, we might want to return null or throw depending on context.
      // But for these operations, we need an orgId.
      throw new BadRequestException(
        'Organization ID is required for Super Admin operations',
      );
    }

    if (!user.orgId)
      throw new ForbiddenException('Admin has no organization assigned');

    // Regular admin cannot impersonate
    if (targetOrgId && targetOrgId !== user.orgId) {
      throw new ForbiddenException('Cannot access another organization');
    }

    return user.orgId;
  }

  private async invalidateOrgFeatureCaches(orgId: string): Promise<void> {
    const directKeys = [
      `org:features:${orgId}`,
      `org:status:${orgId}`,
      `org:effective_features:${orgId}`,
      `admin:stats:${orgId}`,
    ];

    await this.redis.del(...directKeys);

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'user:session:*',
        'COUNT',
        200,
      );
      cursor = nextCursor;

      if (!keys || keys.length === 0) {
        continue;
      }

      const values = await this.redis.mget(keys);
      const keysToDelete: string[] = [];

      for (let index = 0; index < keys.length; index += 1) {
        const raw = values[index];
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          if (String(parsed?.orgId || '') === orgId) {
            keysToDelete.push(keys[index]);
          }
        } catch {
          continue;
        }
      }

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } while (cursor !== '0');
  }

  async getOrganizationSettings(user?: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        domain: true,
        contact: true,
        features: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async updateOrganizationSettings(
    user: any,
    data: { features?: Record<string, unknown> },
    targetOrgId?: string,
  ) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        features: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const currentFeatures =
      org.features &&
      typeof org.features === 'object' &&
      !Array.isArray(org.features)
        ? (org.features as Record<string, unknown>)
        : {};

    const incomingFeatures =
      data?.features &&
      typeof data.features === 'object' &&
      !Array.isArray(data.features)
        ? data.features
        : {};

    const nextFeatures = {
      ...currentFeatures,
      ...incomingFeatures,
    };

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        features: nextFeatures as any,
      },
      select: {
        id: true,
        name: true,
        domain: true,
        contact: true,
        features: true,
      },
    });

    await this.invalidateOrgFeatureCaches(orgId);

    return updated;
  }

  async getGlobalStats(user?: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);

    // CACHE
    const cacheKey = `admin:stats:${orgId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [
      totalUsers,
      totalEnrolledStudents,
      totalExams,
      totalCourses,
      activeSessions,
      courseProgressAgg,
      examScoreAgg,
    ] = await Promise.all([
      this.prisma.user.count({ where: { orgId } }),
      this.prisma.user.count({ where: { orgId, role: 'STUDENT' } }),
      this.prisma.exam.count({ where: { orgId } }),
      this.prisma.course.count({ where: { orgId } }),
      this.prisma.examSession.count({
        where: {
          status: 'IN_PROGRESS',
          exam: { orgId }, // Filter sessions by exams belonging to this org
        },
      }),
      this.prisma.courseProgress.aggregate({
        _avg: { percent: true },
        where: {
          course: { orgId },
        },
      }),
      this.prisma.examSession.aggregate({
        _avg: { score: true },
        where: {
          exam: { orgId },
          status: 'COMPLETED',
          score: { not: null },
        },
      }),
    ]);

    const averageCourseCompletionPercent = Number(
      courseProgressAgg._avg.percent ?? 0,
    );
    const averageExamScore = Number(examScoreAgg._avg.score ?? 0);
    const generatedAt = new Date().toISOString();

    const stats = {
      totalUsers,
      totalEnrolledStudents,
      totalExams,
      totalCourses,
      activeSessions,
      averageCourseCompletionPercent,
      averageExamScore,
      generatedAt,
      systemHealth: 'Healthy',
    };

    // Cache for 60s
    await this.redis.set(cacheKey, JSON.stringify(stats), 'EX', 60);

    return stats;
  }

  async getUsers(user?: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);
    const [users, pendingInvites] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { orgId },
            {
              role: 'STUDENT',
              courses: { some: { orgId } },
            },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          rollNumber: true,
          department: true,
          createdAt: true,
          orgId: true,
        },
      }),
      this.prisma.pendingInvite.findMany({
        where: { orgId, expiresAt: { gt: new Date() } },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          rollNumber: true,
          department: true,
          createdAt: true,
          expiresAt: true,
          orgId: true,
          clerkInvitationId: true,
        },
      }),
    ]);

    const invitedEmails = new Set(users.map((item) => item.email));
    const pendingRows = pendingInvites
      .filter((invite) => !invitedEmails.has(invite.email))
      .map((invite) => ({
        id: `pending-invite:${invite.id}`,
        pendingInviteId: invite.id,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        isActive: null,
        isPendingInvite: true,
        accountStatus: 'PENDING_INVITE',
        rollNumber: invite.rollNumber,
        department: invite.department,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        orgId: invite.orgId,
        clerkInvitationId: invite.clerkInvitationId,
      }));

    return [...users, ...pendingRows].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
  }

  async getSystemLogs(user?: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);
    // Only show logs for users in this org
    return this.prisma.auditLog.findMany({
      where: { user: { orgId } },
      take: 20,
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { name: true, email: true, role: true } } },
    });
  }

  async getAnalytics(user?: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);

    // CACHE
    const cacheKey = `admin:analytics:${orgId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Fetch session counts for the last 7 days matched to Org's exams
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const activityData = await Promise.all(
      last7Days.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const count = await this.prisma.examSession.count({
          where: {
            startTime: {
              gte: date,
              lt: nextDay,
            },
            exam: { orgId }, // ISOLATION
          },
        });
        return count;
      }),
    );

    const dayLabels = last7Days.map((d) =>
      d.toLocaleDateString('en-US', { weekday: 'short' }),
    );

    const totalRegistrations = await this.prisma.user.count({
      where: {
        orgId: orgId, // ISOLATION
        createdAt: {
          gte: last7Days[0],
        },
      },
    });

    const totalAttempts = await this.prisma.examSession.count({
      where: {
        exam: { orgId }, // ISOLATION
        startTime: {
          gte: last7Days[0],
        },
      },
    });

    const analytics = {
      activity: activityData,
      labels: dayLabels,
      registrations: totalRegistrations,
      attempts: totalAttempts,
    };

    // Cache for 5 minutes
    await this.redis.set(cacheKey, JSON.stringify(analytics), 'EX', 300);

    return analytics;
  }

  async getExams(user?: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);
    return this.prisma.exam.findMany({
      where: { orgId }, // ISOLATION
      include: {
        _count: {
          select: { submissions: true },
        },
        creator: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCourses(user?: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);
    return this.prisma.course.findMany({
      where: { orgId }, // ISOLATION
      include: {
        _count: {
          select: { modules: true, students: true },
        },
        creator: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOnboardingStatus(user?: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);

    const [
      org,
      courseCount,
      studentCount,
      examCount,
      completedExamSessionCount,
    ] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          logo: true,
          createdAt: true,
        },
      }),
      this.prisma.course.count({
        where: { orgId, NOT: { status: 'Archived' } },
      }),
      this.prisma.user.count({ where: { orgId, role: 'STUDENT' } }),
      this.prisma.exam.count({ where: { orgId } }),
      this.prisma.examSession.count({
        where: {
          status: 'COMPLETED',
          exam: { orgId },
        },
      }),
    ]);

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const steps = [
      {
        id: 'school-name',
        title: 'Create your school name',
        href: '/dashboard/creator/settings',
        completed: Boolean(String(org.name || '').trim()),
      },
      {
        id: 'logo',
        title: 'Upload your school logo',
        href: '/dashboard/creator/settings',
        completed: Boolean(String(org.logo || '').trim()),
      },
      {
        id: 'course',
        title: 'Create your first course',
        href: '/dashboard/creator/courses/create',
        completed: courseCount > 0,
      },
      {
        id: 'students',
        title: 'Add your first 5 students',
        href: '/dashboard/creator/users',
        completed: studentCount >= 5,
      },
      {
        id: 'exam',
        title: 'Create your first exam',
        href: '/dashboard/creator/exams/new',
        completed: examCount > 0,
      },
      {
        id: 'completed-exam',
        title: 'Have a student complete an exam',
        href: '/dashboard/creator/exams',
        completed: completedExamSessionCount > 0,
      },
    ];

    const completedCount = steps.filter((step) => step.completed).length;

    return {
      orgId,
      createdAt: org.createdAt,
      completedCount,
      totalSteps: steps.length,
      percent: Math.round((completedCount / steps.length) * 100),
      steps,
    };
  }

  async toggleUserStatus(id: string, caller: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Enforce org isolation
    if (caller.role !== 'SUPER_ADMIN' && user.orgId !== caller.orgId) {
      throw new UnauthorizedException(
        'Cannot modify a user outside of your organization',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });
  }

  async createUser(data: InviteInput, currentUser?: any, targetOrgId?: string) {
    return this.inviteUser(data, currentUser, targetOrgId);
  }

  async createUsersBulk(
    users: InviteInput[],
    currentUser?: any,
    targetOrgId?: string,
  ) {
    return this.inviteUsersBulk(users, currentUser, targetOrgId);
  }

  async inviteUser(data: InviteInput, currentUser?: any, targetOrgId?: string) {
    const result = await this.createInvite(data, currentUser, targetOrgId);
    if (!result.success && result.error) {
      if (result.error === 'User with this email already exists') {
        throw new ConflictException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    return {
      invited: result.invited === true,
      alreadyInvited: result.alreadyInvited === true,
      email: result.email,
      role: result.role,
      clerkInvitationId: result.clerkInvitationId,
    };
  }

  async inviteUsersBulk(
    users: InviteInput[],
    currentUser?: any,
    targetOrgId?: string,
  ) {
    const results: InviteResult[] = [];
    const seen = new Set<string>();

    for (const item of users || []) {
      let email = '';
      try {
        email = this.normalizeEmail(item.email);
      } catch {
        results.push({
          email: String(item?.email || ''),
          success: false,
          error: 'Invalid or missing email',
        });
        continue;
      }

      if (seen.has(email)) {
        results.push({
          email,
          success: false,
          error: 'Duplicate email in CSV',
        });
        continue;
      }
      seen.add(email);

      try {
        results.push(await this.createInvite(item, currentUser, targetOrgId));
      } catch (error: any) {
        results.push({
          email,
          success: false,
          error:
            typeof error?.response?.message === 'string'
              ? error.response.message
              : error?.message || 'Failed to send Clerk invitation',
        });
      }
    }

    const invited = results.filter((item) => item.invited).length;
    const alreadyInvited = results.filter((item) => item.alreadyInvited).length;
    const failed = results.filter((item) => !item.success).length;

    return {
      summary: {
        totalProcessed: results.length,
        invited,
        alreadyInvited,
        created: invited + alreadyInvited,
        failed,
        emailsSent: invited,
        emailsFailed: failed,
      },
      details: results,
    };
  }

  private async createInvite(
    data: InviteInput,
    currentUser?: any,
    targetOrgId?: string,
  ): Promise<InviteResult> {
    const orgId = this.getEffectiveOrgId(currentUser, targetOrgId);
    const role = this.normalizeRole(data.role);
    const email = this.normalizeEmail(data.email);
    const name = this.sanitizeOptionalText(data.name);
    const department = this.sanitizeOptionalText(data.dept);
    const rollNumber = this.sanitizeOptionalText(data.id);
    const clerkClient = this.getClerkClient();

    const org: any = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        plan: true,
        features: true,
        domain: true,
        maxUsers: true,
        maxAdminSeats: true,
        _count: { select: { users: true } },
      } as any,
    });

    if (!org) throw new NotFoundException('Organization not found');

    const activePendingInviteCount = await this.prisma.pendingInvite.count({
      where: { orgId, expiresAt: { gt: new Date() } },
    });

    if (org._count.users + activePendingInviteCount >= org.maxUsers) {
      throw new BadRequestException(
        'Organization user limit reached. Upgrade plan to add more users.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, orgId: true },
    });
    if (existingUser) {
      // A person already having an account elsewhere no longer blocks the
      // invite outright — they can join a second org without losing their
      // first. Only block if they're already a member of *this* org.
      const alreadyMember =
        existingUser.orgId === orgId ||
        (await this.prisma.orgMembership.findUnique({
          where: { userId_orgId: { userId: existingUser.id, orgId } },
          select: { id: true },
        }));
      if (alreadyMember) {
        throw new ConflictException(
          'This user is already a member of this organization',
        );
      }
    }

    const existingInvite = await this.prisma.pendingInvite.findUnique({
      where: { email_orgId: { email, orgId } },
    });
    if (existingInvite && existingInvite.expiresAt > new Date()) {
      return {
        email,
        success: true,
        alreadyInvited: true,
        role: existingInvite.role,
        name: existingInvite.name,
        department: existingInvite.department,
        rollNumber: existingInvite.rollNumber,
        pendingInviteId: existingInvite.id,
        clerkInvitationId: existingInvite.clerkInvitationId,
      };
    }

    if (existingInvite) {
      await this.revokeClerkInvitationIfPossible(
        clerkClient,
        existingInvite.clerkInvitationId,
      );
      await this.prisma.pendingInvite.delete({
        where: { id: existingInvite.id },
      });
    }

    await this.enforceInviteQuota(org, role, 1);

    const expiresAt = this.getInviteExpiresAt();
    const pendingInvite = await this.prisma.pendingInvite.create({
      data: {
        email,
        role,
        orgId,
        name,
        department,
        rollNumber,
        expiresAt,
      } as any,
    });

    try {
      const invitation = await clerkClient.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: this.getOrganizationInvitationUrl(org.domain),
        notify: true,
        ignoreExisting: true,
        expiresInDays: 7,
        publicMetadata: this.buildInviteMetadata({
          orgId,
          role,
          name,
          department,
          rollNumber,
          invitedById: currentUser?.id,
        }),
      } as any);

      await this.prisma.pendingInvite.update({
        where: { id: pendingInvite.id },
        data: { clerkInvitationId: invitation.id },
      });

      return {
        email,
        success: true,
        invited: true,
        role,
        name,
        department,
        rollNumber,
        pendingInviteId: pendingInvite.id,
        clerkInvitationId: invitation.id,
      };
    } catch (error: any) {
      await this.prisma.pendingInvite.delete({
        where: { id: pendingInvite.id },
      });

      throw new BadRequestException(
        error?.errors?.[0]?.longMessage ||
          error?.errors?.[0]?.message ||
          error?.message ||
          'Failed to send Clerk invitation',
      );
    }
  }

  async getCourseAssignments(
    courseId: string,
    caller: any,
    targetOrgId?: string,
  ) {
    const orgId = this.getEffectiveOrgId(caller, targetOrgId);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, orgId },
      select: { id: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.courseAssignment.findMany({
      where: { courseId },
      include: {
        teacher: {
          select: { id: true, email: true, name: true },
        },
        assignedBy: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignTeacherToCourse(
    courseId: string,
    teacherId: string,
    caller: any,
    targetOrgId?: string,
  ) {
    const orgId = this.getEffectiveOrgId(caller, targetOrgId);
    const [course, teacher] = await Promise.all([
      this.prisma.course.findFirst({
        where: { id: courseId, orgId },
        select: { id: true, orgId: true },
      }),
      this.prisma.user.findFirst({
        where: { id: teacherId, orgId, role: 'TEACHER' },
        select: { id: true },
      }),
    ]);

    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return this.prisma.courseAssignment.upsert({
      where: {
        courseId_teacherId: {
          courseId,
          teacherId,
        },
      },
      update: {},
      create: {
        courseId,
        teacherId,
        assignedById: caller.id,
      },
    });
  }

  async removeTeacherFromCourse(
    courseId: string,
    teacherId: string,
    caller: any,
    targetOrgId?: string,
  ) {
    const orgId = this.getEffectiveOrgId(caller, targetOrgId);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, orgId },
      select: { id: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    await this.prisma.courseAssignment.deleteMany({
      where: { courseId, teacherId },
    });

    return { removed: true };
  }

  async deleteUser(id: string, caller: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const orgId = user.orgId;

    // Enforce org isolation
    if (caller.role !== 'SUPER_ADMIN' && user.orgId !== caller.orgId) {
      throw new UnauthorizedException(
        'Cannot delete a user outside of your organization',
      );
    }

    console.log('[AdminService] Starting deletion for user:', id);
    try {
      const auditLogResult = await this.prisma.auditLog.deleteMany({
        where: { userId: id },
      });
      console.log('[AdminService] Deleted audit logs:', auditLogResult.count);

      const userResult = await this.prisma.user.delete({
        where: { id },
      });

      if (orgId && user.role === Role.STUDENT) {
        await this.quotaService.decrementCounter(orgId, 'studentCount', 1);
      } else if (
        orgId &&
        (user.role === Role.ADMIN || user.role === Role.TEACHER)
      ) {
        await this.quotaService.decrementCounter(orgId, 'teacherSeatCount', 1);
      }

      console.log('[AdminService] User deleted successfully');
      return userResult;
    } catch (error: any) {
      console.error('[AdminService] Deletion error:', error);
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw new BadRequestException(error.message || 'Failed to delete user');
    }
  }
}
