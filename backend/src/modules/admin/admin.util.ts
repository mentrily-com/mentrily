import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Resolves which org an admin-scoped operation should run against: a
 * SUPER_ADMIN can target any org (or must supply one explicitly), a regular
 * admin is locked to their own. Pure -- no DB/DI dependency -- and shared
 * across AdminService and the services split out of it (see
 * admin-course-assignments.service.ts), so it lives here rather than being
 * duplicated or requiring a cross-service injection for one function.
 */
export function getEffectiveOrgId(user: any, targetOrgId?: string): string {
  if (user.role === 'SUPER_ADMIN') {
    if (targetOrgId) return targetOrgId;
    if (user.orgId) return user.orgId;
    throw new BadRequestException(
      'Organization ID is required for Super Admin operations',
    );
  }

  if (!user.orgId)
    throw new ForbiddenException('Admin has no organization assigned');

  if (targetOrgId && targetOrgId !== user.orgId) {
    throw new ForbiddenException('Cannot access another organization');
  }

  return user.orgId;
}
