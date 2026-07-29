import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../services/prisma/prisma.service';
import { QuotaService } from '../billing/quota.service';
import { MembershipService } from './membership.service';

@Injectable()
export class OrgProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
    private readonly membershipService: MembershipService,
  ) {}

  private slugifyOrganizationName(orgName: string): string {
    const slug = String(orgName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'organization';
  }

  private async generateUniqueOrganizationSlug(
    baseSlug: string,
  ): Promise<string> {
    let candidate = baseSlug;

    for (let suffix = 0; suffix < 2000; suffix += 1) {
      if (suffix > 0) {
        candidate = `${baseSlug}-${suffix + 1}`;
      }

      const exists = await this.prisma.organization.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!exists) {
        return candidate;
      }
    }

    throw new ConflictException(
      'Unable to generate a unique organization slug',
    );
  }

  private async createPersonalOrganization(user: {
    id: string;
    name: string | null;
  }): Promise<{ id: string }> {
    const normalizedUserName = String(user.name || '').trim();
    const orgName = normalizedUserName
      ? `${normalizedUserName}'s School`
      : 'My School';
    const slug = await this.generateUniqueOrganizationSlug(
      this.slugifyOrganizationName(orgName),
    );

    const organization = await this.prisma.organization.create({
      data: {
        name: orgName,
        slug,
        plan: 'FREE',
        provisionedFromUserId: user.id,
      } as any,
      select: { id: true },
    });

    await this.quotaService.incrementCounter(
      organization.id,
      'teacherSeatCount',
      1,
    );
    await this.quotaService.recalculateCounters(organization.id);

    return organization;
  }

  async ensureOrgForUser(userId: string): Promise<string> {
    const normalizedUserId = String(userId || '').trim();
    const user = await this.prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: {
        id: true,
        orgId: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.orgId) {
      return user.orgId;
    }

    const organization = await this.createPersonalOrganization(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        orgId: organization.id,
        needsRoleSelection: false,
      },
    });

    return organization.id;
  }

  /**
   * Additive Creator persona for a user who ALREADY has a home org/role
   * (e.g. a Learner). Never touches User.orgId/role — grants an OrgMembership
   * on a personal org instead, same additive principle as accepting a
   * second-org invite. Idempotent: a user only ever owns one personal org,
   * found via Organization.provisionedFromUserId regardless of whether it's
   * their home org.
   */
  async ensureCreatorPersona(
    userId: string,
  ): Promise<{ orgId: string; role: 'TEACHER' }> {
    const normalizedUserId = String(userId || '').trim();
    const user = await this.prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: { id: true, orgId: true, name: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Additive for EVERY caller, including a learner with no home org: we
    // find-or-create their own personal org and grant a TEACHER membership
    // on it, without ever touching User.orgId/role. This keeps their learner
    // home (even an org-less one) intact and switchable, and — crucially —
    // always leaves an ACTIVE OrgMembership row so switchActiveOrg() can
    // resolve the new persona (otherwise the follow-up switch 403s with
    // "You are not a member of that organization").
    let personalOrg = await this.prisma.organization.findFirst({
      where: { provisionedFromUserId: user.id },
      select: { id: true },
    });

    if (!personalOrg) {
      // Brand new personal org — createPersonalOrganization already
      // increments the seat counter, no separate quota check needed.
      personalOrg = await this.createPersonalOrganization(user);
    } else {
      // Existing personal org. Only gate on quota when we're about to add a
      // NEW active membership — re-granting to the same user (idempotent
      // repeat call) must not be blocked by their own seat.
      const existingMembership = await this.prisma.orgMembership.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: personalOrg.id } },
        select: { status: true },
      });

      if (!existingMembership || existingMembership.status !== 'ACTIVE') {
        await this.quotaService.checkTeacherSeatQuota(personalOrg.id, 1);
      }
    }

    await this.membershipService.grantMembership(
      user.id,
      personalOrg.id,
      'TEACHER',
    );

    return { orgId: personalOrg.id, role: 'TEACHER' };
  }

  async normalizeAccidentalFreeOrgForUser(userId: string): Promise<boolean> {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: {
        id: true,
        role: true,
        orgId: true,
        organization: {
          select: {
            id: true,
            plan: true,
            provisionedFromUserId: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripePriceId: true,
          },
        },
      },
    });

    const org = user?.organization;
    if (!user?.orgId || !org) {
      return false;
    }

    const hasStripeSubscription = Boolean(
      String(org.stripeCustomerId || '').trim() ||
      String(org.stripeSubscriptionId || '').trim() ||
      String(org.stripePriceId || '').trim(),
    );

    if (
      org.plan !== 'FREE' ||
      org.provisionedFromUserId !== user.id ||
      hasStripeSubscription
    ) {
      return false;
    }

    const memberCount = await this.prisma.user.count({
      where: { orgId: org.id },
    });

    if (memberCount !== 1) {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.$executeRaw`
          UPDATE "Course"
          SET "orgId" = NULL
          WHERE "creatorId" = ${normalizedUserId}
            AND "orgId" = ${org.id}
        `,
        tx.$executeRaw`
          UPDATE "Exam"
          SET "orgId" = NULL
          WHERE "creatorId" = ${normalizedUserId}
            AND "orgId" = ${org.id}
        `,
        tx.$executeRaw`
          UPDATE "CourseTest"
          SET "orgId" = NULL
          WHERE "orgId" = ${org.id}
            AND "courseId" IN (
              SELECT "id"
              FROM "Course"
              WHERE "creatorId" = ${normalizedUserId}
            )
        `,
        tx.$executeRaw`
          UPDATE "StudentGroup"
          SET "orgId" = NULL
          WHERE "teacherId" = ${normalizedUserId}
            AND "orgId" = ${org.id}
        `,
        tx.$executeRaw`
          UPDATE "Announcement"
          SET "orgId" = NULL
          WHERE "teacherId" = ${normalizedUserId}
            AND "orgId" = ${org.id}
        `,
        tx.$executeRaw`
          UPDATE "User"
          SET "orgId" = NULL
          WHERE "role" = 'STUDENT'
            AND "orgId" = ${org.id}
            AND "id" IN (
              SELECT DISTINCT u."B"
              FROM "_CourseStudents" u
              INNER JOIN "Course" c ON c."id" = u."A"
              WHERE c."creatorId" = ${normalizedUserId}
            )
        `,
        tx.user.update({
          where: { id: normalizedUserId },
          data: {
            orgId: null,
            role: 'TEACHER',
            needsRoleSelection: false,
          },
        }),
      ]);
    });

    return true;
  }

  async migratePersonalResourcesToOrg(
    userId: string,
    orgId: string,
  ): Promise<void> {
    const normalizedUserId = String(userId || '').trim();
    const normalizedOrgId = String(orgId || '').trim();
    if (!normalizedUserId || !normalizedOrgId) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.$executeRaw`
          UPDATE "Course"
          SET "orgId" = ${normalizedOrgId}
          WHERE "creatorId" = ${normalizedUserId}
            AND "orgId" IS NULL
        `,
        tx.$executeRaw`
          UPDATE "Exam"
          SET "orgId" = ${normalizedOrgId}
          WHERE "creatorId" = ${normalizedUserId}
            AND "orgId" IS NULL
        `,
        tx.$executeRaw`
          UPDATE "CourseTest"
          SET "orgId" = ${normalizedOrgId}
          WHERE "orgId" IS NULL
            AND "courseId" IN (
              SELECT "id"
              FROM "Course"
              WHERE "creatorId" = ${normalizedUserId}
            )
        `,
        tx.$executeRaw`
          UPDATE "StudentGroup"
          SET "orgId" = ${normalizedOrgId}
          WHERE "teacherId" = ${normalizedUserId}
            AND "orgId" IS NULL
        `,
        tx.$executeRaw`
          UPDATE "Announcement"
          SET "orgId" = ${normalizedOrgId}
          WHERE "teacherId" = ${normalizedUserId}
            AND "orgId" IS NULL
        `,
        tx.$executeRaw`
          UPDATE "User"
          SET "orgId" = ${normalizedOrgId}
          WHERE "role" = 'STUDENT'
            AND "orgId" IS NULL
            AND "id" IN (
              SELECT DISTINCT u."B"
              FROM "_CourseStudents" u
              INNER JOIN "Course" c ON c."id" = u."A"
              WHERE c."creatorId" = ${normalizedUserId}
            )
        `,
      ]);
    });

    await this.quotaService.recalculateCounters(normalizedOrgId);
  }

  async enableEnterpriseCustomization(orgId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { features: true },
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

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        features: {
          ...currentFeatures,
          whiteLabel: true,
          customDomain: true,
          subdomain: true,
        } as any,
      },
    });
  }
}
