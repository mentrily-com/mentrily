import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../services/prisma/prisma.service';
import { QuotaService } from '../billing/quota.service';

@Injectable()
export class OrgProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
  ) {}

  private slugifyOrganizationName(orgName: string): string {
    const slug = String(orgName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'organization';
  }

  private async generateUniqueOrganizationSlug(baseSlug: string): Promise<string> {
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

    throw new ConflictException('Unable to generate a unique organization slug');
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        orgId: organization.id,
        needsRoleSelection: false,
      },
    });

    await this.quotaService.incrementCounter(
      organization.id,
      'teacherSeatCount',
      1,
    );
    await this.quotaService.recalculateCounters(organization.id);

    return organization.id;
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

  async migratePersonalResourcesToOrg(userId: string, orgId: string): Promise<void> {
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
