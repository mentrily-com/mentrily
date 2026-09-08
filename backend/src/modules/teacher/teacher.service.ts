import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { Prisma } from '@prisma/client';
import { PLAN_FEATURES, type PlanKey } from '../../config/plan-limits';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { QuotaService } from '../billing/quota.service';
import { generateRandomSlug, normalizeSlug } from '../common/slug.util';
import { MembershipService } from '../organization/membership.service';
import {
  legacyExamSelect,
  isMissingExamAttemptFieldError,
} from './teacher.util';

/**
 * What's left after splitting TeacherService's seven original concerns
 * (stats, students, courses, exams, groups, announcements -- see
 * teacher-groups.service.ts for the full history) out into their own
 * services: the cross-cutting helpers several of those still share --
 * access control, slug generation, exam/course record creation with
 * retry, and a couple of cache-invalidation helpers. Every split service
 * injects this one for the pieces it needs rather than duplicating them.
 */
@Injectable()
export class TeacherService {
  constructor(
    private readonly supabase: SupabaseService,
    private quotaService: QuotaService,
    private membershipService: MembershipService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  async canUseCustomSlug(orgId?: string | null): Promise<boolean> {
    if (!orgId) return false;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, features: true },
    });

    const plan = (org?.plan as PlanKey) || 'FREE';
    const overrides =
      org?.features &&
      typeof org.features === 'object' &&
      !Array.isArray(org.features)
        ? (org.features as Record<string, unknown>)
        : {};

    return Boolean(
      {
        ...(PLAN_FEATURES[plan] || PLAN_FEATURES.FREE),
        ...overrides,
      }.customSlug,
    );
  }

  async createUniqueSlug(
    model: 'course' | 'exam' | 'courseTest',
    title: string,
    orgId?: string | null,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const slug = generateRandomSlug(
        title,
        model === 'courseTest' ? 'test' : model,
      );
      const exists =
        model === 'course'
          ? await this.prisma.course.findFirst({
              where: { slug, orgId: orgId || null },
              select: { id: true },
            })
          : model === 'exam'
            ? await this.prisma.exam.findFirst({
                where: { slug, orgId: orgId || null },
                select: { id: true },
              })
            : await this.prisma.courseTest.findFirst({
                where: { slug, orgId: orgId || null },
                select: { id: true },
              });

      if (!exists) {
        return slug;
      }
    }

    return generateRandomSlug(title, model === 'courseTest' ? 'test' : model);
  }

  async resolveIncomingSlug(
    incomingSlug: unknown,
    title: string,
    orgId?: string | null,
  ) {
    const canUseCustomSlug = await this.canUseCustomSlug(orgId);
    const normalizedIncoming = normalizeSlug(String(incomingSlug || ''));
    if (canUseCustomSlug && normalizedIncoming) {
      return normalizedIncoming;
    }

    return this.createUniqueSlug('course', title, orgId);
  }

  async createCourseRecordWithRetry(
    data: Prisma.CourseCreateInput,
    title: string,
    orgId?: string | null,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.course.create({
          data: {
            ...data,
            slug:
              attempt === 0
                ? data.slug
                : await this.createUniqueSlug('course', title, orgId),
          },
          include: {
            modules: { include: { units: true } },
            tests: true,
          },
        });
      } catch (error) {
        if (error?.code !== 'P2002' || attempt === 2) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Unable to create course');
  }

  async createExamRecordWithRetry(
    data: Prisma.ExamCreateInput,
    title: string,
    orgId?: string | null,
  ): Promise<any> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.exam.create({
          data: {
            ...data,
            slug:
              attempt === 0
                ? data.slug
                : await this.createUniqueSlug('exam', title, orgId),
          } as any,
          select: legacyExamSelect as any,
        });
      } catch (error) {
        if (isMissingExamAttemptFieldError(error)) {
          const fallbackData = { ...(data as Record<string, unknown>) };
          delete fallbackData.passingPercentage;
          delete fallbackData.maxAttempts;
          delete fallbackData.attemptBufferMins;

          return await this.prisma.exam.create({
            data: {
              ...fallbackData,
              slug:
                attempt === 0
                  ? data.slug
                  : await this.createUniqueSlug('exam', title, orgId),
            } as any,
            select: legacyExamSelect as any,
          });
        }

        if (error?.code === 'P2002') {
          const target = String(error?.meta?.target || '');
          if (target.includes('testCode')) {
            throw new BadRequestException(
              'That test code is already in use by another exam. Please choose a different code.',
            );
          }
          if (attempt < 2) {
            continue; // slug collision -- retry with a freshly generated slug
          }
        }

        throw error;
      }
    }

    throw new BadRequestException('Unable to create exam');
  }

  async findExamByIdCompat(id: string): Promise<any> {
    return this.prisma.exam.findUnique({
      where: { id },
      select: legacyExamSelect as any,
    });
  }

  async enforceQuestionTypeAccess(
    user: any,
    types: Iterable<string>,
    orgId?: string | null,
  ): Promise<void> {
    await this.quotaService.checkQuestionTypeAllowed({
      orgId: orgId || null,
      plan: orgId ? undefined : 'FREE',
      types: Array.from(types),
    });
  }

  async invalidateTeacherExamListCache(user: any): Promise<void> {
    const cacheKey = `teacher:exams:${user.id}:${user.role}:${user.orgId || 'none'}`;
    await this.redis.del(cacheKey);
  }

  // Not private: TeacherGroupsService reuses this and getBlockedEnrollments
  // below rather than duplicating them -- see that file's header comment.
  async checkAccess(resource: any, user: any) {
    if (!resource) return;
    if (resource.creatorId === user.id) return true;
    if (user.role === 'ADMIN' && resource.orgId === user.orgId) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.role === 'TEACHER') {
      const courseId = String(
        resource.courseId || resource.linkedCourseId || resource.id || '',
      ).trim();
      if (courseId) {
        const assignment = await this.prisma.courseAssignment.findUnique({
          where: {
            courseId_teacherId: {
              courseId,
              teacherId: user.id,
            },
          },
          select: { id: true },
        });
        if (assignment) {
          return true;
        }
      }
    }
    throw new ForbiddenException('Access denied: You do not own this resource');
  }

  /**
   * createCourse/updateCourse accept linkedExamId/certificateTemplateId as
   * plain client-supplied ids. Without verifying the caller actually has
   * access to that specific exam/template (and that it's in the same org),
   * a course they own could be wired to point at another org's exam or
   * template by id — linkExamToCourse already does this correctly; this
   * mirrors that same check for the inline create/update paths.
   */
  async assertLinkableExam(
    examId: string,
    orgId: string | null,
    user: any,
  ): Promise<void> {
    const exam = await this.findExamByIdCompat(examId);
    if (!exam) throw new NotFoundException('Linked exam not found');
    await this.checkAccess(exam, user);
    if ((exam.orgId || null) !== (orgId || null)) {
      throw new BadRequestException(
        'Course and exam must belong to the same organization',
      );
    }
  }

  async assertLinkableCourse(
    courseId: string,
    orgId: string | null,
    user: any,
  ): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('Linked course not found');
    await this.checkAccess(course, user);
    if ((course.orgId || null) !== (orgId || null)) {
      throw new BadRequestException(
        'Course and exam must belong to the same organization',
      );
    }
  }

  async assertLinkableCertificateTemplate(
    templateId: string,
    orgId: string | null,
    user: any,
  ): Promise<void> {
    const template = await this.prisma.certificateTemplate.findUnique({
      where: { id: templateId },
      select: { orgId: true },
    });
    if (
      !template ||
      (user.role !== 'SUPER_ADMIN' && template.orgId !== orgId)
    ) {
      throw new BadRequestException(
        'Certificate template not found in your organization',
      );
    }
  }

  /**
   * Of the given userIds, which are NOT members of orgId (neither an ACTIVE
   * OrgMembership row nor their home User.orgId). Two indexed batch queries.
   */
  private async findNonMembers(
    orgId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();

    const [memberships, homeUsers] = await Promise.all([
      this.prisma.orgMembership.findMany({
        where: { orgId, status: 'ACTIVE', userId: { in: userIds } },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds }, orgId },
        select: { id: true },
      }),
    ]);

    const members = new Set<string>([
      ...memberships.map((m: any) => m.userId),
      ...homeUsers.map((u: any) => u.id),
    ]);
    return new Set(userIds.filter((id) => !members.has(id)));
  }

  /**
   * STRICT (isolated subdomain) orgs may only enroll their own members —
   * see org-kind.ts. PERSONAL and OPEN (openEnrollment, e.g. the beta/
   * tester org) courses can enroll any global user, as before. Returns the
   * blocked subset so batch callers can report partial success.
   */
  async getBlockedEnrollments(
    course: { orgId: string | null },
    studentIds: string[],
  ): Promise<Set<string>> {
    if (!course.orgId || studentIds.length === 0) return new Set();
    const { kind } = await this.membershipService.getOrgKind(course.orgId);
    if (kind !== 'STRICT') return new Set();
    return this.findNonMembers(course.orgId, studentIds);
  }
}
