import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Role } from '@prisma/client';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { MailService } from '../../services/mail.service';
import { StorageService } from '../../services/storage/storage.service';
import { QuotaService } from '../billing/quota.service';
import { OrgProvisioningService } from '../organization/org-provisioning.service';
import { MembershipService } from '../organization/membership.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private roleEnumMeta:
    | {
        castType: string;
        labels: Set<string>;
      }
    | undefined;
  private hasOnboardingColumn: boolean | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    @InjectRedis() private readonly redis: Redis,
    private mailService: MailService,
    private storageService: StorageService,
    private quotaService: QuotaService,
    private orgProvisioningService: OrgProvisioningService,
    private membershipService: MembershipService,
  ) {}

  private get db() {
    return this.supabase.legacyPrisma;
  }

  /**
   * The session guard caches under `user:session:{clerkId}:{scope}` where
   * scope is an org id, 'persona-learner', or 'default' — a bare
   * `del('user:session:{id}')` never matches any of those, so role changes
   * kept being served from cache for the full 5-minute TTL. Always bust via
   * this helper, which sweeps every scope for every known id.
   */
  async clearSessionCache(
    ...ids: Array<string | null | undefined>
  ): Promise<void> {
    const uniqueIds = [
      ...new Set(
        ids.map((id) => String(id || '').trim()).filter((id) => id.length > 0),
      ),
    ];
    if (uniqueIds.length === 0) return;

    const keys: string[] = [];

    const users = await this.db.user.findMany({
      where: {
        OR: [{ id: { in: uniqueIds } }, { clerkId: { in: uniqueIds } }],
      },
      select: { id: true, orgId: true, clerkId: true },
    });

    const internalUserIds = users.map((u) => u.id);
    const memberships = await this.db.orgMembership.findMany({
      where: { userId: { in: internalUserIds } },
      select: { userId: true, orgId: true },
    });

    // Collect all orgIds associated with any of the resolved users
    const allOrgIds = new Set<string>();
    for (const m of memberships) {
      allOrgIds.add(m.orgId);
    }
    for (const u of users) {
      if (u.orgId) {
        allOrgIds.add(u.orgId);
      }
    }

    for (const id of uniqueIds) {
      keys.push(`user:session:${id}`);
      keys.push(`user:session:${id}:default`);
      keys.push(`user:session:${id}:persona-learner`);

      for (const orgId of allOrgIds) {
        keys.push(`user:session:${id}:${orgId}`);
        keys.push(`user:session:${id}:${orgId}:persona-learner`);
      }
    }

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async getRoleEnumMeta(): Promise<{
    castType: string;
    labels: Set<string>;
  }> {
    if (this.roleEnumMeta) {
      return this.roleEnumMeta;
    }

    const columnRows = await this.db.$queryRawUnsafe(
      `
        SELECT c.udt_schema, c.udt_name
        FROM information_schema.columns c
        WHERE c.table_schema = current_schema()
          AND c.table_name = 'User'
          AND c.column_name = 'role'
        LIMIT 1
      `,
    );

    const udtSchema = String(columnRows?.[0]?.udt_schema || '').trim();
    const udtName = String(columnRows?.[0]?.udt_name || '').trim();

    if (!udtSchema || !udtName) {
      throw new BadRequestException('ROLE_COLUMN_METADATA_MISSING');
    }

    const enumRows = await this.db.$queryRawUnsafe(
      `
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = $1
          AND t.typname = $2
        ORDER BY e.enumsortorder ASC
      `,
      udtSchema,
      udtName,
    );

    const labels = new Set(
      enumRows
        .map((row) =>
          String(row?.enumlabel || '')
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    );

    const escapedType = udtName.replace(/"/g, '""');
    const castType = /[A-Z]/.test(udtName) ? `"${escapedType}"` : escapedType;

    this.roleEnumMeta = {
      castType,
      labels,
    };

    return this.roleEnumMeta;
  }

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

      const exists = await this.db.organization.findUnique({
        where: { slug: candidate } as any,
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

  private isMissingOnboardingColumnError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as any).code === 'P2022' &&
      String((error as any)?.meta?.column || '').includes(
        'User.hasCompletedOnboarding',
      )
    );
  }

  private async getUserRoleSelectionPayload(userId: string) {
    const baseSelect = {
      id: true,
      email: true,
      role: true,
      orgId: true,
      profilePicture: true,
      name: true,
      rollNumber: true,
      department: true,
      mustChangePassword: true,
      needsRoleSelection: true,
    } as const;

    const select =
      this.hasOnboardingColumn === false
        ? baseSelect
        : ({
            ...baseSelect,
            hasCompletedOnboarding: true,
          } as const);

    try {
      const user = await this.db.user.findUnique({
        where: { id: userId },
        select: select as any,
      });
      this.hasOnboardingColumn = true;
      return {
        ...(user as any),
        hasCompletedOnboarding: Boolean((user as any)?.hasCompletedOnboarding),
      };
    } catch (error) {
      if (!this.isMissingOnboardingColumnError(error)) {
        throw error;
      }

      this.hasOnboardingColumn = false;
      const user = await this.db.user.findUnique({
        where: { id: userId },
        select: baseSelect as any,
      });
      return {
        ...(user as any),
        hasCompletedOnboarding: false,
      };
    }
  }

  private getRootDomain(): string {
    return String(
      process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || '',
    )
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/:\d+$/, '');
  }

  private getOrgSlug(orgDomain?: string | null): string | null {
    const rawOrgDomain = String(orgDomain || '')
      .trim()
      .toLowerCase();
    if (!rawOrgDomain) return null;

    if (rawOrgDomain === 'default') {
      return null;
    }

    const cleanedDomain = rawOrgDomain
      .replace(/^https?:\/\//, '')
      .replace(/:\d+$/, '');

    if (cleanedDomain === 'default') {
      return null;
    }

    const rootDomain = this.getRootDomain();
    if (rootDomain && cleanedDomain.endsWith(`.${rootDomain}`)) {
      const prefix = cleanedDomain.slice(0, -`.${rootDomain}`.length);
      const slug = prefix.split('.')[0];
      return slug || null;
    }

    if (!cleanedDomain.includes('.')) {
      return cleanedDomain;
    }

    return cleanedDomain.split('.')[0] || null;
  }

  private buildOrgUrl(orgSlug?: string | null): string | null {
    const slug = String(orgSlug || '')
      .trim()
      .toLowerCase();
    if (!slug || slug === 'default') return null;

    const rootDomain = this.getRootDomain();
    if (!rootDomain) return null;

    if (rootDomain === 'localhost') {
      return `http://${slug}.localhost:3000`;
    }

    return `https://${slug}.${rootDomain}`;
  }

  private isAppClient(ctx?: {
    userAgent?: string;
    clientPlatform?: string;
  }): boolean {
    const userAgent = String(ctx?.userAgent || '').toLowerCase();
    const clientPlatform = String(ctx?.clientPlatform || '').toLowerCase();

    return (
      clientPlatform.includes('electron') ||
      clientPlatform.includes('desktop') ||
      clientPlatform.includes('app') ||
      userAgent.includes('electron')
    );
  }

  private getDefaultOrgId(): string | null {
    const value = String(process.env.DEFAULT_ORG_ID || '').trim();
    return value || null;
  }

  private extractPrimaryEmail(clerkUserData: any): string {
    const emailAddresses = Array.isArray(clerkUserData?.email_addresses)
      ? clerkUserData.email_addresses
      : [];

    const primaryEmailAddressId = String(
      clerkUserData?.primary_email_address_id || '',
    ).trim();
    const primaryById = primaryEmailAddressId
      ? emailAddresses.find(
          (address: any) =>
            String(address?.id || '').trim() === primaryEmailAddressId,
        )
      : null;

    const fallbackAddress = emailAddresses.find((address: any) => {
      const value = String(address?.email_address || '').trim();
      return !!value;
    });

    return String(
      primaryById?.email_address || fallbackAddress?.email_address || '',
    )
      .trim()
      .toLowerCase();
  }

  async syncClerkUser(event: string, clerkUserData: any) {
    const clerkId = clerkUserData?.id;
    if (!clerkId) return { success: true };

    if (event === 'user.created') {
      await this.clearSessionCache(clerkId);
      return { success: true, deferredProvisioning: true };
    }

    if (event === 'user.updated') {
      const primaryEmail = this.extractPrimaryEmail(clerkUserData);
      const firstName = String(clerkUserData?.first_name || '').trim();
      const lastName = String(clerkUserData?.last_name || '').trim();
      const fullName = `${firstName} ${lastName}`.trim() || null;

      const { data, error } = await (this.supabase.client as any).rpc(
        'sync_clerk_user',
        {
          p_clerk_id: clerkId,
          p_email: primaryEmail || null,
          p_full_name: fullName,
          p_event: event,
          p_default_org_id: this.getDefaultOrgId(),
        },
      );

      if (error) {
        throw new BadRequestException(
          error.message || 'Failed to sync Clerk user',
        );
      }

      const syncResult = (data || {}) as Record<string, any>;

      await this.clearSessionCache(clerkId);
      return { success: true, ...(syncResult || {}) };
    }

    if (event === 'user.deleted') {
      await this.db.user.updateMany({
        where: { clerkId },
        data: { isActive: false },
      });

      await this.clearSessionCache(clerkId);
      return { success: true };
    }

    return { success: true };
  }

  async examLogin(
    userId: string,
    testCode: string,
    slug?: string,
    clientCtx?: { userAgent?: string; clientPlatform?: string },
  ) {
    const whereClause: any = { testCode };
    if (slug) {
      whereClause.slug = slug;
    }

    const exam = await this.db.exam.findFirst({
      where: whereClause,
    });
    if (!exam) throw new UnauthorizedException('Invalid test code');

    if (exam.examMode === 'App' && !this.isAppClient(clientCtx)) {
      throw new UnauthorizedException('APP_REQUIRED');
    }

    const user = await this.db.user.findFirst({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            status: true,
            name: true,
            domain: true,
            features: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User record not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('ACCOUNT_SUSPENDED');
    }

    if (user.organization && user.organization.status !== 'Active') {
      throw new UnauthorizedException(
        `ORG_${user.organization.status.toUpperCase()}:${user.organization.name}`,
      );
    }

    // Same public/scoped-org split used for viewing exams (see
    // exam.service.ts canAccessPublicExamResource): a public-org exam
    // (default/self-serve org) is "accessible by anyone and everyone" —
    // so it must NOT be gated on whichever role/workspace the caller's
    // browser happens to have active right now (X-Active-Org-Id /
    // X-Active-Persona are sent on every request once a user has ever
    // switched workspaces, including this one, and have nothing to do
    // with which exam they're trying to take). A real, member-scoped
    // org's exam resolves the caller's role specifically against THAT
    // org via OrgMembership, ignoring the request's active workspace too
    // — so a student invited to Org B can take Org B's exam even while
    // Org A happens to be their active workspace.
    const isPublicExamOrg = exam.orgId
      ? await this.membershipService.isPublicOrgResource(exam.orgId)
      : false;

    if (isPublicExamOrg) {
      // open to anyone with an active account — no role/membership gate.
    } else if (exam.orgId) {
      const membership = await this.membershipService.resolveActiveMembership(
        user,
        exam.orgId,
      );

      if (
        membership.orgId !== exam.orgId ||
        membership.role === 'TEACHER' ||
        (membership.role !== 'STUDENT' && membership.role !== 'ADMIN')
      ) {
        throw new UnauthorizedException(
          'Access denied. Valid student credentials required.',
        );
      }
    } else if (exam.creatorId !== user.id) {
      throw new UnauthorizedException(
        'This exam does not belong to your organization',
      );
    }

    const existingSession = await this.db.examSession.findFirst({
      where: { userId: user.id, examId: exam.id },
      orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
    });

    if (existingSession) {
      if (existingSession.status === 'TERMINATED') {
        throw new UnauthorizedException('EXAM_TERMINATED');
      }
      if (existingSession.status === 'COMPLETED') {
        throw new ConflictException('EXAM_ALREADY_SUBMITTED');
      }
    }

    const orgSlug = this.getOrgSlug(user.organization?.domain);
    const postLoginUrl = this.buildOrgUrl(orgSlug);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
        rollNumber: user.rollNumber,
        department: user.department,
        profilePicture: user.profilePicture,
        features: user.organization?.features || {},
        mustChangePassword: user.mustChangePassword,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        otp_enabled: false,
      },
      primaryOrganization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            domain: user.organization.domain,
            slug: orgSlug,
          }
        : null,
      postLoginUrl,
      exam: {
        id: exam.id,
        slug: exam.slug,
        title: exam.title,
      },
    };
  }

  async verifyExamTestCode(testCode: string, slug?: string) {
    const normalizedCode = String(testCode || '').trim();
    const normalizedSlug = String(slug || '').trim();

    if (!normalizedCode) {
      throw new UnauthorizedException('Test code is required');
    }

    const whereClause: any = { testCode: normalizedCode };
    if (normalizedSlug) {
      whereClause.slug = normalizedSlug;
    }

    const exam = await this.db.exam.findFirst({
      where: whereClause,
      select: { id: true, slug: true, title: true, isActive: true },
    });

    if (!exam) {
      throw new UnauthorizedException('Invalid test code');
    }

    if (!exam.isActive) {
      throw new UnauthorizedException('Exam is not active');
    }

    return {
      valid: true,
      exam: {
        id: exam.id,
        slug: exam.slug,
        title: exam.title,
      },
    };
  }

  async updateProfile(
    userId: string,
    data: { name?: string; profilePicture?: string },
  ) {
    if (data.profilePicture) {
      const existingUser = await this.db.user.findUnique({
        where: { id: userId },
        select: { profilePicture: true, orgId: true },
      });
      if (existingUser?.profilePicture) {
        await this.storageService.deleteFile(
          existingUser.profilePicture,
          existingUser.orgId || undefined,
        );
      }
    }

    const updatedUser = await this.db.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        profilePicture: data.profilePicture,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rollNumber: true,
        profilePicture: true,
        clerkId: true,
      },
    });

    await this.clearSessionCache(userId, updatedUser.clerkId);

    return updatedUser;
  }

  async removeProfilePicture(userId: string) {
    const existingUser = await this.db.user.findUnique({
      where: { id: userId },
      select: { profilePicture: true, clerkId: true, orgId: true },
    });

    if (existingUser?.profilePicture) {
      await this.storageService.deleteFile(
        existingUser.profilePicture,
        existingUser.orgId || undefined,
      );
    }

    const updatedUser = await this.db.user.update({
      where: { id: userId },
      data: { profilePicture: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rollNumber: true,
        profilePicture: true,
        clerkId: true,
      },
    });

    await this.clearSessionCache(userId, existingUser?.clerkId);

    return updatedUser;
  }

  async selectRole(userId: string, role: Role) {
    if (role !== Role.STUDENT && role !== Role.TEACHER) {
      throw new BadRequestException('Role must be STUDENT or TEACHER');
    }

    const existingUser = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        needsRoleSelection: true,
        clerkId: true,
        role: true,
      },
    });

    if (!existingUser) {
      throw new UnauthorizedException('User not found');
    }

    if (existingUser.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Cannot change Super Admin role through role selection',
      );
    }

    if (!existingUser.needsRoleSelection) {
      const alreadySelectedUser =
        await this.getUserRoleSelectionPayload(userId);

      if (!alreadySelectedUser) {
        throw new UnauthorizedException('User not found');
      }

      return alreadySelectedUser;
    }

    const roleEnumMeta = await this.getRoleEnumMeta();
    const normalizedRole = String(role).trim().toUpperCase();
    if (
      roleEnumMeta.labels.size > 0 &&
      !roleEnumMeta.labels.has(normalizedRole)
    ) {
      throw new BadRequestException('ROLE_VALUE_NOT_ALLOWED');
    }

    await this.db.$executeRawUnsafe(
      `UPDATE "User" SET "role" = $1::${roleEnumMeta.castType}, "needsRoleSelection" = FALSE WHERE "id" = $2`,
      normalizedRole,
      userId,
    );

    const updatedUser = await this.getUserRoleSelectionPayload(userId);

    if (!updatedUser) {
      throw new UnauthorizedException('User not found');
    }

    await this.clearSessionCache(userId, existingUser.clerkId);

    return updatedUser;
  }

  async selectRoleCreator(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clerkId: true,
        name: true,
        role: true,
        orgId: true,
        needsRoleSelection: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.needsRoleSelection) {
      const alreadySelectedUser =
        await this.getUserRoleSelectionPayload(userId);

      if (!alreadySelectedUser) {
        throw new UnauthorizedException('User not found');
      }

      return alreadySelectedUser;
    }

    // Provision the personal org + TEACHER OrgMembership up front, exactly
    // like the learner-side "Become a Creator" flow. Without the membership
    // row a signup-creator has zero workspaces, so the switcher (and its
    // built-in learner persona entry) never renders for them.
    const persona = await this.orgProvisioningService.ensureCreatorPersona(
      user.id,
    );

    const roleEnumMeta = await this.getRoleEnumMeta();
    await this.db.$executeRawUnsafe(
      `UPDATE "User" SET "role" = $1::${roleEnumMeta.castType}, "needsRoleSelection" = FALSE, "orgId" = COALESCE("orgId", $2), "lastActiveOrgId" = $2 WHERE "id" = $3`,
      Role.TEACHER,
      persona.orgId,
      user.id,
    );

    await this.clearSessionCache(userId, user.clerkId);

    return this.getUserRoleSelectionPayload(user.id);
  }

  async completeOnboarding(userId: string) {
    let existingUser: any;
    try {
      existingUser = await this.db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          clerkId: true,
          hasCompletedOnboarding: true,
        } as any,
      });
      this.hasOnboardingColumn = true;
    } catch (error) {
      if (!this.isMissingOnboardingColumnError(error)) {
        throw error;
      }

      this.hasOnboardingColumn = false;
      const legacyUser = await this.db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          clerkId: true,
        },
      });
      existingUser = legacyUser
        ? { ...legacyUser, hasCompletedOnboarding: false }
        : null;
    }

    if (!existingUser) {
      throw new UnauthorizedException('User not found');
    }

    if (
      !existingUser.hasCompletedOnboarding &&
      this.hasOnboardingColumn !== false
    ) {
      await this.db.user.update({
        where: { id: userId },
        data: { hasCompletedOnboarding: true } as any,
      });
    }

    await this.clearSessionCache(userId, existingUser.clerkId);

    return { success: true, hasCompletedOnboarding: true };
  }

  private countWordsFromHtml(html: string): number {
    if (!html) return 0;
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return 0;
    return text.split(' ').filter(Boolean).length;
  }

  async createBugReport(
    user: any,
    data: {
      title: string;
      description: string;
      attachments?: { name: string; url: string; type: string; size: number }[];
    },
  ) {
    if (!user?.id) throw new UnauthorizedException('Invalid session');
    if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException(
        'Only students, teachers, and admins can report problems',
      );
    }

    const title = data?.title?.trim();
    if (!title) throw new BadRequestException('Title is required');
    if (title.length > 120)
      throw new BadRequestException('Title must be 120 characters or less');

    const description = data?.description?.trim();
    if (!description) throw new BadRequestException('Description is required');

    const wordCount = this.countWordsFromHtml(description);
    if (wordCount === 0)
      throw new BadRequestException('Description is required');
    if (wordCount > 500)
      throw new BadRequestException('Description must be 500 words or less');

    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    if (attachments.length > 5) {
      throw new BadRequestException('You can attach at most 5 images');
    }

    const allowedImageTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]);
    for (const file of attachments) {
      if (!file?.url || !file?.name || !file?.type) {
        throw new BadRequestException('Invalid attachment payload');
      }
      if (!allowedImageTypes.has(file.type)) {
        throw new BadRequestException('Attachments must be image files only');
      }
      if (typeof file.size === 'number' && file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Each image must be less than 5MB');
      }
    }

    return this.db.bugReport.create({
      data: {
        title,
        description,
        attachments,
        reporterRole: user.role,
        reporterId: user.id,
        orgId: user.orgId || null,
      },
    });
  }
}
