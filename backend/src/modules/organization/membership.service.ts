import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { PrismaService } from '../../services/prisma/prisma.service';
import { Role } from '@prisma/client';

export interface ResolvedOrgContext {
  orgId: string | null;
  role: Role;
}

export interface MembershipSummary {
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  role: Role;
  isHome: boolean;
}

/**
 * A person's home org (User.orgId/role) is never mutated by this service —
 * every method here only ever reads it or adds an additive OrgMembership
 * row alongside it. Switching orgs never touches another org's data.
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private getDefaultOrgId(): string | null {
    const value = String(process.env.DEFAULT_ORG_ID || '').trim();
    return value || null;
  }

  /**
   * A resource's org counts as "public" (open surface, not member-scoped)
   * if it's DEFAULT_ORG_ID, or if it's a self-serve Creator's own
   * auto-provisioned personal org (Organization.provisionedFromUserId is
   * set — see org-provisioning.service.ts ensureCreatorPersona). Only an
   * org a super-admin explicitly created through org management (no
   * provisionedFromUserId) is a real, member-scoped tenant. Shared by any
   * flow that needs to distinguish "open to everyone" orgs from real
   * tenants — e.g. exam.service.ts's canAccessPublicExamResource and
   * auth.service.ts's examLogin use the same cache key/logic here.
   */
  async isPublicOrgResource(
    orgId: string | null | undefined,
  ): Promise<boolean> {
    if (!orgId) return false;

    const defaultOrgId = this.getDefaultOrgId();
    if (defaultOrgId && orgId === defaultOrgId) return true;

    const cacheKey = `org:is-public-surface:${orgId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return cached === '1';

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { provisionedFromUserId: true },
    });
    const isPublic = Boolean(org?.provisionedFromUserId);
    await this.redis.set(cacheKey, isPublic ? '1' : '0', 'EX', 300);
    return isPublic;
  }

  /**
   * Idempotent: makes sure the user's home org (if any) has a matching
   * OrgMembership row, so it always shows up in listMemberships() and can be
   * switched back to like any other membership. Safe to call on every
   * request — a single indexed upsert, no-op once it exists.
   */
  async ensureHomeMembership(user: {
    id: string;
    orgId: string | null;
    role: Role;
  }): Promise<void> {
    if (!user.orgId) return;

    await this.prisma.orgMembership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: user.orgId } },
      update: {},
      create: {
        userId: user.id,
        orgId: user.orgId,
        role: user.role,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Resolves which org/role should govern this request: the explicitly
   * requested org (X-Active-Org-Id header) if the user actually has an
   * active membership there, else their last-active org, else their home
   * org. Never trusts the header alone — always checks membership.
   */
  async resolveActiveMembership(
    user: {
      id: string;
      orgId: string | null;
      role: Role;
      lastActiveOrgId?: string | null;
    },
    requestedOrgId?: string | null,
  ): Promise<ResolvedOrgContext> {
    await this.ensureHomeMembership(user);

    const candidates = [requestedOrgId, user.lastActiveOrgId].filter(
      (orgId): orgId is string => Boolean(orgId && orgId.trim()),
    );

    for (const candidateOrgId of candidates) {
      if (candidateOrgId === user.orgId) {
        return { orgId: user.orgId, role: user.role };
      }

      const membership = await this.prisma.orgMembership.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: candidateOrgId } },
        select: { orgId: true, role: true, status: true },
      });

      if (membership && membership.status === 'ACTIVE') {
        return { orgId: membership.orgId, role: membership.role };
      }
    }

    return { orgId: user.orgId, role: user.role };
  }

  async listMemberships(user: {
    id: string;
    orgId: string | null;
    role: Role;
  }): Promise<MembershipSummary[]> {
    await this.ensureHomeMembership(user);

    const memberships = await this.prisma.orgMembership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      select: {
        orgId: true,
        role: true,
        organization: { select: { name: true, slug: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((membership) => ({
      orgId: membership.orgId,
      orgName: membership.organization?.name || 'Untitled organization',
      orgSlug: membership.organization?.slug || null,
      role: membership.role,
      isHome: membership.orgId === user.orgId,
    }));
  }

  /**
   * Validates the target membership, then persists it as lastActiveOrgId so
   * future sessions default there. Does not touch the user's home org.
   */
  async switchActiveOrg(
    user: { id: string; orgId: string | null; role: Role },
    targetOrgId: string,
  ): Promise<ResolvedOrgContext> {
    if (!targetOrgId || !targetOrgId.trim()) {
      throw new NotFoundException('Organization not specified');
    }

    if (targetOrgId === user.orgId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActiveOrgId: targetOrgId },
      });
      return { orgId: user.orgId, role: user.role };
    }

    const membership = await this.prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: targetOrgId } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('You are not a member of that organization');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveOrgId: targetOrgId },
    });

    return { orgId: membership.orgId, role: membership.role };
  }

  /**
   * Returns the user to their home persona: clears lastActiveOrgId so future
   * requests (which carry no X-Active-Org-Id header once the client resets
   * its active org) resolve back to the flat home org/role. Works even when
   * the home is org-less (a plain Learner with no org) — the one case
   * switchActiveOrg() can't express because it requires a target orgId.
   */
  async switchToHome(userId: string): Promise<ResolvedOrgContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveOrgId: null },
    });

    return { orgId: user.orgId ?? null, role: user.role };
  }

  /**
   * Adds (or reactivates/reroles) a membership for an org that is NOT the
   * user's home org, without ever touching User.orgId/role. Used when an
   * already-existing user accepts an invite to a second org.
   */
  async grantMembership(
    userId: string,
    orgId: string,
    role: Role,
  ): Promise<void> {
    await this.prisma.orgMembership.upsert({
      where: { userId_orgId: { userId, orgId } },
      update: { role, status: 'ACTIVE' },
      create: { userId, orgId, role, status: 'ACTIVE' },
    });
  }
}
