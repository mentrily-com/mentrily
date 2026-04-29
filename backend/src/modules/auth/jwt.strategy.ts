import * as crypto from 'crypto';
import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  CanActivate,
  ExecutionContext,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../services/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { verifyToken, createClerkClient } from '@clerk/backend';
import {
  PLAN_FEATURES,
  PlanKey,
  getEffectivePlanLimits,
} from '../../config/plan-limits';
import { QuotaService } from '../billing/quota.service';
import { OrgProvisioningService } from '../organization/org-provisioning.service';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly reservedSubdomains = new Set(['www', 'app', 'api', 'admin']);
  private readonly logger = new Logger(ClerkAuthGuard.name);
  private roleEnumMeta:
    | {
        castType: string;
        labels: Set<string>;
      }
    | undefined;
  private hasOnboardingColumn: boolean | null = null;

  constructor(
    private readonly configService: ConfigService,
    private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @Optional() private readonly quotaService?: QuotaService,
    @Optional() private readonly orgProvisioningService?: OrgProvisioningService,
  ) {}

  private getRootDomain(): string {
    return String(
      process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || '',
    )
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/:\d+$/, '');
  }

  private parseSubdomainFromHost(host?: string | null): string | null {
    const value = String(host || '')
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '');

    if (!value) return null;

    if (value === 'localhost' || value.endsWith('.localhost')) {
      const localParts = value.split('.');
      if (localParts.length > 1) {
        const localSubdomain = localParts[0] || null;
        if (!localSubdomain || this.reservedSubdomains.has(localSubdomain)) {
          return null;
        }
        return localSubdomain;
      }
      return null;
    }

    const rootDomain = this.getRootDomain();
    if (!rootDomain || !value.endsWith(`.${rootDomain}`)) {
      return null;
    }

    const prefix = value.slice(0, -`.${rootDomain}`.length);
    if (!prefix) return null;

    const subdomain = prefix.split('.')[0] || null;
    if (!subdomain || this.reservedSubdomains.has(subdomain)) {
      return null;
    }

    return subdomain;
  }

  private async resolveOrganizationIdBySubdomain(
    subdomain: string,
  ): Promise<string | null> {
    const key = `org:subdomain:${subdomain}`;
    const cached = await this.redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed?.id || null;
    }

    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { domain: { equals: subdomain, mode: 'insensitive' } },
          { domain: { startsWith: `${subdomain}.`, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (!org) {
      return null;
    }

    await this.redis.set(key, JSON.stringify(org), 'EX', 900);
    return org.id;
  }

  private getDefaultOrgId(): string | null {
    const value = String(process.env.DEFAULT_ORG_ID || '').trim();
    return value || null;
  }

  private getAuthorizedParties(): string[] {
    const envValue = String(
      process.env.CLERK_AUTHORIZED_PARTIES ||
        process.env.AUTHORIZED_PARTIES ||
        '',
    ).trim();

    const fromEnv = envValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const appDomain = this.getRootDomain();
    const defaults = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      appDomain ? `https://${appDomain}` : '',
      appDomain ? `https://www.${appDomain}` : '',
    ].filter(Boolean);

    return Array.from(new Set([...fromEnv, ...defaults]));
  }

  private normalizePrimaryEmail(payload: any): string {
    return String(payload?.email || payload?.email_address || '')
      .trim()
      .toLowerCase();
  }

  private deriveDisplayName(payload: any): string | null {
    const firstName = String(
      payload?.first_name || payload?.given_name || '',
    ).trim();
    const lastName = String(
      payload?.last_name || payload?.family_name || '',
    ).trim();
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || null;
  }

  private normalizeRoleValue(
    role: unknown,
  ): 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN' | null {
    const value = String(role || '')
      .trim()
      .toUpperCase();

    if (
      value !== 'STUDENT' &&
      value !== 'TEACHER' &&
      value !== 'ADMIN' &&
      value !== 'SUPER_ADMIN'
    ) {
      return null;
    }

    return value;
  }

  private async getRoleEnumMeta(client: any): Promise<{
    castType: string;
    labels: Set<string>;
  }> {
    if (this.roleEnumMeta) {
      return this.roleEnumMeta;
    }

    const columnRows = (await client.$queryRawUnsafe(
      `
        SELECT c.udt_schema, c.udt_name
        FROM information_schema.columns c
        WHERE c.table_schema = current_schema()
          AND c.table_name = 'User'
          AND c.column_name = 'role'
        LIMIT 1
      `,
    )) as Array<{ udt_schema?: string; udt_name?: string }>;

    const udtSchema = String(columnRows?.[0]?.udt_schema || '').trim();
    const udtName = String(columnRows?.[0]?.udt_name || '').trim();

    if (!udtSchema || !udtName) {
      throw new UnauthorizedException('ROLE_COLUMN_METADATA_MISSING');
    }

    const enumRows = (await client.$queryRawUnsafe(
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
    )) as Array<{ enumlabel?: string }>;

    const labels = new Set(
      enumRows
        .map((row) => String(row?.enumlabel || '').trim().toUpperCase())
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

  private async setUserRoleCompat(
    client: any,
    userId: string,
    role: unknown,
    orgId?: string | null,
  ): Promise<void> {
    const normalizedRole = this.normalizeRoleValue(role);
    if (!normalizedRole) {
      return;
    }

    const roleEnumMeta = await this.getRoleEnumMeta(client);
    if (
      roleEnumMeta.labels.size > 0 &&
      !roleEnumMeta.labels.has(normalizedRole)
    ) {
      throw new UnauthorizedException('ROLE_VALUE_NOT_ALLOWED');
    }

    if (orgId) {
      await client.$executeRawUnsafe(
        `UPDATE "User" SET "role" = $1::${roleEnumMeta.castType}, "orgId" = $2 WHERE "id" = $3`,
        normalizedRole,
        orgId,
        userId,
      );
      return;
    }

    await client.$executeRawUnsafe(
      `UPDATE "User" SET "role" = $1::${roleEnumMeta.castType} WHERE "id" = $2`,
      normalizedRole,
      userId,
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

  private normalizeLegacyUser<T extends Record<string, any> | null>(
    user: T,
  ): T {
    if (!user) return user;
    return {
      ...user,
      hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
    } as T;
  }

  private async findSessionUser(where: any) {
    const baseSelect = {
      id: true,
      clerkId: true,
      email: true,
      role: true,
      isActive: true,
      orgId: true,
      profilePicture: true,
      name: true,
      rollNumber: true,
      department: true,
      needsRoleSelection: true,
      mustChangePassword: true,
      createdAt: true,
      organization: {
        select: {
          domain: true,
          features: true,
          plan: true,
          planStatus: true,
          studentCount: true,
          courseCount: true,
          storageUsedMb: true,
          teacherSeatCount: true,
        } as any,
      },
    } as const;

    const select =
      this.hasOnboardingColumn === false
        ? baseSelect
        : ({
            ...baseSelect,
            hasCompletedOnboarding: true,
          } as const);

    try {
      const user = await this.prisma.user.findFirst({
        where,
        select: select as any,
      });
      this.hasOnboardingColumn = true;
      return this.normalizeLegacyUser(user as any);
    } catch (error) {
      if (this.isDatabaseConnectionError(error)) {
        this.logger.error(
          `Database connection failed while resolving session user: ${this.getErrorMessage(error)}`,
        );
        throw new ServiceUnavailableException(
          'Database is temporarily unavailable.',
        );
      }

      if (!this.isMissingOnboardingColumnError(error)) {
        throw error;
      }

      this.hasOnboardingColumn = false;
      const legacyUser = await this.prisma.user.findFirst({
        where,
        select: baseSelect as any,
      });
      return this.normalizeLegacyUser(legacyUser as any);
    }
  }

  private isDatabaseConnectionError(error: unknown): boolean {
    const message = this.getErrorMessage(error).toLowerCase();
    return (
      message.includes("can't reach database server") ||
      message.includes('connection refused') ||
      message.includes('network is unreachable') ||
      message.includes('connect_timeout') ||
      message.includes('connection timed out')
    );
  }

  private getErrorMessage(error: unknown): string {
    return String((error as any)?.message || error || '');
  }

  private async ensureOnboardingColumnState(): Promise<boolean> {
    if (this.hasOnboardingColumn !== null) {
      return this.hasOnboardingColumn;
    }

    const rows = await this.prisma.$queryRawUnsafe(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'User'
          AND column_name = 'hasCompletedOnboarding'
        LIMIT 1
      `,
    );

    this.hasOnboardingColumn = Array.isArray(rows) && rows.length > 0;
    return this.hasOnboardingColumn;
  }

  private async findLegacyUserByColumn(
    client: any,
    column: 'clerkId' | 'email' | 'id',
    value: string,
  ) {
    const whereSql =
      column === 'email'
        ? `LOWER("email") = LOWER($1)`
        : `"${column}" = $1`;

    const rows = await client.$queryRawUnsafe(
      `
        SELECT "id", "email", "clerkId", "name", "orgId", "role", "needsRoleSelection", "department", "rollNumber"
        FROM "User"
        WHERE ${whereSql}
        LIMIT 1
      `,
      value,
    );

    return (rows as any[])?.[0] || null;
  }

  private async createUserCompat(
    client: any,
    input: {
      clerkId: string;
      email: string;
      name: string | null;
      orgId?: string | null;
      needsRoleSelection: boolean;
      role?: unknown;
      department?: string | null;
      rollNumber?: string | null;
    },
  ) {
    const normalizedRole = this.normalizeRoleValue(input.role) || 'STUDENT';

    const roleEnumMeta = await this.getRoleEnumMeta(client);
    if (
      roleEnumMeta.labels.size > 0 &&
      !roleEnumMeta.labels.has(normalizedRole)
    ) {
      throw new UnauthorizedException('ROLE_VALUE_NOT_ALLOWED');
    }

    const newUserId = crypto.randomUUID();
    const createdRows = (await client.$queryRawUnsafe(
      `INSERT INTO "User" ("id", "email", "clerkId", "name", "orgId", "needsRoleSelection", "isActive", "updatedAt", "role", "department", "rollNumber") VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), $7::${roleEnumMeta.castType}, $8, $9) RETURNING "id"`,
      newUserId,
      input.email,
      input.clerkId,
      input.name,
      input.orgId || null,
      input.needsRoleSelection,
      normalizedRole,
      input.department || null,
      input.rollNumber || null,
    )) as Array<{ id?: string }>;

    const createdId = String(createdRows?.[0]?.id || '').trim();
    if (!createdId) {
      throw new UnauthorizedException('USER_PROVISIONING_FAILED');
    }

    const created = await this.findLegacyUserByColumn(client, 'id', createdId);

    if (!created) {
      throw new UnauthorizedException('USER_PROVISIONING_FAILED');
    }

    return this.normalizeLegacyUser(created);
  }

  private async enrichPayloadFromClerk(
    clerkId: string,
    payload: any,
    secretKey: string,
  ): Promise<any> {
    const hasEmail = Boolean(this.normalizePrimaryEmail(payload));
    if (hasEmail) {
      return payload;
    }

    try {
      const clerkClient = createClerkClient({ secretKey });
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const primaryEmailId = clerkUser.primaryEmailAddressId || null;
      const primaryEmail =
        clerkUser.emailAddresses.find((email) => email.id === primaryEmailId)
          ?.emailAddress ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        null;

      return {
        ...payload,
        email: primaryEmail,
        email_address: primaryEmail,
        first_name: payload?.first_name || clerkUser.firstName || undefined,
        last_name: payload?.last_name || clerkUser.lastName || undefined,
        given_name: payload?.given_name || clerkUser.firstName || undefined,
        family_name: payload?.family_name || clerkUser.lastName || undefined,
      };
    } catch {
      return payload;
    }
  }

  private async provisionUserFromClerkPayload(
    clerkId: string,
    payload: any,
    options?: { forceRoleSelection?: boolean },
  ) {
    const email = this.normalizePrimaryEmail(payload);
    if (!email) {
      return null;
    }

    const provisioned = await this.prisma.$transaction(async (tx) => {
      const byClerkId: any = await this.findLegacyUserByColumn(
        tx,
        'clerkId',
        clerkId,
      );
      if (byClerkId) {
        return {
          user: byClerkId,
          invitedTeacherOrgId: null as string | null,
        };
      }

      const byEmail: any = await this.findLegacyUserByColumn(tx, 'email', email);
      const pendingInvite = await tx.pendingInvite.findUnique({
        where: { email },
      });
      const pendingInviteRole = this.normalizeRoleValue(pendingInvite?.role);
      const inviteCounter =
        pendingInvite && pendingInviteRole
          ? {
              orgId: pendingInvite.orgId as string,
              role: pendingInviteRole,
            }
          : null;
      const isPrivilegedRole = byEmail?.role === 'SUPER_ADMIN';

      if (byEmail) {
        const shouldForceRoleSelection =
          options?.forceRoleSelection === true && byEmail.role === 'STUDENT';

        await tx.user.updateMany({
          where: { id: byEmail.id },
          data: {
            clerkId,
            name:
              this.deriveDisplayName(payload) ||
              (pendingInvite as any)?.name ||
              byEmail.name,
            rollNumber: (pendingInvite as any)?.rollNumber || byEmail.rollNumber,
            department:
              (pendingInvite as any)?.department || byEmail.department,
            needsRoleSelection: isPrivilegedRole
              ? false
              : pendingInvite
                ? false
                : shouldForceRoleSelection
                  ? true
                  : byEmail.needsRoleSelection,
            ...(pendingInvite && !isPrivilegedRole
              ? {
                  orgId: pendingInvite.orgId,
                }
              : {}),
          },
        });

        const updated = await this.findLegacyUserByColumn(tx, 'id', byEmail.id);
        if (!updated) {
          throw new UnauthorizedException('USER_PROVISIONING_FAILED');
        }

        if (pendingInvite && !isPrivilegedRole && pendingInviteRole) {
          await this.setUserRoleCompat(
            tx,
            updated.id,
            pendingInviteRole,
            pendingInvite.orgId,
          );
        }

        if (pendingInvite) {
          await tx.pendingInvite.delete({ where: { id: pendingInvite.id } });
        }

        return {
          user: updated,
          inviteCounter:
            pendingInvite &&
            !isPrivilegedRole &&
            (byEmail.orgId !== pendingInvite.orgId ||
              byEmail.role !== pendingInviteRole)
              ? inviteCounter
              : null,
        };
      }

      const created = await this.createUserCompat(tx, {
        clerkId,
        email,
        name: this.deriveDisplayName(payload) || (pendingInvite as any)?.name,
        orgId: pendingInvite ? pendingInvite.orgId : null,
        needsRoleSelection: pendingInvite ? false : true,
        role: pendingInviteRole || 'STUDENT',
        department: (pendingInvite as any)?.department || null,
        rollNumber: (pendingInvite as any)?.rollNumber || null,
      });

      if (pendingInvite) {
        await tx.pendingInvite.delete({ where: { id: pendingInvite.id } });
      }

      return {
        user: created,
        inviteCounter,
      };
    });

    if (provisioned?.inviteCounter && this.quotaService) {
      const counterField =
        provisioned.inviteCounter.role === 'STUDENT'
          ? 'studentCount'
          : 'teacherSeatCount';
      await this.quotaService.incrementCounter(
        provisioned.inviteCounter.orgId,
        counterField,
        1,
      );
    }

    return provisioned?.user || null;
  }

  private async isDefaultOrganizationUser(sessionUser: any): Promise<boolean> {
    const defaultOrgId = this.getDefaultOrgId();
    if (defaultOrgId && sessionUser?.orgId === defaultOrgId) {
      return true;
    }

    const orgDomain = String(sessionUser?.orgDomain || '')
      .trim()
      .toLowerCase();
    if (orgDomain === 'default') {
      return true;
    }

    if (!sessionUser?.orgId) {
      return false;
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: sessionUser.orgId },
      select: { domain: true },
    });

    return (
      String(org?.domain || '')
        .trim()
        .toLowerCase() === 'default'
    );
  }

  private async enforceTenantAccess(req: any, sessionUser: any): Promise<void> {
    const tenantSubdomainFromHeader = String(
      req?.headers?.['x-org-subdomain'] || '',
    )
      .trim()
      .toLowerCase();
    const tenantHost =
      req?.headers?.['x-tenant-host'] || req?.headers?.host || null;
    const tenantSubdomain =
      tenantSubdomainFromHeader || this.parseSubdomainFromHost(tenantHost);

    if (sessionUser?.role === 'SUPER_ADMIN') {
      return;
    }

    const isDefaultOrgUser = await this.isDefaultOrganizationUser(sessionUser);

    if (tenantSubdomain && isDefaultOrgUser) {
      throw new ForbiddenException(
        'Default org users cannot access org subdomains',
      );
    }

    if (!tenantSubdomain) {
      return;
    }

    const orgIdForSubdomain =
      await this.resolveOrganizationIdBySubdomain(tenantSubdomain);

    if (!orgIdForSubdomain) {
      throw new ForbiddenException('Organization not found for this subdomain');
    }

    if (!sessionUser?.orgId || sessionUser.orgId !== orgIdForSubdomain) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    req.tenantOrgId = orgIdForSubdomain;
    req.tenantSubdomain = tenantSubdomain;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const requestUrl = String(req?.url || req?.originalUrl || '');

    const rawQuery: Record<string, unknown> =
      req?.query && typeof req.query === 'object' ? req.query : {};

    const getQueryValue = (key: string): string => {
      const directValue = rawQuery?.[key];
      if (Array.isArray(directValue)) {
        return String(directValue[0] || '').trim();
      }
      if (directValue !== undefined && directValue !== null) {
        return String(directValue).trim();
      }

      const fallbackUrl = String(req?.originalUrl || req?.url || '');
      const queryString = fallbackUrl.includes('?')
        ? fallbackUrl.slice(fallbackUrl.indexOf('?') + 1)
        : '';
      if (!queryString) return '';

      const fallbackSearch = new URLSearchParams(queryString);
      return String(fallbackSearch.get(key) || '').trim();
    };

    const strictQueryValue = getQueryValue('strict').toLowerCase();
    const flowQueryValue = getQueryValue('flow').toLowerCase();
    const allowProvisioningQueryValue = getQueryValue(
      'allowProvisioning',
    ).toLowerCase();

    const isAuthMeRoute = requestUrl.includes('/auth/me');
    const hasStrictFlag =
      strictQueryValue === '1' || strictQueryValue === 'true';
    const authFlow = flowQueryValue;
    const isExplicitRegistrationFlow =
      authFlow === 'signup' || authFlow === 'registration';
    const allowProvisioningFlag =
      allowProvisioningQueryValue === '1' ||
      allowProvisioningQueryValue === 'true';
    const shouldProvisionMissingUser =
      isExplicitRegistrationFlow || allowProvisioningFlag;
    const isStrictExistingAuthCheck =
      (isAuthMeRoute && !shouldProvisionMissingUser) || hasStrictFlag;

    const authHeader = String(req?.headers?.authorization || '');
    const bearerToken =
      authHeader
        .match(/^Bearer\s+(.+)$/i)?.[1]
        ?.trim()
        ?.replace(/^"|"$/g, '') || null;
    const cookieToken = req?.cookies?.__session || null;
    const token = bearerToken || cookieToken;

    const decodeJwtPayload = (jwt: string | null) => {
      if (!jwt || !jwt.includes('.')) return null;
      try {
        const payloadPart = jwt.split('.')[1];
        const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(
          Math.ceil(normalized.length / 4) * 4,
          '=',
        );
        const json = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(json);
      } catch {
        return null;
      }
    };

    if (!token) {
      this.logger.warn(
        '[AUTH_MISSING_TOKEN] No bearer token or __session cookie received',
      );
      throw new UnauthorizedException();
    }

    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new UnauthorizedException('Missing CLERK_SECRET_KEY');
    }

    let payload: any;
    try {
      const audienceValue = String(process.env.CLERK_JWT_AUDIENCE || '').trim();
      const strictVerifyOptions: {
        secretKey: string;
        authorizedParties?: string[];
        audience?: string;
        clockSkewInMs: number;
      } = {
        secretKey,
        clockSkewInMs: 60_000,
      };

      const authorizedParties = this.getAuthorizedParties();
      if (authorizedParties.length > 0) {
        strictVerifyOptions.authorizedParties = authorizedParties;
      }

      if (audienceValue) {
        strictVerifyOptions.audience = audienceValue;
      }

      try {
        payload = await verifyToken(token, strictVerifyOptions);
      } catch (strictError: any) {
        const relaxedVerifyOptions: {
          secretKey: string;
          audience?: string;
          clockSkewInMs: number;
        } = {
          secretKey,
          clockSkewInMs: 60_000,
        };

        if (audienceValue) {
          relaxedVerifyOptions.audience = audienceValue;
        }

        payload = await verifyToken(token, relaxedVerifyOptions);
        this.logger.warn(
          `[AUTH_VERIFY_RELAXED] strict verification failed, relaxed verification accepted token: ${strictError?.reason || strictError?.message || 'unknown'}`,
        );
      }
    } catch (error: any) {
      const tokenPreview =
        typeof token === 'string' ? `${token.slice(0, 18)}...` : 'none';
      const decodedPayload = decodeJwtPayload(token);
      const details = {
        hasBearer: Boolean(bearerToken),
        hasCookieToken: Boolean(cookieToken),
        tokenPreview,
        message: error?.message || 'verifyToken_failed',
        code: error?.code,
        status: error?.status,
        reason: error?.reason,
        decodedIss: decodedPayload?.iss,
        decodedAzp: decodedPayload?.azp,
        decodedAud: decodedPayload?.aud,
        decodedSub: decodedPayload?.sub,
        allowedAzp: this.getAuthorizedParties(),
      };
      this.logger.warn(`[AUTH_VERIFY_FAILED] ${JSON.stringify(details)}`);
      console.warn('[AUTH_VERIFY_FAILED]', details);
      throw new UnauthorizedException();
    }

    const clerkId = payload?.sub;
    if (!clerkId) {
      throw new UnauthorizedException();
    }

    const cacheKey = `user:session:${clerkId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const cachedUser = JSON.parse(cached);
      await this.enforceTenantAccess(req, cachedUser);
      req.user = cachedUser;
      return true;
    }

    const effectivePayload = await this.enrichPayloadFromClerk(
      clerkId,
      payload,
      secretKey,
    );

    let user: any = await this.findSessionUser({ clerkId });

    const payloadEmail = this.normalizePrimaryEmail(effectivePayload);

    if (!user && payloadEmail) {
      user = await this.findSessionUser({
        email: {
          equals: payloadEmail,
          mode: 'insensitive',
        },
      });

      if (user && user.clerkId !== clerkId) {
        await this.prisma.user.updateMany({
          where: { id: user.id },
          data: {
            clerkId,
          },
        });
        user = {
          ...user,
          clerkId,
        };
      }
    }

    if (!user && !isStrictExistingAuthCheck && shouldProvisionMissingUser) {
      const provisioned = await this.provisionUserFromClerkPayload(
        clerkId,
        effectivePayload,
        {
          forceRoleSelection: isExplicitRegistrationFlow,
        },
      );
      if (provisioned) {
        const freshUser = await this.findSessionUser({
          id: String(provisioned.id),
        });
        
        if (!freshUser) {
          this.logger.error(`[CRITICAL_BUG] User provisioned id=${provisioned.id} but findFirst returned null!`);
          user = provisioned;
        } else {
          user = freshUser;
        }
      }
    }

    const shouldEnforceSignupRoleSelection =
      isAuthMeRoute && (isExplicitRegistrationFlow || allowProvisioningFlag);

    if (
      user &&
      shouldEnforceSignupRoleSelection &&
      user.role === 'STUDENT' &&
      user.needsRoleSelection === false
    ) {
      const createdRecently = user.createdAt
        ? Date.now() - new Date(user.createdAt).getTime() <= 30 * 60 * 1000
        : false;

      if (createdRecently) {
        await this.prisma.user.updateMany({
          where: { id: user.id },
          data: { needsRoleSelection: true },
        });
        user = {
          ...user,
          needsRoleSelection: true,
        };
      }
    }

    if (!user || user.isActive === false) {
      this.logger.warn(
        `[AUTH_USER_NOT_RESOLVED] clerkId=${clerkId} email=${payloadEmail || 'none'} active=${user?.isActive ?? 'none'}`,
      );
      throw new UnauthorizedException('ACCOUNT_SUSPENDED');
    }

    if (user?.id && this.orgProvisioningService) {
      const normalizedAccidentalFreeOrg =
        await this.orgProvisioningService.normalizeAccidentalFreeOrgForUser(
          user.id,
        );

      if (normalizedAccidentalFreeOrg) {
        const refreshedUser = await this.findSessionUser({
          id: user.id,
        });

        if (refreshedUser) {
          user = refreshedUser as any;
        }
      }
    }

    const plan = (user.organization?.plan as PlanKey) || 'FREE';
    const baseFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.FREE;
    const overrides =
      user.organization?.features &&
      typeof user.organization.features === 'object' &&
      !Array.isArray(user.organization.features)
        ? (user.organization.features as Record<string, unknown>)
        : {};

    const effectiveFeatures = {
      ...baseFeatures,
      ...overrides,
    };

    const orgUsage = user.orgId
      ? {
          students: Number(user.organization?.studentCount || 0),
          courses: Number(user.organization?.courseCount || 0),
          storageMb: Number(user.organization?.storageUsedMb || 0),
          seats: Number(user.organization?.teacherSeatCount || 0),
          adminSeats: await this.prisma.user.count({
            where: { orgId: user.orgId, role: 'ADMIN' },
          }),
          teacherSeats: await this.prisma.user.count({
            where: { orgId: user.orgId, role: 'TEACHER' },
          }),
          monthlyExams: await this.prisma.usageLedger.count({
            where: {
              orgId: user.orgId,
              eventType: 'exam.created',
              createdAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
          }),
        }
      : this.quotaService
        ? await this.quotaService.getPersonalUsage(user.id)
        : {
            students: 0,
            courses: 0,
            storageMb: 0,
            seats: 1,
            adminSeats: 0,
            teacherSeats: 0,
            monthlyExams: 0,
          };

    const legacyFeatureFlags = {
      allowAIProctoring: Boolean((effectiveFeatures as any).proctoring),
      allowCourseTests: true,
      allowAppExams: true,
    };

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      rollNumber: user.rollNumber,
      department: user.department,
      profilePicture: user.profilePicture,
      orgDomain: user.organization?.domain || null,
      features: {
        ...legacyFeatureFlags,
        ...overrides,
      },
      plan,
      planStatus: user.organization?.planStatus || 'ACTIVE',
      effectiveFeatures,
      limits: getEffectivePlanLimits(plan, user.organization?.features),
      usage: orgUsage,
      needsRoleSelection: user.needsRoleSelection,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      mustChangePassword: user.mustChangePassword,
    };

    await this.enforceTenantAccess(req, sessionUser);
    await this.redis.set(cacheKey, JSON.stringify(sessionUser), 'EX', 300);

    req.user = sessionUser;
    return true;
  }
}
