import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { PrismaService } from '../../services/prisma/prisma.service';
import { Role } from '@prisma/client';
import {
  OrgKind,
  getOrgKindFromRecord,
  isOpenEnrollmentOrgRecord,
} from './org-kind';

export interface ResolvedOrgContext {
  orgId: string | null;
  role: Role;
}

export interface MembershipSummary {
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  orgDomain: string | null;
  orgKind: OrgKind;
  role: Role;
  isHome: boolean;
}

export interface ActiveMembershipOptions {
  /**
   * When set, STRICT orgs may only become the active workspace if they ARE
   * the tenant org of the request's subdomain — candidates pointing at a
   * strict org from any other host are skipped. Only the auth guard passes
   * this; membership *checks* (e.g. exam entry) must not.
   */
  enforceStrictTenancy?: boolean;
  tenantOrgId?: string | null;
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
      select: { provisionedFromUserId: true, features: true },
    });
    // Open-enrollment orgs (features.openEnrollment, e.g. the beta/tester
    // org) expose their content to enrolled global users just like personal
    // orgs do — enrollment, not membership, is their access gate.
    const isPublic =
      Boolean(org?.provisionedFromUserId) || isOpenEnrollmentOrgRecord(org);
    await this.redis.set(cacheKey, isPublic ? '1' : '0', 'EX', 300);
    return isPublic;
  }

  /**
   * Derived kind of an org (see org-kind.ts). Redis-cached briefly since the
   * auth guard may consult this on every request carrying X-Active-Org-Id.
   */
  async getOrgKind(
    orgId: string | null | undefined,
  ): Promise<{ kind: OrgKind; domain: string | null }> {
    if (!orgId) return { kind: 'PERSONAL', domain: null };

    const cacheKey = `org:kind:${orgId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const [kind, ...domainParts] = cached.split('|');
      return {
        kind: kind as OrgKind,
        domain: domainParts.join('|') || null,
      };
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { domain: true, provisionedFromUserId: true, features: true },
    });
    const kind = getOrgKindFromRecord(org, {
      isDefaultOrg: orgId === this.getDefaultOrgId(),
    });
    const domain = org?.domain || null;
    await this.redis.set(cacheKey, `${kind}|${domain ?? ''}`, 'EX', 300);
    return { kind, domain };
  }

  async isStrictOrg(orgId: string | null | undefined): Promise<boolean> {
    return (await this.getOrgKind(orgId)).kind === 'STRICT';
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
    options?: ActiveMembershipOptions,
  ): Promise<ResolvedOrgContext> {
    await this.ensureHomeMembership(user);

    // A STRICT org's workspace is only usable on its own subdomain. Skip
    // strict candidates (header / lastActiveOrgId) when the request isn't
    // on that org's host — they fall through to the home-org fallback,
    // which stays unfiltered so a strict-home user logging in at the apex
    // is never locked out.
    const isCandidateAllowed = async (orgId: string): Promise<boolean> => {
      if (!options?.enforceStrictTenancy) return true;
      if (orgId === options.tenantOrgId) return true;
      return (await this.getOrgKind(orgId)).kind !== 'STRICT';
    };

    // ensureHomeMembership guarantees a row exists for the home org too, so
    // a suspension there (an admin restricting THIS person's access to
    // THIS org) must be honored the same way an additive membership's
    // status already is below — otherwise suspending someone's home org
    // membership would have no effect, since the flat User.orgId/role
    // columns are trusted unconditionally.
    let homeMembershipIsActive: boolean | null = null;
    const isHomeActive = async (): Promise<boolean> => {
      if (homeMembershipIsActive !== null) return homeMembershipIsActive;
      if (!user.orgId) {
        homeMembershipIsActive = true;
        return true;
      }
      const home = await this.prisma.orgMembership.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: user.orgId } },
        select: { status: true },
      });
      homeMembershipIsActive = !home || home.status === 'ACTIVE';
      return homeMembershipIsActive;
    };

    const candidates = [requestedOrgId, user.lastActiveOrgId].filter(
      (orgId): orgId is string => Boolean(orgId && orgId.trim()),
    );

    for (const candidateOrgId of candidates) {
      if (!(await isCandidateAllowed(candidateOrgId))) {
        continue;
      }

      if (candidateOrgId === user.orgId) {
        // If the home org is active, don't blindly return user.role. The user
        // might have an overriding OrgMembership row for their home org (e.g.
        // their flat role is STUDENT but they were granted TEACHER).
        if (await isHomeActive()) {
          const homeMembership = user.orgId
            ? await this.prisma.orgMembership.findUnique({
                where: { userId_orgId: { userId: user.id, orgId: user.orgId } },
                select: { role: true },
              })
            : null;
          return {
            orgId: user.orgId,
            role: homeMembership?.role || user.role,
          };
        }
        continue;
      }

      const membership = await this.prisma.orgMembership.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: candidateOrgId } },
        select: { orgId: true, role: true, status: true },
      });

      if (membership && membership.status === 'ACTIVE') {
        return { orgId: membership.orgId, role: membership.role };
      }
    }

    if (await isHomeActive()) {
      const homeMembership = user.orgId
        ? await this.prisma.orgMembership.findUnique({
            where: { userId_orgId: { userId: user.id, orgId: user.orgId } },
            select: { role: true },
          })
        : null;
      return {
        orgId: user.orgId,
        role: homeMembership?.role || user.role,
      };
    }

    // Home org access has been restricted and no other active membership
    // matched a candidate — resolve org-less rather than silently trusting
    // the suspended home org. OrgRequiredGuard then blocks workspace access
    // on any org-scoped route.
    return { orgId: null, role: user.role };
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
        organization: {
          select: {
            name: true,
            slug: true,
            domain: true,
            provisionedFromUserId: true,
            features: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const defaultOrgId = this.getDefaultOrgId();
    return memberships
      .map((membership) => {
        const kind = getOrgKindFromRecord(membership.organization, {
          isDefaultOrg: membership.orgId === defaultOrgId,
        });
        const domain = String(membership.organization?.domain || '')
          .trim()
          .toLowerCase();
        return {
          orgId: membership.orgId,
          orgName: membership.organization?.name || 'Untitled organization',
          orgSlug: membership.organization?.slug || null,
          // The switcher navigates strict orgs by host; never expose the
          // sentinel 'default' domain as a navigable host.
          orgDomain: domain && domain !== 'default' ? domain : null,
          orgKind: kind,
          role: membership.role,
          isHome: membership.orgId === user.orgId,
        };
      })
      .filter((m) => !(m.role === 'STUDENT' && m.orgKind === 'PERSONAL'));
  }

  /**
   * Validates the target membership, then persists it as lastActiveOrgId so
   * future sessions default there. Does not touch the user's home org.
   */
  async switchActiveOrg(
    user: { id: string; orgId: string | null; role: Role },
    targetOrgId: string,
    tenantOrgId?: string | null,
  ): Promise<ResolvedOrgContext> {
    if (!targetOrgId || !targetOrgId.trim()) {
      throw new NotFoundException('Organization not specified');
    }

    // A STRICT org can only be entered on its own subdomain — reject
    // switch attempts from the apex or another tenant's host outright,
    // even though resolveActiveMembership would also ignore the result.
    if (targetOrgId !== tenantOrgId && (await this.isStrictOrg(targetOrgId))) {
      throw new ForbiddenException(
        'This workspace is only available on its own domain',
      );
    }

    if (targetOrgId === user.orgId) {
      const home = await this.prisma.orgMembership.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: targetOrgId } },
        select: { status: true, role: true },
      });

      if (home && home.status !== 'ACTIVE') {
        throw new ForbiddenException(
          'You are not a member of that organization',
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActiveOrgId: targetOrgId },
      });
      return { orgId: user.orgId, role: home?.role || user.role };
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
