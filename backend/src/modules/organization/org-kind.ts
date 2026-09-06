/**
 * Derived organization kind — there is intentionally no column for this.
 *
 * PERSONAL: no subdomain (or the platform default org, whose domain is the
 *           literal string 'default'), or a self-serve creator's
 *           auto-provisioned org (provisionedFromUserId set). Open surface.
 * OPEN:     super-admin provisioned subdomain org with
 *           features.openEnrollment === true — branded subdomain for staff,
 *           but its content is open to enrolled global users (beta/tester).
 * STRICT:   any other subdomain org — fully isolated tenant: members only,
 *           workspace usable only on its own subdomain.
 */
export type OrgKind = 'PERSONAL' | 'OPEN' | 'STRICT';

export interface OrgKindSource {
  domain?: string | null;
  provisionedFromUserId?: string | null;
  features?: unknown;
}

function featuresAsRecord(features: unknown): Record<string, unknown> {
  if (features && typeof features === 'object' && !Array.isArray(features)) {
    return features as Record<string, unknown>;
  }
  return {};
}

export function isOpenEnrollmentOrgRecord(
  org: OrgKindSource | null | undefined,
): boolean {
  if (!org) return false;
  return featuresAsRecord(org.features).openEnrollment === true;
}

export function getOrgKindFromRecord(
  org: OrgKindSource | null | undefined,
  opts?: { isDefaultOrg?: boolean },
): OrgKind {
  if (!org) return 'PERSONAL';

  const domain = String(org.domain || '')
    .trim()
    .toLowerCase();
  if (!domain || domain === 'default' || opts?.isDefaultOrg) return 'PERSONAL';
  if (org.provisionedFromUserId) return 'PERSONAL';

  return isOpenEnrollmentOrgRecord(org) ? 'OPEN' : 'STRICT';
}
