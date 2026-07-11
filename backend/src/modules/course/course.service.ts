import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  sanitizeQuestionForClient,
  sanitizeQuestionsPayloadForClient,
  shouldSanitizeSensitiveContent,
} from '../common/testcase-visibility.util';

@Injectable()
export class CourseService {
  constructor(
    private readonly supabase: SupabaseService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private isMissingExamAttemptFieldError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as any).code === 'P2022' &&
      (String((error as any)?.meta?.column || '').includes(
        'Exam.passingPercentage',
      ) ||
        String((error as any)?.meta?.column || '').includes('Exam.maxAttempts') ||
        String((error as any)?.meta?.column || '').includes(
          'Exam.attemptBufferMins',
        ))
    );
  }

  /**
   * Tenant isolation for a resource that's EITHER org-owned (orgId set) OR
   * personal/org-less (orgId null — a solo teacher's content before
   * joining/creating an org, isolated by creatorId instead). Checking only
   * `resource.orgId && resource.orgId !== user.orgId` treats a falsy orgId
   * as "no isolation needed," which lets ANY privileged-role account read
   * another person's personal course/unit by slug or id. SUPER_ADMIN exempt.
   */
  private assertTenantOrOwnerAccess(
    resource: { orgId?: string | null; creatorId?: string | null } | null | undefined,
    user: any,
    message = 'Not found or access denied',
  ): void {
    if (!resource || !user || user.role === 'SUPER_ADMIN') return;

    if (resource.orgId) {
      if (resource.orgId !== user.orgId) {
        throw new NotFoundException(message);
      }
      return;
    }

    if (resource.creatorId && resource.creatorId !== user.id) {
      throw new NotFoundException(message);
    }
  }

  /**
   * Same tenant/owner check, but with an enrollment escape hatch: a student
   * actually enrolled in the course (course.students) must always be able to
   * open it, regardless of org match. Two real cases hit this:
   *  - The Learner persona (workspace switcher's "My Learning") resolves to
   *    an org-less identity (effectiveOrgId: null) by design, even for a
   *    Creator whose home org is set — so the plain org check always fails.
   *  - A user enrolled by email into a course outside their own home org
   *    (enrollment no longer requires matching org or STUDENT role — see
   *    teacher.service.ts enrollByEmails).
   * Falls back to a targeted membership query only when the cheap sync
   * check would otherwise deny, so the common (already-authorized) path
   * never pays for the extra lookup.
   */
  private async assertCourseAccess(
    course: { id: string; orgId?: string | null; creatorId?: string | null },
    user: any,
    message = 'Not found or access denied',
  ): Promise<void> {
    try {
      this.assertTenantOrOwnerAccess(course, user, message);
      return;
    } catch (error) {
      if (!(error instanceof NotFoundException) || !user?.id || !course?.id) {
        throw error;
      }
    }

    const enrolled = await this.prisma.course.count({
      where: { id: course.id, students: { some: { id: user.id } } },
    });

    if (enrolled === 0) {
      throw new NotFoundException(message);
    }
  }

  private buildCourseQuery(slug: string, scopedOrgId: string | null, userId?: string) {
    const orConditions: any[] = [];
    if (scopedOrgId) orConditions.push({ orgId: scopedOrgId });
    if (userId) orConditions.push({ students: { some: { id: userId } } });

    return {
      where: {
        slug,
        // Widen beyond the org scope so an enrolled user can still find a
        // course that lives in a different org than their active identity
        // (org-less Learner persona, or cross-org enrollment by email).
        ...(orConditions.length > 0 ? { OR: orConditions } : {}),
      },
      include: {
        linkedExam: {
          select: {
            id: true,
            slug: true,
            title: true,
            duration: true,
            totalMarks: true,
            isActive: true,
            passingPercentage: true,
            maxAttempts: true,
            attemptBufferMins: true,
          },
        },
        modules: {
          orderBy: { order: 'asc' },
          include: {
            units: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                order: true,
              },
            },
          },
        },
        tests: {
          orderBy: { startDate: 'asc' },
          select: {
            id: true,
            slug: true,
            title: true,
            startDate: true,
            endDate: true,
            questions: true,
          },
        },
      },
    } as any;
  }

  async getCourse(slug: string, user?: any) {
    // PERFORMANCE: Check cache
    // Note: We cache based on slug. If orgId checks are needed per user, we must ensure cache isn't leaking data.
    // Public courses or courses accessible to current user.
    // Since getCourse is mostly about content manifest, we can cache the result.
    // However, we perform an isolation check AFTER fetching.
    // So we can cache the RAW course data by slug, then check permissions.

    const defaultOrgId =
      String(process.env.DEFAULT_ORG_ID || '').trim() || null;
    const scopedOrgId =
      user?.role === 'SUPER_ADMIN' ? null : (user?.orgId ?? defaultOrgId);
    const cacheOrgPart = scopedOrgId || 'none';

    const cacheKey = `course:${cacheOrgPart}:${slug}`;
    const shouldBypassCache = user?.role === 'STUDENT';
    const cached = shouldBypassCache ? null : await this.redis.get(cacheKey);

    let course;

    if (cached) {
      course = JSON.parse(cached);
    } else {
      const courseQuery = this.buildCourseQuery(slug, scopedOrgId, user?.id);

      try {
        course = await this.prisma.course.findFirst(courseQuery);
      } catch (error) {
        if (!this.isMissingExamAttemptFieldError(error)) {
          throw error;
        }

        const fallbackCourseQuery = this.buildCourseQuery(slug, scopedOrgId, user?.id);
        delete fallbackCourseQuery.include.linkedExam.select.passingPercentage;
        delete fallbackCourseQuery.include.linkedExam.select.maxAttempts;
        delete fallbackCourseQuery.include.linkedExam.select.attemptBufferMins;

        course = await this.prisma.course.findFirst(fallbackCourseQuery);
      }

      if (course && !shouldBypassCache) {
        // Cache for 1 hour
        await this.redis.set(cacheKey, JSON.stringify(course), 'EX', 3600);
      }
    }

    if (!course) throw new NotFoundException('Course not found');

    // ISOLATION CHECK (enrollment overrides a plain org/creator mismatch)
    await this.assertCourseAccess(
      course,
      user,
      'Course not found or access denied',
    );

    if (!shouldSanitizeSensitiveContent(user)) {
      return course;
    }

    return {
      ...course,
      tests: (course.tests || []).map((test: any) => ({
        ...test,
        questions: sanitizeQuestionsPayloadForClient(test.questions, false),
      })),
    };
  }

  async getPublicCourse(orgSlug: string, courseSlug: string) {
    const normalizedOrgSlug = String(orgSlug || '')
      .trim()
      .toLowerCase();
    const normalizedCourseSlug = String(courseSlug || '').trim();

    if (!normalizedOrgSlug || !normalizedCourseSlug) {
      throw new NotFoundException('Course not found');
    }

    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { slug: normalizedOrgSlug },
          { domain: { equals: normalizedOrgSlug, mode: 'insensitive' } },
        ] as any,
      },
      select: {
        id: true,
        name: true,
        logo: true,
        plan: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const course = await this.prisma.course.findFirst({
      where: {
        orgId: org.id,
        slug: normalizedCourseSlug,
        isVisible: true,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        longDescription: true,
        thumbnail: true,
        modules: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return {
      org: {
        slug: normalizedOrgSlug,
        name: org.name,
        logo: org.logo,
        plan: org.plan,
      },
      course,
    };
  }

  // Invalidated cache for courses/units/tests whenever they are updated
  // This method should be called by TeacherService/AdminService when updating content
  async invalidateCourseCache(slug: string) {
    const keysToDelete: string[] = [];
    let cursor = '0';
    const matchPattern = `course:*:${slug}`;

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        matchPattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;
      if (batch && batch.length > 0) {
        keysToDelete.push(...batch);
      }
    } while (cursor !== '0');

    const uniqueKeys = Array.from(new Set([...keysToDelete, `course:${slug}`]));
    if (uniqueKeys.length > 0) {
      await this.redis.del(...uniqueKeys);
    }
  }

  async getUnit(id: string, user?: any) {
    // PERFORMANCE: Check cache
    const cacheKey = `unit:${id}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const { data, source, orgId, creatorId, courseId } = JSON.parse(cached);

      // If it's a test-source unit but missing moduleUnits (stale cache), bust cache and re-fetch
      if (
        source === 'test' &&
        (!data.moduleUnits || data.moduleUnits.length === 0)
      ) {
        await this.redis.del(cacheKey);
        // Fall through to re-fetch below
      } else {
        // Re-verify isolation (enrollment overrides a plain org/creator mismatch)
        await this.assertCourseAccess(
          { id: courseId, orgId, creatorId },
          user,
          'Unit not found',
        );
        if (!shouldSanitizeSensitiveContent(user)) {
          return data;
        }

        return this.sanitizeUnitResponse(data);
      }
    }

    console.log('[CourseService] getUnit id=', id);
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    // 1. If Unit Found, Check Isolation via Course
    if (unit) {
      const courseId = unit.module.course.id;
      const orgId = unit.module.course.orgId;
      const creatorId = unit.module.course.creatorId;

      // Cache immediately before checks (data is valid, access is situational)
      await this.redis.set(
        cacheKey,
        JSON.stringify({
          data: unit,
          source: 'unit',
          courseId,
          orgId,
          creatorId,
        }),
        'EX',
        3600,
      );

      await this.assertCourseAccess({ id: courseId, orgId, creatorId }, user, 'Unit not found');
      if (!shouldSanitizeSensitiveContent(user)) {
        return unit;
      }

      return this.sanitizeUnitResponse(unit);
    }

    // 2. If Unit NOT found, look in CourseTests
    // (Course Tests store 'questions' as structured JSON with sections)
    // Optimization: Use Raw SQL to find candidates instead of loading all tests

    // Postgres-specific raw query to find tests containing the ID in their JSON column
    // We CAST to text to do a simple substring search which is fast enough for loose loose matching
    const { data: candidateTestsData, error: candidateTestsError } = await (
      this.supabase.client as any
    ).rpc('find_course_tests_by_question_id', {
      p_question_id: id,
    });

    if (candidateTestsError) {
      throw new Error(
        candidateTestsError.message ||
          'Failed to find course tests by question id',
      );
    }

    const candidateTests: any[] = Array.isArray(candidateTestsData)
      ? candidateTestsData
      : [];

    if (candidateTests.length === 0) {
      throw new NotFoundException('Unit not found');
    }

    const candidateIds = candidateTests.map((t) => t.id);

    const tests = await this.prisma.courseTest.findMany({
      where: { id: { in: candidateIds } },
      include: { course: true },
    });

    // inspecting candidate tests

    let matchedTest = null;
    let foundQuestion: any = null;
    let foundOrgId: string | null = null;
    let foundCreatorId: string | null = null;
    let foundCourseId: string | null = null;
    for (const test of tests) {
      // Defensive: CourseTest.questions might be stored as a JSON string or already as object
      let questionsData: any = test.questions;
      if (typeof questionsData === 'string') {
        try {
          questionsData = JSON.parse(questionsData);
        } catch (e) {
          console.error(
            '[CourseService] failed to parse questions JSON for test',
            test.id,
          );
          questionsData = {};
        }
      }

      const sections = Array.isArray(questionsData)
        ? questionsData
        : questionsData?.sections || [];

      // Search logic (same as before) ...
      // Helper to recursively find in sections
      const findInSections = (secs: any[]) => {
        for (const section of secs) {
          if (section.questions) {
            const q = section.questions.find((q: any) => q.id === id);
            if (q) return q;
          }
        }
        return null;
      };

      // Helper for flat
      const findInFlat = (qs: any[]) => {
        return qs.find((q: any) => q.id === id);
      };

      if (Array.isArray(questionsData)) {
        // Check if it looks like sections or questions
        if (questionsData.length > 0 && questionsData[0].questions) {
          foundQuestion = findInSections(questionsData);
        } else {
          foundQuestion = findInFlat(questionsData);
        }
      } else if (questionsData?.sections) {
        foundQuestion = findInSections(questionsData.sections);
      }

      if (foundQuestion) {
        foundOrgId = test.course.orgId;
        foundCreatorId = test.course.creatorId;
        foundCourseId = test.courseId;
        matchedTest = test;
        break;
      }
    }

    if (foundQuestion && matchedTest) {
      // Build a flat list of ALL questions from this test (across all sections)
      // so the frontend sidebar can show all questions for navigation
      let allTestQuestions: any[] = [];
      let rawQ: any = matchedTest.questions;
      if (typeof rawQ === 'string') {
        try {
          rawQ = JSON.parse(rawQ);
        } catch {
          rawQ = [];
        }
      }
      if (Array.isArray(rawQ)) {
        if (rawQ.length > 0 && rawQ[0].questions) {
          // Array of sections
          allTestQuestions = rawQ.flatMap((s: any) =>
            Array.isArray(s.questions) ? s.questions : [],
          );
        } else {
          // Flat array of questions
          allTestQuestions = rawQ;
        }
      } else if (rawQ?.sections) {
        allTestQuestions = rawQ.sections.flatMap((s: any) =>
          Array.isArray(s.questions) ? s.questions : [],
        );
      }

      const moduleUnits = allTestQuestions.map((q: any) => ({
        id: String(q.id),
        type: q.type || q.questionType || 'Test',
        title: q.title || 'Question',
      }));

      const responseData = {
        ...foundQuestion,
        moduleUnits,
        module: {
          id: matchedTest.id,
          title: matchedTest.title,
          course: matchedTest.course,
        },
      };

      // Cache result
      await this.redis.set(
        cacheKey,
        JSON.stringify({
          data: responseData,
          source: 'test',
          courseId: foundCourseId,
          orgId: foundOrgId,
          creatorId: foundCreatorId,
        }),
        'EX',
        3600,
      );

      await this.assertCourseAccess(
        { id: foundCourseId as string, orgId: foundOrgId, creatorId: foundCreatorId },
        user,
        'Unit not found',
      );
      if (!shouldSanitizeSensitiveContent(user)) {
        return responseData;
      }

      return this.sanitizeUnitResponse(responseData);
    }

    // Explicitly simplified the loop replacement for brevity in this tool call,
    // sticking to replacing the block effectively.

    throw new NotFoundException('Unit not found');
  }

  private sanitizeUnitResponse(data: any) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized: any = {
      ...data,
    };

    if (sanitized.content && typeof sanitized.content === 'object') {
      sanitized.content = sanitizeQuestionForClient(sanitized.content, false);
    }

    return sanitizeQuestionForClient(sanitized, false);
  }
}
