import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { Role } from '@prisma/client';
import { QuotaService } from '../billing/quota.service';
import { MailService } from '../../services/mail.service';
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
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private quotaService: QuotaService,
    private readonly mailService: MailService,
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

    const currentAccepted = await this.countSeatHolders(orgId, role);

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

  /**
   * A seat holder for a role in an org is no longer just User.orgId/role —
   * a Learner can hold an ADDITIVE Teacher/Admin persona (a second-org
   * OrgMembership) without their flat User row ever pointing at this org.
   * Counting only the flat column undercounts (always reads toward 0 for
   * additive personas), which would let seat caps be bypassed. Unions both
   * sources, deduped by user id, so a legacy home-org holder and an
   * additive-persona holder are never double counted. Mirrors
   * QuotaService.countSeatHolders.
   */
  private async countSeatHolders(orgId: string, role: Role): Promise<number> {
    const [flatUsers, memberships] = await Promise.all([
      this.prisma.user.findMany({
        where: { orgId, role },
        select: { id: true },
      }),
      this.prisma.orgMembership.findMany({
        where: { orgId, role, status: 'ACTIVE' },
        select: { userId: true },
      }),
    ]);

    const ids = new Set<string>();
    flatUsers.forEach((u) => ids.add(u.id));
    memberships.forEach((m) => ids.add(m.userId));
    return ids.size;
  }

  /** Same union-count principle as countSeatHolders, but headcount across
   * every role — used for the org-wide maxUsers cap. */
  private async countOrgMemberCount(orgId: string): Promise<number> {
    const [flatUsers, memberships] = await Promise.all([
      this.prisma.user.findMany({
        where: { orgId },
        select: { id: true },
      }),
      this.prisma.orgMembership.findMany({
        where: { orgId, status: 'ACTIVE' },
        select: { userId: true },
      }),
    ]);

    const ids = new Set<string>();
    flatUsers.forEach((u) => ids.add(u.id));
    memberships.forEach((m) => ids.add(m.userId));
    return ids.size;
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

    const currentAdmins = await this.countSeatHolders(orgId, 'ADMIN');

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
    data: any,
    targetOrgId?: string,
  ) {
    const orgId = this.getEffectiveOrgId(user, targetOrgId);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        features: true,
        domain: true,
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

    const updateData: any = {};
    if (data.features !== undefined) updateData.features = nextFeatures;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.contact !== undefined) updateData.contact = data.contact;

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        id: true,
        name: true,
        domain: true,
        contact: true,
        features: true,
      },
    });

    if (org.domain) {
      const cacheKey = `org:public:${org.domain.toLowerCase()}`;
      await this.redis.del(cacheKey);
      
      const parts = org.domain.split('.');
      if (parts.length > 1) {
        const subCacheKey = `org:public:${parts[0].toLowerCase()}`;
        await this.redis.del(subCacheKey);
      }
    }
    
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
    const [homeUsers, orgMemberships, pendingInvites] = await Promise.all([
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
      // Users who joined this org via an additive invite (their home
      // identity — User.orgId/role — stays at their original org by
      // design, see OrgMembership doc comment in schema.prisma). Without
      // this, anyone invited into a second org as teacher/admin/student
      // never appears here even though they're an active member. Includes
      // SUSPENDED rows too (not just ACTIVE) so a suspended member still
      // shows up with a "Suspended" status instead of disappearing.
      this.prisma.orgMembership.findMany({
        where: { orgId },
        select: {
          userId: true,
          role: true,
          status: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              isActive: true,
              rollNumber: true,
              department: true,
            },
          },
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

    const membershipByUserId = new Map(
      orgMemberships.map((membership) => [membership.userId, membership]),
    );

    // "Active" here reflects access to THIS org's workspace specifically —
    // a global account deactivation (user.isActive) still counts, but so
    // does an org-scoped suspension via OrgMembership.status, which is what
    // toggleUserStatus now actually writes to (see below).
    const homeRows = homeUsers.map((item) => {
      const membership = membershipByUserId.get(item.id);
      return {
        ...item,
        isActive: item.isActive && membership?.status !== 'SUSPENDED',
      };
    });

    const homeUserIds = new Set(homeUsers.map((item) => item.id));
    const membershipRows = orgMemberships
      .filter((membership) => !homeUserIds.has(membership.userId))
      .map((membership) => ({
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.role,
        isActive: membership.user.isActive && membership.status !== 'SUSPENDED',
        rollNumber: membership.user.rollNumber,
        department: membership.user.department,
        createdAt: membership.joinedAt,
        orgId,
      }));

    const users = [...homeRows, ...membershipRows];
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

  /**
   * Suspension is scoped to the caller's org, not a global kill switch — a
   * Teacher/Admin who also holds an active persona at another org must
   * keep working there when THIS org's admin suspends them. Writes to
   * OrgMembership.status (which MembershipService.resolveActiveMembership
   * and listMemberships already honor), not User.isActive.
   */
  async toggleUserStatus(id: string, caller: any, targetOrgId?: string) {
    const orgId = this.getEffectiveOrgId(caller, targetOrgId);

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, orgId: true, role: true },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    const membership = await this.prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: id, orgId } },
    });

    if (!membership && targetUser.orgId !== orgId) {
      throw new NotFoundException('User is not a member of this organization');
    }

    const nextStatus = membership?.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

    await this.prisma.orgMembership.upsert({
      where: { userId_orgId: { userId: id, orgId } },
      update: { status: nextStatus },
      create: {
        userId: id,
        orgId,
        role: membership?.role || targetUser.role,
        status: nextStatus,
      },
    });

    await this.invalidateOrgFeatureCaches(orgId);

    return { id, orgId, isActive: nextStatus === 'ACTIVE' };
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
        name: true,
        logo: true,
        primaryColor: true,
      } as any,
    });

    if (!org) throw new NotFoundException('Organization not found');

    // org._count.users (the Organization.users relation) only follows the
    // flat User.orgId FK — an additive OrgMembership persona in this org
    // (e.g. a Learner elsewhere self-served or was invited as a Teacher
    // here) never shows up there, undercounting real headcount and
    // letting maxUsers be bypassed. Union both sources instead.
    const [activePendingInviteCount, currentMemberCount] = await Promise.all([
      this.prisma.pendingInvite.count({
        where: { orgId, expiresAt: { gt: new Date() } },
      }),
      this.countOrgMemberCount(orgId),
    ]);

    if (currentMemberCount + activePendingInviteCount >= org.maxUsers) {
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

    // Orgs flagged features.resendInvites (the beta/tester org) send their
    // own branded email via MailService instead of Clerk's — the Clerk
    // invitation is still created (notify: false) so the ticket URL and the
    // whole PendingInvite/provisioning pipeline stay identical.
    const useBrandedEmail =
      org.features &&
      typeof org.features === 'object' &&
      !Array.isArray(org.features) &&
      (org.features as Record<string, unknown>).resendInvites === true;

    let invitation: any = null;
    try {
      const invitationArgs = {
        emailAddress: email,
        redirectUrl: this.getOrganizationInvitationUrl(org.domain),
        notify: !useBrandedEmail,
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
      };
      invitation = await clerkClient.invitations.createInvitation(
        invitationArgs as any,
      );

      if (useBrandedEmail) {
        if (!invitation?.url) {
          // Clerk didn't return a ticket URL — fall back to Clerk's own
          // email so the invite is still delivered, just unbranded.
          this.logger.warn(
            `[INVITE] Clerk invitation ${invitation?.id} has no url; falling back to Clerk-notified email for ${email}`,
          );
          await this.revokeClerkInvitationIfPossible(
            clerkClient,
            invitation?.id,
          );
          invitation = await clerkClient.invitations.createInvitation({
            ...invitationArgs,
            notify: true,
          } as any);
        } else {
          await this.mailService.sendOrgInviteEmail({
            to: email,
            inviteUrl: invitation.url,
            orgName: org.name || 'your organization',
            orgLogo: org.logo,
            orgPrimaryColor: org.primaryColor,
            role,
            inviteeName: name,
            expiresInDays: 7,
          });
        }
      }

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
      // Roll back everything created before the failure — with notify:false
      // no email went out, so a lingering Clerk invitation would just block
      // re-inviting this address.
      await this.revokeClerkInvitationIfPossible(clerkClient, invitation?.id);
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

  private async decrementSeatCounter(orgId: string, role: Role): Promise<void> {
    if (role === Role.STUDENT) {
      await this.quotaService.decrementCounter(orgId, 'studentCount', 1).catch(() => {});
    } else if (role === Role.ADMIN || role === Role.TEACHER) {
      await this.quotaService.decrementCounter(orgId, 'teacherSeatCount', 1).catch(() => {});
    }
  }

  /**
   * "Delete" here means remove access to THIS org's workspace, never wipe
   * an account outright — the multi-org model means a user deleted from
   * one org can still be a real, active member of another. Only the org
   * that is genuinely someone's ONLY relationship to the platform triggers
   * a full account removal; otherwise their home identity is reassigned to
   * another active org they hold and their membership row here is dropped.
   */
  async deleteUser(id: string, caller: any, targetOrgId?: string) {
    if (id === caller?.id) {
      throw new BadRequestException('You cannot remove yourself');
    }

    const orgId = this.getEffectiveOrgId(caller, targetOrgId);

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, orgId: true, role: true },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    const isHomeMember = targetUser.orgId === orgId;
    const membership = await this.prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: id, orgId } },
    });

    if (!isHomeMember && !membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    if (!isHomeMember) {
      // Additive membership only — drop the membership row, account and
      // home org untouched.
      await this.prisma.orgMembership.delete({ where: { id: membership!.id } });
      await this.decrementSeatCounter(orgId, membership!.role);
      await this.invalidateOrgFeatureCaches(orgId);
      return { id, orgId, removed: true, accountDeleted: false };
    }

    const otherActiveMembership = await this.prisma.orgMembership.findFirst({
      where: { userId: id, orgId: { not: orgId }, status: 'ACTIVE' },
      orderBy: { joinedAt: 'asc' },
    });

    if (otherActiveMembership) {
      // Home org, but they have somewhere else active — reassign their
      // home identity there instead of deleting the account, then drop the
      // membership to the org they're being removed from.
      await this.prisma.$transaction([
        this.prisma.orgMembership.deleteMany({ where: { userId: id, orgId } }),
        this.prisma.user.update({
          where: { id },
          data: {
            orgId: otherActiveMembership.orgId,
            role: otherActiveMembership.role,
            lastActiveOrgId: null,
          },
        }),
      ]);

      await this.decrementSeatCounter(orgId, targetUser.role);
      await this.invalidateOrgFeatureCaches(orgId);
      return { id, orgId, removed: true, accountDeleted: false };
    }

    // This org really is their only relationship to the platform.
    console.log('[AdminService] Starting deletion for user:', id);
    try {
      const auditLogResult = await this.prisma.auditLog.deleteMany({
        where: { userId: id },
      });
      console.log('[AdminService] Deleted audit logs:', auditLogResult.count);

      const userResult = await this.prisma.user.delete({
        where: { id },
      });

      await this.decrementSeatCounter(orgId, targetUser.role);
      await this.invalidateOrgFeatureCaches(orgId);

      console.log('[AdminService] User deleted successfully');
      return { ...userResult, removed: true, accountDeleted: true };
    } catch (error: any) {
      console.error('[AdminService] Deletion error:', error);
      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw new BadRequestException(error.message || 'Failed to delete user');
    }
  }

  /**
   * Elevate/demote a user's role within the caller's org. For an additive
   * membership only the OrgMembership row changes; for a home-org member
   * the flat User.role changes too (mirrors how invites/toggleUserStatus
   * already branch on isHomeMember). Reuses enforceInviteQuota — the same
   * seat-limit check applied when inviting someone new — so promoting an
   * existing member into TEACHER/ADMIN can't overflow the org's plan tier
   * any more than inviting a brand-new one could.
   */
  async updateUserRole(id: string, role: string, caller: any, targetOrgId?: string) {
    if (id === caller?.id) {
      throw new BadRequestException('You cannot change your own role');
    }

    const orgId = this.getEffectiveOrgId(caller, targetOrgId);
    const normalizedRole = this.normalizeRole(role);

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, orgId: true, role: true },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    const isHomeMember = targetUser.orgId === orgId;
    const membership = await this.prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: id, orgId } },
    });

    if (!isHomeMember && !membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    const currentRole = membership?.role || targetUser.role;
    if (currentRole === normalizedRole) {
      return { id, orgId, role: normalizedRole, changed: false };
    }

    const org: any = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        plan: true,
        features: true,
        maxAdminSeats: true,
      } as any,
    });
    if (!org) throw new NotFoundException('Organization not found');

    // The user already occupies a seat under currentRole, not
    // normalizedRole yet, so this cleanly checks "does one more member at
    // the target role still fit the plan" without double-counting them.
    await this.enforceInviteQuota(org, normalizedRole, 1);

    if (membership) {
      await this.prisma.orgMembership.update({
        where: { id: membership.id },
        data: { role: normalizedRole },
      });
    }

    if (isHomeMember) {
      await this.prisma.user.update({
        where: { id },
        data: { role: normalizedRole },
      });
    }

    const wasStudent = currentRole === Role.STUDENT;
    const willBeStudent = normalizedRole === Role.STUDENT;
    if (wasStudent && !willBeStudent) {
      await this.quotaService.decrementCounter(orgId, 'studentCount', 1).catch(() => {});
      await this.quotaService.incrementCounter(orgId, 'teacherSeatCount', 1).catch(() => {});
    } else if (!wasStudent && willBeStudent) {
      await this.quotaService.decrementCounter(orgId, 'teacherSeatCount', 1).catch(() => {});
      await this.quotaService.incrementCounter(orgId, 'studentCount', 1).catch(() => {});
    }

    await this.invalidateOrgFeatureCaches(orgId);

    return { id, orgId, role: normalizedRole, changed: true };
  }
}
