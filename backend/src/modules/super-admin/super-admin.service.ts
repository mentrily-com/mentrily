import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { StorageService } from '../../services/storage/storage.service';
import { BillingService } from '../billing/billing.service';
import { QuotaService } from '../billing/quota.service';
import { PlanKey, getEffectivePlanLimits } from '../../config/plan-limits';
import { Plan, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto';
import { UpdateOrganizationLimitsDto } from './dto/update-organization-limits.dto';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { getPublicAppUrl } from '../../config/app-brand';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly supabase: SupabaseService,
    private storageService: StorageService,
    private billingService: BillingService,
    private readonly quotaService: QuotaService,
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

  private normalizeEmail(email?: string): string {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  private async createManualPlanEvent(params: {
    orgId: string;
    previousPlan: Plan;
    newPlan: Plan;
    actorId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.subscriptionEvent.create({
      data: {
        stripeEventId: `manual_${params.orgId}_${Date.now()}_${randomUUID()}`,
        eventType: 'super_admin.plan_updated',
        orgId: params.orgId,
        previousPlan: params.previousPlan,
        newPlan: params.newPlan,
        metadata: {
          source: 'super_admin',
          actorId: params.actorId || null,
          ...((params.metadata as Record<string, unknown>) || {}),
        },
      },
    });
  }

  async getStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalOrgs,
      totalStudents,
      totalPayingOrgs,
      failedPayments30d,
      orgsByPlanRawResponse,
      recentEventsRaw,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.organization.count({
        where: { plan: { in: ['STARTER', 'PRO', 'ENTERPRISE'] } },
      }),
      this.prisma.subscriptionEvent.count({
        where: {
          eventType: 'invoice.payment_failed',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      (this.supabase.client as any).rpc('get_org_counts_by_plan'),
      this.prisma.subscriptionEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          eventType: true,
          previousPlan: true,
          newPlan: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const orgsByPlan: Record<string, number> = {
      FREE: 0,
      STARTER: 0,
      PRO: 0,
      ENTERPRISE: 0,
    };

    if (orgsByPlanRawResponse?.error) {
      throw new BadRequestException(
        orgsByPlanRawResponse.error.message ||
          'Failed to fetch organization counts by plan',
      );
    }

    const orgsByPlanRaw = Array.isArray(orgsByPlanRawResponse?.data)
      ? orgsByPlanRawResponse.data
      : [];

    for (const row of orgsByPlanRaw) {
      orgsByPlan[row.plan] = Number(row.count || 0);
    }

    const recentEvents = recentEventsRaw.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      previousPlan: event.previousPlan,
      newPlan: event.newPlan,
      createdAt: event.createdAt,
      orgId: event.organization.id,
      orgName: event.organization.name,
    }));

    return {
      totalOrgs,
      orgsByPlan,
      totalStudents,
      totalPayingOrgs,
      failedPayments30d,
      recentEvents,
    };
  }

  async getOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit for dashboard
    });

    return organizations.map((org) => {
      const limits = getEffectivePlanLimits(
        (org.plan as PlanKey) || 'FREE',
        org.features,
      );

      const studentLimit = Number(limits.students || 0);
      const storageLimit = Number(limits.storageMb || 0);
      const seatsLimit = Number(limits.seats || 0);

      const studentPercent =
        studentLimit > 0
          ? Math.min(
              100,
              Math.round((Number(org.studentCount || 0) / studentLimit) * 100),
            )
          : 0;
      const storagePercent =
        storageLimit > 0
          ? Math.min(
              100,
              Math.round((Number(org.storageUsedMb || 0) / storageLimit) * 100),
            )
          : 0;
      const seatsPercent =
        seatsLimit > 0
          ? Math.min(
              100,
              Math.round(
                (Number(org.teacherSeatCount || 0) / seatsLimit) * 100,
              ),
            )
          : 0;

      return {
        ...org,
        limits,
        usagePercent: {
          students: studentPercent,
          storage: storagePercent,
          seats: seatsPercent,
        },
        hasCriticalUsage:
          Math.max(studentPercent, storagePercent, seatsPercent) >= 90,
      };
    });
  }

  async getOrganization(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'ADMIN' },
          take: 1,
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const adminCount = await this.prisma.user.count({
      where: { orgId: id, role: 'ADMIN' },
    });

    return {
      ...organization,
      limits: getEffectivePlanLimits(
        (organization.plan as PlanKey) || 'FREE',
        organization.features,
      ),
      adminCount,
      maxAdminSeats: (organization as any).maxAdminSeats,
    };
  }

  async createOrganization(data: any) {
    // 0. Pre-check: Admin Email Uniqueness
    const adminEmail = this.normalizeEmail(data.adminEmail);
    if (adminEmail) {
      // We now allow existing users to be invited as admins to new organizations
      // since multi-org memberships are supported and Clerk handles ignoreExisting: true.

    }

    try {
      console.log(
        '[SuperAdminService] Creating organization with data:',
        JSON.stringify(data, null, 2),
      );

      // 1. Create Organization
      const org = await this.prisma.organization.create({
        data: {
          name: data.name,
          domain: data.domain,
          logo: data.logo || null,
          status: data.status || 'Active',

          // Limits
          maxUsers: Number(data.maxUsers) || 100,
          maxCourses: Number(data.maxCourses) || 10,
          storageLimit: Number(data.storageLimit || data.maxStorage) || 1024,
          examsPerMonth: Number(data.examsPerMonth) || 50,
          maxAdminSeats:
            data.maxAdminSeats !== undefined && data.maxAdminSeats !== null
              ? Number(data.maxAdminSeats)
              : null,

          // Config
          plan: data.plan || 'ENTERPRISE',
          primaryColor: data.primaryColor || '#008D98',
          features: {
            canCreateExams:
              data.canCreateExams !== undefined ? data.canCreateExams : true,
            allowAppExams:
              data.allowAppExams !== undefined ? data.allowAppExams : true,
            allowAIProctoring:
              data.allowAIProctoring !== undefined
                ? data.allowAIProctoring
                : true,
            canCreateCourses:
              data.canCreateCourses !== undefined
                ? data.canCreateCourses
                : true,
            allowCourseTests:
              data.allowCourseTests !== undefined
                ? data.allowCourseTests
                : true,
            canManageUsers:
              data.canManageUsers !== undefined ? data.canManageUsers : true,
          },
          contact: {
            adminName: data.adminName || null,
            adminEmail: data.adminEmail || null,
            phone: data.phone || null,
            supportEmail: data.supportEmail || null,
            address: data.address || null,
            city: data.city || null,
            country: data.country || null,
          },
        } as any,
      });

      console.log(
        '[SuperAdminService] Organization created successfully:',
        org.id,
      );

      try {
        await this.billingService.getOrCreateStripeCustomer(org.id);
      } catch (error: any) {
        console.error(
          '[SuperAdminService] Failed to auto-create Stripe customer:',
          error?.message || error,
        );
      }

      if (adminEmail) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email: adminEmail },
        });

        if (existingUser) {
          try {
            // User exists, directly add them as an admin to the new org
            await this.prisma.orgMembership.create({
              data: {
                userId: existingUser.id,
                orgId: org.id,
                role: Role.ADMIN,
              },
            });
          } catch (error: any) {
            await this.prisma.organization
              .delete({ where: { id: org.id } })
              .catch(() => undefined);
            throw error;
          }
        } else {
          // User doesn't exist, send a Clerk invitation
          const clerkClient = this.getClerkClient();
          // Scoped to this org only
          const staleInvite = await this.prisma.pendingInvite.findUnique({
            where: { email_orgId: { email: adminEmail, orgId: org.id } },
          });
          if (staleInvite) {
            await this.prisma.pendingInvite.delete({
              where: { id: staleInvite.id },
            });
          }

          const pendingInvite = await this.prisma.pendingInvite.create({
            data: {
              email: adminEmail,
              name: data.adminName || 'Admin',
              role: Role.ADMIN,
              orgId: org.id,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            } as any,
          });

          try {
            const invitation = await clerkClient.invitations.createInvitation({
              emailAddress: adminEmail,
              redirectUrl: this.getOrganizationInvitationUrl(org.domain),
              notify: true,
              ignoreExisting: true,
              expiresInDays: 7,
              publicMetadata: {
                appRole: Role.ADMIN,
                orgId: org.id,
                name: data.adminName || 'Admin',
                source: 'mentrily_org_bootstrap',
              },
            } as any);

            await this.prisma.pendingInvite.update({
              where: { id: pendingInvite.id },
              data: { clerkInvitationId: invitation.id },
            });
          } catch (error: any) {
            await this.prisma.pendingInvite.delete({
              where: { id: pendingInvite.id },
            });
            await this.prisma.organization
              .delete({ where: { id: org.id } })
              .catch(() => undefined);
            throw error;
          }
        }
      }

      return org;
    } catch (error) {
      console.error('[SuperAdminService] Create Organization Error Details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });
      throw new BadRequestException(
        'Failed to create organization. ' + error.message,
      );
    }
  }

  async updateOrganization(id: string, data: any) {
    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async updateOrganizationPlan(
    id: string,
    data: UpdateOrganizationPlanDto,
    actorId?: string,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, plan: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const nextPlan = data.plan;
    const previousPlan = organization.plan;

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { plan: nextPlan },
      select: {
        id: true,
        name: true,
        plan: true,
        maxAdminSeats: true,
        features: true,
      } as any,
    });

    if (previousPlan !== nextPlan) {
      await this.createManualPlanEvent({
        orgId: id,
        previousPlan,
        newPlan: nextPlan,
        actorId,
      });
    }

    return updated;
  }

  async updateOrganizationLimits(
    id: string,
    data: UpdateOrganizationLimitsDto,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        plan: true,
        features: true,
        maxAdminSeats: true,
      } as any,
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const currentFeatures =
      organization.features &&
      typeof organization.features === 'object' &&
      !Array.isArray(organization.features)
        ? (organization.features as Record<string, unknown>)
        : {};

    const currentOverrides =
      currentFeatures.limitsOverrides &&
      typeof currentFeatures.limitsOverrides === 'object' &&
      !Array.isArray(currentFeatures.limitsOverrides)
        ? (currentFeatures.limitsOverrides as Record<string, unknown>)
        : {};

    const nextOverrides = {
      ...currentOverrides,
      ...(data.students !== undefined ? { students: data.students } : {}),
      ...(data.courses !== undefined ? { courses: data.courses } : {}),
      ...(data.storageMb !== undefined ? { storageMb: data.storageMb } : {}),
      ...(data.seats !== undefined ? { seats: data.seats } : {}),
    };

    const nextFeatures = {
      ...currentFeatures,
      limitsOverrides: nextOverrides,
    };

    const updated: any = await this.prisma.organization.update({
      where: { id },
      data: {
        features: nextFeatures as any,
        ...(data.maxAdminSeats !== undefined
          ? { maxAdminSeats: data.maxAdminSeats }
          : {}),
      } as any,
      select: {
        id: true,
        name: true,
        plan: true,
        features: true,
        maxAdminSeats: true,
      } as any,
    });

    return {
      ...updated,
      limits: getEffectivePlanLimits(
        (updated.plan as PlanKey) || 'FREE',
        updated.features,
      ),
    };
  }

  async getUsers(page: number, limit: number, search: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        // Note: Filtering by relation (organization) depends on Prisma version/db support.
        // If this fails, consider removing the relation filter or doing it differently.
        // Assuming efficient enough for now or that it's supported.
        { organization: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          organization: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUser(id: string, data: any) {
    // Only allow specific updates for safety
    const safeData: any = {};
    if (typeof data.isActive === 'boolean') safeData.isActive = data.isActive;
    if (data.name) safeData.name = data.name;
    if (data.role) safeData.role = data.role;

    return this.prisma.user.update({
      where: { id },
      data: safeData,
    });
  }

  async transferUserToOrganization(userId: string, targetOrgId: string) {
    const normalizedUserId = String(userId || '').trim();
    const normalizedTargetOrgId = String(targetOrgId || '').trim();

    if (!normalizedUserId || !normalizedTargetOrgId) {
      throw new BadRequestException('userId and targetOrgId are required');
    }

    const [user, targetOrg] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: normalizedUserId },
        select: {
          id: true,
          orgId: true,
          role: true,
          email: true,
        },
      }),
      this.prisma.organization.findUnique({
        where: { id: normalizedTargetOrgId },
        select: {
          id: true,
          plan: true,
          name: true,
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.orgId) {
      throw new BadRequestException(
        'User is not associated with an organization',
      );
    }

    if (!targetOrg) {
      throw new NotFoundException('Target organization not found');
    }

    if (String(targetOrg.plan || '').toUpperCase() !== 'ENTERPRISE') {
      throw new BadRequestException(
        'Target organization must be on Enterprise plan',
      );
    }

    const sourceOrgId = user.orgId;
    if (sourceOrgId === normalizedTargetOrgId) {
      throw new BadRequestException(
        'User is already in the target organization',
      );
    }

    const transferCounts = await this.prisma.$transaction(async (tx) => {
      const [courses, exams, courseTests, studentGroups, announcements, users] =
        await Promise.all([
          tx.course.updateMany({
            where: {
              orgId: sourceOrgId,
              creatorId: normalizedUserId,
            },
            data: { orgId: normalizedTargetOrgId },
          }),
          tx.exam.updateMany({
            where: {
              orgId: sourceOrgId,
              creatorId: normalizedUserId,
            },
            data: { orgId: normalizedTargetOrgId },
          }),
          tx.courseTest.updateMany({
            where: { orgId: sourceOrgId },
            data: { orgId: normalizedTargetOrgId },
          }),
          tx.studentGroup.updateMany({
            where: { orgId: sourceOrgId },
            data: { orgId: normalizedTargetOrgId },
          }),
          tx.announcement.updateMany({
            where: { orgId: sourceOrgId },
            data: { orgId: normalizedTargetOrgId },
          }),
          tx.user.updateMany({
            where: { orgId: sourceOrgId },
            data: { orgId: normalizedTargetOrgId },
          }),
        ]);

      return {
        courses: courses.count,
        exams: exams.count,
        courseTests: courseTests.count,
        studentGroups: studentGroups.count,
        announcements: announcements.count,
        users: users.count,
      };
    });

    await Promise.all([
      this.quotaService.recalculateCounters(sourceOrgId),
      this.quotaService.recalculateCounters(normalizedTargetOrgId),
    ]);

    const sourceUsersRemaining = await this.prisma.user.count({
      where: { orgId: sourceOrgId },
    });

    let sourceOrgDeleted = false;
    if (sourceUsersRemaining === 0) {
      try {
        await this.prisma.organization.delete({ where: { id: sourceOrgId } });
        sourceOrgDeleted = true;
      } catch {
        sourceOrgDeleted = false;
      }
    }

    if (!sourceOrgDeleted) {
      // Deleting the org would have cascaded OrgMembership rows away. If it
      // didn't get deleted (still has other users, or the delete failed),
      // every user whose flat orgId we just moved off of sourceOrgId (the
      // whole org's user base — this migrates everyone, not just
      // normalizedUserId) would otherwise keep a stale ACTIVE membership
      // granting continued dashboard access to an org their content/home
      // org no longer lives in.
      await this.prisma.orgMembership.deleteMany({
        where: { orgId: sourceOrgId },
      });
    }

    return {
      transferred: true,
      userId: normalizedUserId,
      fromOrgId: sourceOrgId,
      targetOrgId: normalizedTargetOrgId,
      targetOrgName: targetOrg.name,
      sourceOrgDeleted,
      sourceUsersRemaining,
      moved: transferCounts,
    };
  }

  async deleteUser(id: string) {
    // Check if user is the last super admin or something?
    // For now keep it simple but maybe add a check
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user?.role === 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN' },
      });
      if (count <= 1)
        throw new BadRequestException('Cannot delete the last Super Admin.');
    }

    return this.prisma.user.delete({
      where: { id },
    });
  }

  async deleteOrganization(id: string) {
    try {
      const { error } = await (this.supabase.client as any).rpc(
        'delete_organization',
        {
          p_org_id: id,
        },
      );

      if (error) {
        throw new Error(error.message || 'Failed to delete organization');
      }

      return { success: true };
    } catch (error) {
      console.error('[SuperAdminService] Delete Error Full:', error);
      throw new BadRequestException(
        'Failed to delete organization. Dependencies may exist. ' +
          error.message,
      );
    }
  }

  async getBugReports(status?: 'OPEN' | 'FIXED', page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    const skip = (safePage - 1) * safeLimit;

    const where: any = {};
    if (status === 'OPEN' || status === 'FIXED') {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.bugReport.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
              organization: { select: { id: true, name: true } },
            },
          },
          fixedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.bugReport.count({ where }),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async markBugReportFixed(id: string, fixedById?: string) {
    const existing = await this.prisma.bugReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bug report not found');

    return this.prisma.bugReport.update({
      where: { id },
      data: {
        status: 'FIXED',
        fixedAt: new Date(),
        fixedById: fixedById || null,
      },
    });
  }

  async deleteBugReport(id: string) {
    const existing = await this.prisma.bugReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bug report not found');

    const attachments = Array.isArray(existing.attachments)
      ? (existing.attachments as any[])
      : [];
    for (const att of attachments) {
      if (att?.url) {
        await this.storageService.deleteFile(att.url).catch(() => undefined);
      }
    }

    return this.prisma.bugReport.delete({ where: { id } });
  }
}
