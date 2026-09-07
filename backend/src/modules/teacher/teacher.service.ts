import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { Prisma } from '@prisma/client';
import { PLAN_FEATURES, type PlanKey } from '../../config/plan-limits';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { MonitoringGateway } from '../monitoring/monitoring.gateway';
import { NotificationGateway } from '../notification/notification.gateway';
import { StorageService } from '../../services/storage/storage.service';
import { ExamService } from '../exam/exam.service';
import { CourseService } from '../course/course.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { SendExamInviteDto } from './dto/send-exam-invite.dto';
import { QuotaService } from '../billing/quota.service';
import { WebhookService } from '../webhook/webhook.service';
import { generateRandomSlug, normalizeSlug } from '../common/slug.util';
import { MembershipService } from '../organization/membership.service';
import {
  parseOptionalDate,
  parseBoundedNumber,
  legacyExamSelect,
  isMissingExamAttemptFieldError,
  normalizeCourseStatus,
  collectQuestionTypesFromUnits,
  collectQuestionTypesFromExamContent,
  certificateTypeFilter,
  formatMinutes,
  normalizeCourseSections,
  isUUID,
} from './teacher.util';

@Injectable()
export class TeacherService {
  constructor(
    private readonly supabase: SupabaseService,
    private monitoringGateway: MonitoringGateway,
    private notificationGateway: NotificationGateway,
    private storageService: StorageService,
    private examService: ExamService,
    private courseService: CourseService,
    private quotaService: QuotaService,
    private webhookService: WebhookService,
    private membershipService: MembershipService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('exam-invite-email') private readonly examInviteQueue: Queue,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private async canUseCustomSlug(orgId?: string | null): Promise<boolean> {
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

  private async createUniqueSlug(
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

  private async resolveIncomingSlug(
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

  private async createCourseRecordWithRetry(
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
        if ((error as any)?.code !== 'P2002' || attempt === 2) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Unable to create course');
  }

  private async createExamRecordWithRetry(
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

        if ((error as any)?.code !== 'P2002' || attempt === 2) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Unable to create exam');
  }

  private async findExamByIdCompat(id: string): Promise<any> {
    return this.prisma.exam.findUnique({
      where: { id },
      select: legacyExamSelect as any,
    });
  }

  private async enforceQuestionTypeAccess(
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

  private async invalidateTeacherExamListCache(user: any): Promise<void> {
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
  private async assertLinkableExam(
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

  private async assertLinkableCourse(
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

  private async assertLinkableCertificateTemplate(
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

  async getCourses(user: any) {
    const where: any = {};

    if (typeof user === 'string') {
      where.creatorId = user;
    } else if (user?.role === 'ADMIN') {
      where.OR = [{ orgId: user.orgId }, { creatorId: user.id, orgId: null }];
    } else if (user?.role === 'TEACHER') {
      where.OR = [
        { creatorId: user.id },
        { assignments: { some: { teacherId: user.id } } },
      ];
    } else {
      where.creatorId = user?.id;
    }

    return this.prisma.course.findMany({
      where,
      include: {
        _count: { select: { modules: true, students: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getExams(user: any) {
    const cacheKey = `teacher:exams:${user.id}:${user.role}:${user.orgId || 'none'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: any = {};
    if (user.role === 'ADMIN') {
      where.OR = [{ orgId: user.orgId }, { creatorId: user.id, orgId: null }];
    } else if (user.role === 'TEACHER') {
      where.OR = [
        { creatorId: user.id },
        { linkedCourse: { assignments: { some: { teacherId: user.id } } } },
      ];
    } else {
      where.creatorId = user.id;
    }
    const response = await this.prisma.exam.findMany({
      where,
      include: {
        linkedCourse: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
    return response;
  }

  async getScheduledExams(user: any) {
    const where: any = {
      startTime: { not: null },
      endTime: { not: null },
    };

    if (user.role === 'ADMIN') {
      where.OR = [{ orgId: user.orgId }, { creatorId: user.id, orgId: null }];
    } else {
      where.creatorId = user.id;
    }

    return this.prisma.exam.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        startTime: true,
        endTime: true,
        duration: true,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async deleteCourse(id: string, user: any) {
    try {
      const course = await this.prisma.course.findUnique({ where: { id } });
      if (!course) return { success: true, message: 'Course already deleted' };
      await this.checkAccess(course, user);

      // Optimized: Use Cascade Delete defined in Prisma Schema
      // This replaces the previous N+1 manual deletion loop
      const deleted = await this.prisma.course.delete({ where: { id } });
      if (course.orgId && course.status !== 'Archived') {
        await this.quotaService.decrementCounter(
          course.orgId,
          'courseCount',
          1,
        );
      }
      return { success: true, deleted };
    } catch (e) {
      console.error(`[TeacherService] Delete failed for course ${id}:`, e);
      throw new Error(`Failed to delete course: ${e.message}`);
    }
  }

  async linkExamToCourse(
    courseId: string,
    examId: string,
    user: any,
    thresholds?: {
      examPassThreshold?: number;
      examUnlockThreshold?: number;
      passingPercentage?: number;
      maxAttempts?: number;
      attemptBufferMins?: number;
    },
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new Error('Course not found');
    await this.checkAccess(course, user);

    const exam = await this.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.checkAccess(exam, user);

    if ((course.orgId || null) !== (exam.orgId || null)) {
      throw new BadRequestException(
        'Course and exam must belong to the same organization',
      );
    }

    if (course.linkedExamId && course.linkedExamId !== examId) {
      throw new BadRequestException('Course is already linked to another exam');
    }

    if (exam.linkedCourseId && exam.linkedCourseId !== courseId) {
      throw new BadRequestException('Exam is already linked to another course');
    }

    const examPassThreshold = Number.isFinite(
      Number(thresholds?.examPassThreshold),
    )
      ? Number(thresholds?.examPassThreshold)
      : 70;
    const examUnlockThreshold = Number.isFinite(
      Number(thresholds?.examUnlockThreshold),
    )
      ? Number(thresholds?.examUnlockThreshold)
      : undefined;

    const examUpdateData: Record<string, unknown> = {
      linkedCourseId: courseId,
      passingPercentage: Number.isFinite(Number(thresholds?.passingPercentage))
        ? Number(thresholds?.passingPercentage)
        : undefined,
      maxAttempts: Number.isFinite(Number(thresholds?.maxAttempts))
        ? Number(thresholds?.maxAttempts)
        : undefined,
      attemptBufferMins: Number.isFinite(Number(thresholds?.attemptBufferMins))
        ? Number(thresholds?.attemptBufferMins)
        : undefined,
    };

    let updatedCourse: any;
    let updatedExam: any;

    try {
      [updatedCourse, updatedExam] = await this.prisma.$transaction([
        this.prisma.course.update({
          where: { id: courseId },
          data: {
            linkedExamId: examId,
            examPassThreshold,
            examUnlockThreshold,
          },
        }),
        this.prisma.exam.update({
          where: { id: examId },
          data: examUpdateData as any,
          select: legacyExamSelect as any,
        }),
      ]);
    } catch (error) {
      if (!isMissingExamAttemptFieldError(error)) {
        throw error;
      }

      delete examUpdateData.passingPercentage;
      delete examUpdateData.maxAttempts;
      delete examUpdateData.attemptBufferMins;

      [updatedCourse, updatedExam] = await this.prisma.$transaction([
        this.prisma.course.update({
          where: { id: courseId },
          data: {
            linkedExamId: examId,
            examPassThreshold,
            examUnlockThreshold,
          },
        }),
        this.prisma.exam.update({
          where: { id: examId },
          data: examUpdateData as any,
          select: legacyExamSelect as any,
        }),
      ]);
    }

    return {
      success: true,
      course: updatedCourse,
      exam: updatedExam,
    };
  }

  async unlinkExamFromCourse(courseId: string, user: any) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new Error('Course not found');
    await this.checkAccess(course, user);

    const linkedExamId = course.linkedExamId;

    const [updatedCourse] = await this.prisma.$transaction([
      this.prisma.course.update({
        where: { id: courseId },
        data: {
          linkedExamId: null,
          examPassThreshold: null,
        },
      }),
      ...(linkedExamId
        ? [
            this.prisma.exam.updateMany({
              where: { id: linkedExamId, linkedCourseId: courseId },
              data: { linkedCourseId: null },
            }),
          ]
        : []),
    ]);

    return {
      success: true,
      course: updatedCourse,
    };
  }

  async updateCourse(id: string, user: any, data: any) {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new Error('Course not found');
    await this.checkAccess(existing, user);
    const orgId = existing.orgId || user.orgId;

    const hasSectionPayload =
      Array.isArray(data?.sections) || Array.isArray(data?.modules);
    const incomingSections = normalizeCourseSections(data);

    if (hasSectionPayload) {
      const incomingTypes = collectQuestionTypesFromUnits(
        incomingSections.flatMap((section: any) => section?.questions || []),
      );
      await this.enforceQuestionTypeAccess(user, incomingTypes, orgId);
      if (orgId) {
        const existingModuleCount = await this.prisma.courseModule.count({
          where: { courseId: id },
        });
        const additionalModules = Math.max(
          0,
          incomingSections.length - existingModuleCount,
        );
        await this.quotaService.checkModuleQuota(orgId, id, additionalModules);
      }
    }

    if (typeof data.linkedExamId === 'string' && data.linkedExamId.trim()) {
      await this.assertLinkableExam(data.linkedExamId, orgId, user);
    }
    if (
      typeof data.certificateTemplateId === 'string' &&
      data.certificateTemplateId.trim()
    ) {
      await this.assertLinkableCertificateTemplate(
        data.certificateTemplateId,
        orgId,
        user,
      );
    }

    const hasExplicitStatus =
      typeof data?.status === 'string' && data.status.trim().length > 0;
    const hasExplicitVisibility = typeof data?.isVisible === 'boolean';

    const normalizedStatus =
      hasExplicitStatus || hasExplicitVisibility
        ? normalizeCourseStatus(data.status, data.isVisible)
        : normalizeCourseStatus(existing.status, existing.isVisible);

    const normalizedVisibility =
      hasExplicitStatus || hasExplicitVisibility
        ? normalizedStatus === 'Published'
          ? true
          : normalizedStatus === 'Draft'
            ? false
            : !!data.isVisible
        : !!existing.isVisible;

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        title: data.title,
        slug: (await this.canUseCustomSlug(orgId))
          ? normalizeSlug(String(data.slug || '')) || existing.slug
          : existing.slug,
        shortDescription: data.shortDescription ?? data.description,
        longDescription: data.longDescription ?? data.description,
        difficulty: data.difficulty,
        tags: data.tags,
        thumbnail: data.thumbnail,
        courseSummary: data.courseSummary ?? data.summary,
        aiTokensUsed: data.aiTokensUsed ? Number(data.aiTokensUsed) : undefined,
        certificateTemplateId:
          typeof data.certificateTemplateId === 'string'
            ? data.certificateTemplateId
            : undefined,
        completionThreshold: Number.isFinite(Number(data.completionThreshold))
          ? Number(data.completionThreshold)
          : undefined,
        linkedExamId:
          typeof data.linkedExamId === 'string' ? data.linkedExamId : undefined,
        examPassThreshold: Number.isFinite(Number(data.examPassThreshold))
          ? Number(data.examPassThreshold)
          : undefined,
        examUnlockThreshold: Number.isFinite(Number(data.examUnlockThreshold))
          ? Number(data.examUnlockThreshold)
          : undefined,
        isVisible: normalizedVisibility,
        status: normalizedStatus,
      },
    });

    // Invalidate course cache
    await this.courseService.invalidateCourseCache(course.slug);
    if (existing.slug !== course.slug) {
      await this.courseService.invalidateCourseCache(existing.slug);
    }

    if (typeof data.linkedExamId === 'string' && data.linkedExamId.trim()) {
      await this.prisma.exam.update({
        where: { id: data.linkedExamId },
        data: {
          linkedCourseId: id,
          passingPercentage: Number.isFinite(Number(data.examPassThreshold))
            ? Number(data.examPassThreshold)
            : undefined,
          maxAttempts: Number.isFinite(Number(data.maxAttempts))
            ? Number(data.maxAttempts)
            : undefined,
          attemptBufferMins: Number.isFinite(Number(data.attemptBufferMins))
            ? Number(data.attemptBufferMins)
            : undefined,
        },
      });
    }

    // 1. Sync Modules and Units
    if (hasSectionPayload) {
      const existingModules = await this.prisma.courseModule.findMany({
        where: { courseId: id },
        include: { units: true },
      });

      const currentModuleIds = incomingSections
        .map((s: any) => s.id)
        .filter((id: string) => isUUID(id));
      const modulesToDelete = existingModules.filter(
        (m: any) => !currentModuleIds.includes(m.id),
      );

      for (const mod of modulesToDelete) {
        await this.prisma.courseModule.delete({ where: { id: mod.id } });
      }

      for (let i = 0; i < incomingSections.length; i++) {
        const sec = incomingSections[i];
        const isNewModule = !isUUID(sec.id);

        let module;
        if (!isNewModule) {
          module = await this.prisma.courseModule.upsert({
            where: { id: sec.id },
            update: { title: sec.title, order: i },
            create: { id: sec.id, title: sec.title, order: i, courseId: id },
          });
        } else {
          module = await this.prisma.courseModule.create({
            data: { title: sec.title, order: i, courseId: id },
          });
        }

        if (sec.questions && Array.isArray(sec.questions)) {
          // Refresh existing units list for deletion check since we might have upserted the module
          const unitsInDb = await this.prisma.unit.findMany({
            where: { moduleId: module.id },
            select: { id: true },
          });
          const unitsInDbIds = unitsInDb.map((u) => u.id);

          const currentUnitIds = sec.questions
            .map((q: any) => q.id)
            .filter((id: string) => isUUID(id));
          const unitsToDelete = unitsInDbIds.filter(
            (uid: string) => !currentUnitIds.includes(uid),
          );

          for (const uid of unitsToDelete) {
            await this.prisma.unit.delete({ where: { id: uid } });
          }

          for (let j = 0; j < sec.questions.length; j++) {
            const q = sec.questions[j];
            const hasUUID = isUUID(q.id);

            const unitData = {
              title: q.title,
              type: q.type,
              order: j,
              content: q,
              moduleId: module.id,
            };

            if (hasUUID) {
              await this.prisma.unit.upsert({
                where: { id: q.id },
                update: unitData,
                create: { ...unitData, id: q.id },
              });
            } else {
              await this.prisma.unit.create({ data: unitData });
            }
          }
        }
      }
    }

    // 2. Sync Course Tests
    if (data.tests && Array.isArray(data.tests)) {
      const existingTests = await this.prisma.courseTest.findMany({
        where: { courseId: id },
      });

      const currentTestIds = data.tests
        .map((t: { id: string }) => t.id)
        .filter((id: string) => isUUID(id));
      const testsToDelete = existingTests.filter(
        (t: any) => !currentTestIds.includes(t.id),
      );

      for (const test of testsToDelete) {
        await this.prisma.courseTest.delete({ where: { id: test.id } });
      }

      for (const test of data.tests) {
        const hasUUID = isUUID(test.id);
        const testData = {
          title: test.title,
          slug:
            normalizeSlug(String(test.slug || '')) ||
            (await this.createUniqueSlug(
              'courseTest',
              test.title,
              existing.orgId || null,
            )),
          questions: test.questions || [],
          startDate: parseOptionalDate(test.startDate),
          endDate: parseOptionalDate(test.endDate),
          courseId: id,
          orgId: existing.orgId || null,
        };

        if (hasUUID) {
          await this.prisma.courseTest.upsert({
            where: { id: test.id },
            update: testData,
            create: { ...testData, id: test.id },
          });
        } else {
          await this.prisma.courseTest.create({ data: testData });
        }
      }
    }

    // 3. Recalculate CourseProgress for all enrolled students so both dashboards
    //    stay coherent after unit additions/deletions.
    const updatedCourse = await this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: { include: { units: { select: { id: true } } } },
        students: { select: { id: true } },
      },
    });

    if (updatedCourse && updatedCourse.students.length > 0) {
      const allUnitIds = updatedCourse.modules.flatMap((m: any) =>
        m.units.map((u: any) => u.id),
      );
      const totalUnits = allUnitIds.length;

      const studentIds = updatedCourse.students.map((s: any) => s.id);

      // One query for the whole cohort instead of one per student. Course
      // saves used to cost 4 round-trips per enrolled learner (submissions
      // read, progress upsert, two cache deletes), so a 500-learner course
      // issued ~2000 sequential round-trips on every save from the builder.
      const completedSubmissions = await this.prisma.unitSubmission.findMany({
        where: {
          userId: { in: studentIds },
          unitId: { in: allUnitIds },
          status: 'COMPLETED',
        },
        select: { userId: true, unitId: true },
      });

      const completedByStudent = new Map<string, Set<string>>();
      for (const submission of completedSubmissions) {
        let units = completedByStudent.get(submission.userId);
        if (!units) {
          units = new Set<string>();
          completedByStudent.set(submission.userId, units);
        }
        units.add(submission.unitId);
      }

      const progressWrites = updatedCourse.students.map((student: any) => {
        const completedUnitIds = [
          ...(completedByStudent.get(student.id) ?? new Set<string>()),
        ];
        const completedCount = completedUnitIds.length;
        const percent =
          totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;
        const status =
          completedCount === totalUnits && totalUnits > 0
            ? 'Completed'
            : completedCount > 0
              ? 'In Progress'
              : 'Not Started';

        const fields = {
          completedUnits: completedUnitIds,
          totalUnits,
          completedCount,
          percent,
          status,
        };

        return this.prisma.courseProgress.upsert({
          where: { userId_courseId: { userId: student.id, courseId: id } },
          update: fields,
          create: { userId: student.id, courseId: id, ...fields },
        });
      });

      // Chunked so a large cohort does not open one long-running transaction
      // that holds row locks across the whole course roster.
      const PROGRESS_WRITE_CHUNK = 100;
      for (let i = 0; i < progressWrites.length; i += PROGRESS_WRITE_CHUNK) {
        await this.prisma.$transaction(
          progressWrites.slice(i, i + PROGRESS_WRITE_CHUNK),
        );
      }

      // Invalidate student stats caches in as few round-trips as possible.
      const cacheKeys = studentIds.flatMap((studentId: string) => [
        `student:stats:${studentId}`,
        `student:analytics:${studentId}`,
      ]);
      const CACHE_DEL_CHUNK = 500;
      for (let i = 0; i < cacheKeys.length; i += CACHE_DEL_CHUNK) {
        await this.redis.del(...cacheKeys.slice(i, i + CACHE_DEL_CHUNK));
      }
    }

    const finalCourse = await this.prisma.course.update({
      where: { id },
      data: {
        status: normalizedStatus,
        isVisible: normalizedVisibility,
      },
    });

    await this.courseService.invalidateCourseCache(finalCourse.slug);
    if (existing.slug !== finalCourse.slug) {
      await this.courseService.invalidateCourseCache(existing.slug);
    }

    return finalCourse;
  }

  async createCourse(user: any, data: any) {
    const orgId =
      user.role === 'SUPER_ADMIN' && data.orgId ? data.orgId : user.orgId;

    const modules = Array.isArray(data.modules) ? data.modules : [];
    const sections = normalizeCourseSections(data);
    const inputTypes = collectQuestionTypesFromUnits([
      ...modules.flatMap((module: any) => module?.units || []),
      ...sections.flatMap((section: any) => section?.questions || []),
    ]);
    await this.enforceQuestionTypeAccess(user, inputTypes, orgId);
    if (orgId) {
      await this.quotaService.checkCourseQuota(orgId, 1);
      await this.quotaService.checkModuleQuota(
        orgId,
        undefined,
        modules.length,
      );
    } else {
      await this.quotaService.checkCourseQuotaForUser(user.id, 1);
    }

    if (typeof data.linkedExamId === 'string' && data.linkedExamId.trim()) {
      await this.assertLinkableExam(data.linkedExamId, orgId, user);
    }
    if (
      typeof data.certificateTemplateId === 'string' &&
      data.certificateTemplateId.trim()
    ) {
      await this.assertLinkableCertificateTemplate(
        data.certificateTemplateId,
        orgId,
        user,
      );
    }

    const normalizedStatus = normalizeCourseStatus(
      data.status,
      data.isVisible,
    );
    const normalizedVisibility =
      normalizedStatus === 'Published'
        ? true
        : normalizedStatus === 'Draft'
          ? false
          : !!data.isVisible;

    const course = await this.createCourseRecordWithRetry(
      {
        title: data.title,
        slug: await this.resolveIncomingSlug(data.slug, data.title, orgId),
        creator: {
          connect: {
            id: user.id,
          },
        },
        shortDescription: data.shortDescription,
        longDescription: data.longDescription,
        difficulty: data.difficulty,
        tags: data.tags || [],
        thumbnail: data.thumbnail,
        courseSummary: data.courseSummary,
        aiTokensUsed: data.aiTokensUsed ? Number(data.aiTokensUsed) : undefined,
        completionThreshold: Number.isFinite(Number(data.completionThreshold))
          ? Number(data.completionThreshold)
          : undefined,
        examPassThreshold: Number.isFinite(Number(data.examPassThreshold))
          ? Number(data.examPassThreshold)
          : 70,
        examUnlockThreshold: Number.isFinite(Number(data.examUnlockThreshold))
          ? Number(data.examUnlockThreshold)
          : undefined,
        isVisible: normalizedVisibility,
        status: normalizedStatus,
        modules: {
          create: modules.map((m: any) => ({
            title: m.title,
            order: m.order,
            units: {
              create: (m.units || []).map((u: any) => ({
                title: u.title,
                type: u.type,
                order: u.order,
                content: u.content || {},
              })),
            },
          })),
        },
        tests: {
          create: (data.tests || []).map((t: any) => ({
            title: t.title,
            slug:
              normalizeSlug(String(t.slug || '')) ||
              generateRandomSlug(t.title, 'test'),
            questions: t.questions || [],
            startDate: parseOptionalDate(t.startDate),
            endDate: parseOptionalDate(t.endDate),
            orgId: orgId,
          })),
        },
        ...(orgId
          ? {
              organization: {
                connect: {
                  id: orgId,
                },
              },
            }
          : {}),
        ...(typeof data.certificateTemplateId === 'string'
          ? {
              certificateTemplate: {
                connect: {
                  id: data.certificateTemplateId,
                },
              },
            }
          : {}),
        ...(typeof data.linkedExamId === 'string'
          ? {
              linkedExam: {
                connect: {
                  id: data.linkedExamId,
                },
              },
            }
          : {}),
      },
      data.title,
      orgId,
    );

    if (normalizedStatus !== 'Archived') {
      await this.quotaService.incrementCounter(orgId, 'courseCount', 1);
    }
    return course;
  }

  async createExam(user: any, data: any) {
    const orgId =
      user.role === 'SUPER_ADMIN' && data.orgId ? data.orgId : user.orgId;
    const linkedCourseId =
      typeof data.linkedCourseId === 'string' ? data.linkedCourseId : undefined;

    if (linkedCourseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: linkedCourseId },
        select: {
          id: true,
          creatorId: true,
          orgId: true,
          linkedExamId: true,
        },
      });

      if (!course) {
        throw new Error('Course not found');
      }

      await this.checkAccess(course, user);

      const existingLinkedExamId =
        course.linkedExamId ||
        (
          await this.prisma.exam.findFirst({
            where: { linkedCourseId },
            select: { id: true },
          })
        )?.id ||
        null;

      if (existingLinkedExamId) {
        return this.findExamByIdCompat(existingLinkedExamId);
      }
    }

    const questionTypes = collectQuestionTypesFromExamContent(
      data.sections || data.questions || [],
    );
    await this.enforceQuestionTypeAccess(user, questionTypes, orgId);
    await this.quotaService.checkMonthlyExamQuota({
      orgId,
      userId: orgId ? undefined : user.id,
      additional: 1,
    });
    if (orgId) {
      await this.quotaService.checkExamQuota(orgId, undefined, 1);
    }

    const passingPercentage = Number.isFinite(Number(data.passingPercentage))
      ? Number(data.passingPercentage)
      : linkedCourseId
        ? 70
        : undefined;
    const maxAttempts = Number.isFinite(Number(data.maxAttempts))
      ? Number(data.maxAttempts)
      : linkedCourseId
        ? 1
        : undefined;
    const attemptBufferMins = Number.isFinite(Number(data.attemptBufferMins))
      ? Number(data.attemptBufferMins)
      : linkedCourseId
        ? 0
        : undefined;

    const examPayload: Prisma.ExamCreateInput = {
      title: data.title,
      slug: (await this.canUseCustomSlug(orgId))
        ? normalizeSlug(String(data.slug || '')) ||
          (await this.createUniqueSlug('exam', data.title, orgId))
        : await this.createUniqueSlug('exam', data.title, orgId),
      creator: {
        connect: {
          id: user.id,
        },
      },
      shortDescription: data.shortDescription,
      longDescription: data.longDescription,
      difficulty: data.difficulty,
      tags: data.tags || [],
      duration: linkedCourseId ? 60 : Number(data.duration) || 60,
      totalMarks: linkedCourseId
        ? null
        : data.totalMarks
          ? Number(data.totalMarks)
          : 0,
      testCode: linkedCourseId ? null : data.testCode,
      testCodeType: data.testCodeType,
      rotationInterval: data.rotationInterval
        ? Number(data.rotationInterval)
        : null,
      inviteToken: linkedCourseId ? null : data.inviteToken,
      allowedIPs: linkedCourseId ? null : data.allowedIPs,
      examMode: data.examMode,
      aiProctoring: !!data.aiProctoring,
      tabSwitchLimit: data.tabSwitchLimit ? Number(data.tabSwitchLimit) : null,
      startTime: linkedCourseId
        ? null
        : data.startTime
          ? new Date(data.startTime)
          : null,
      endTime: linkedCourseId
        ? null
        : data.endTime
          ? new Date(data.endTime)
          : null,
      timeZone: linkedCourseId ? null : data.timeZone || null,
      questions: data.sections || data.questions || [],
      aiTokensUsed: data.aiTokensUsed ? Number(data.aiTokensUsed) : undefined,
      isActive: data.isActive ?? data.isVisible ?? true,
      passingPercentage,
      maxAttempts,
      attemptBufferMins,
      ...(orgId
        ? {
            organization: {
              connect: {
                id: orgId,
              },
            },
          }
        : {}),
      ...(linkedCourseId
        ? {
            linkedCourse: {
              connect: {
                id: linkedCourseId,
              },
            },
          }
        : {}),
    };

    const exam = await this.createExamRecordWithRetry(
      examPayload,
      data.title,
      orgId,
    );

    if (linkedCourseId) {
      await this.linkExamToCourse(linkedCourseId, exam.id, user, {
        examPassThreshold: Number.isFinite(Number(data.examPassThreshold))
          ? Number(data.examPassThreshold)
          : 70,
        examUnlockThreshold: data.examUnlockThreshold,
        passingPercentage,
        maxAttempts,
        attemptBufferMins,
      });
    }

    await this.quotaService.recordExamCreated({
      orgId,
      userId: user.id,
      examId: exam.id,
    });
    await this.invalidateTeacherExamListCache(user);
    return this.findExamByIdCompat(exam.id);
  }

  async updateExam(id: string, user: any, data: any) {
    const existing = await this.findExamByIdCompat(id);
    if (!existing) throw new Error('Exam not found');
    await this.checkAccess(existing, user);
    await this.enforceQuestionTypeAccess(
      user,
      collectQuestionTypesFromExamContent(
        data.sections || data.questions || [],
      ),
      existing.orgId || user.orgId,
    );

    if (typeof data.linkedCourseId === 'string' && data.linkedCourseId.trim()) {
      await this.assertLinkableCourse(
        data.linkedCourseId,
        existing.orgId || user.orgId,
        user,
      );
    }

    // Calculate total marks from questions if provided
    let calculatedTotalMarks = 0;
    const questionsSource = data.sections || data.questions;

    const sumMarks = (items: any[]) => {
      items.forEach((item) => {
        if (item.questions && Array.isArray(item.questions)) {
          sumMarks(item.questions);
        } else if (item.type || item.marks || item.points) {
          calculatedTotalMarks +=
            Number(item.marks) ||
            Number(item.points) ||
            (item.type === 'Coding' ? 10 : 1);
        }
      });
    };

    if (questionsSource) {
      if (Array.isArray(questionsSource)) {
        sumMarks(questionsSource);
      } else if (typeof questionsSource === 'object') {
        sumMarks(Object.values(questionsSource));
      }
    }

    // Use calculated if > 0, else use provided, else undefined
    const finalTotalMarks =
      calculatedTotalMarks > 0
        ? calculatedTotalMarks
        : data.totalMarks
          ? Number(data.totalMarks)
          : undefined;

    const isCourseLinked =
      typeof data.linkedCourseId === 'string'
        ? true
        : Boolean(existing.linkedCourseId);

    const updateData: Record<string, unknown> = {
      title: data.title,
      slug: (await this.canUseCustomSlug(existing.orgId || user.orgId))
        ? normalizeSlug(String(data.slug || '')) || existing.slug
        : existing.slug,
      shortDescription: data.shortDescription,
      longDescription: data.longDescription ?? data.description,
      difficulty: data.difficulty,
      tags: data.tags,
      duration: isCourseLinked
        ? undefined
        : data.duration
          ? Number(data.duration)
          : undefined,
      totalMarks: finalTotalMarks,
      testCode: isCourseLinked ? null : data.testCode,
      testCodeType: data.testCodeType,
      rotationInterval: data.rotationInterval
        ? Number(data.rotationInterval)
        : null,
      inviteToken: isCourseLinked ? null : data.inviteToken,
      allowedIPs: isCourseLinked ? null : data.allowedIPs,
      examMode: data.examMode,
      aiProctoring: data.aiProctoring,
      tabSwitchLimit: data.tabSwitchLimit ? Number(data.tabSwitchLimit) : null,
      startTime: isCourseLinked
        ? null
        : data.startTime
          ? new Date(data.startTime)
          : null,
      endTime: isCourseLinked
        ? null
        : data.endTime
          ? new Date(data.endTime)
          : null,
      timeZone: isCourseLinked ? null : (data.timeZone ?? undefined),
      questions: data.sections || data.questions,
      aiTokensUsed: data.aiTokensUsed ? Number(data.aiTokensUsed) : undefined,
      isActive: data.isActive ?? data.isVisible,
      linkedCourseId:
        typeof data.linkedCourseId === 'string'
          ? data.linkedCourseId
          : undefined,
      passingPercentage: Number.isFinite(Number(data.passingPercentage))
        ? Number(data.passingPercentage)
        : isCourseLinked
          ? (existing.passingPercentage ?? 70)
          : undefined,
      maxAttempts: Number.isFinite(Number(data.maxAttempts))
        ? Number(data.maxAttempts)
        : isCourseLinked
          ? (existing.maxAttempts ?? 1)
          : undefined,
      attemptBufferMins: Number.isFinite(Number(data.attemptBufferMins))
        ? Number(data.attemptBufferMins)
        : isCourseLinked
          ? (existing.attemptBufferMins ?? 0)
          : undefined,
    };

    let updatedExam: any;

    try {
      updatedExam = await this.prisma.exam.update({
        where: { id },
        data: updateData as any,
        select: legacyExamSelect as any,
      });
    } catch (error) {
      if (!isMissingExamAttemptFieldError(error)) {
        throw error;
      }

      delete updateData.passingPercentage;
      delete updateData.maxAttempts;
      delete updateData.attemptBufferMins;

      updatedExam = await this.prisma.exam.update({
        where: { id },
        data: updateData as any,
        select: legacyExamSelect as any,
      });
    }

    // Invalidate Redis cache
    await this.invalidateExamCaches(updatedExam.slug);
    if (existing.slug !== updatedExam.slug) {
      await this.invalidateExamCaches(existing.slug);
    }
    await this.invalidateTeacherExamListCache(user);

    return updatedExam;
  }

  /**
   * Every slug-keyed exam cache entry, so an edit (e.g. clearing
   * allowedIPs) can't keep being served stale via check-status/lookup/
   * public-status for up to their TTL — see exam.service.ts's
   * getExamIdBySlug (1hr TTL, backs enterExam's IP-allowlist check),
   * getPublicStatus, and checkExamStatus for the corresponding reads.
   */
  private async invalidateExamCaches(slug: string): Promise<void> {
    await Promise.all([
      this.redis.del(`exam:content:${slug}`),
      // getExamBySlug additionally caches the transformed/sanitized
      // response per sensitivity variant -- both must go too, or a
      // teacher's edit could keep serving the pre-edit transform for up
      // to its TTL even after the raw row cache is cleared.
      this.redis.del(`exam:content:transformed:${slug}:sensitive`),
      this.redis.del(`exam:content:transformed:${slug}:public`),
      this.redis.del(`exam:lookup:${slug}`),
      this.redis.del(`exam:public-status:${slug}`),
      this.redis.del(`exam:check-status:${slug}`),
    ]);
  }

  async deleteExam(id: string, user: any) {
    try {
      const exam = await this.findExamByIdCompat(id);
      if (!exam) return { success: true, message: 'Exam already deleted' };
      await this.checkAccess(exam, user);

      await this.prisma.$transaction(async (tx) => {
        await tx.feedback.deleteMany({ where: { examId: id } });
        await tx.violation.deleteMany({ where: { session: { examId: id } } });
        await tx.examSession.deleteMany({ where: { examId: id } });
        await tx.exam.delete({ where: { id } });
      });

      await this.invalidateExamCaches(exam.slug);
      await this.invalidateTeacherExamListCache(user);

      return { success: true, deleted: { id } };
    } catch (e) {
      console.error(`[TeacherService] Final delete failed for exam ${id}:`, e);
      throw new Error(`Failed to delete exam: ${e.message}`);
    }
  }

  async getMonitoredStudents(examId: string, user: any) {
    // Verify ownership
    const exam = await this.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.checkAccess(exam, user);

    // Fetch all sessions for this exam
    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            rollNumber: true,
          },
        },
        violations: {
          orderBy: { timestamp: 'desc' },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Transform to frontend format
    return sessions.map((session: any) => {
      const tabSwitchViolations = session.violations.filter(
        (v: any) =>
          v.type === 'TAB_SWITCH' ||
          v.type === 'TAB_SWITCH_OUT' ||
          v.type === 'TAB_SWITCH_IN',
      );
      const vmViolations = session.violations.filter(
        (v: any) => v.type === 'VM_DETECTED',
      );

      // The roll number / section shown here is what the student actually
      // typed on the exam login form, stashed in the session's own
      // _internal_metadata (see ExamService.startSession) — NOT the
      // User.rollNumber profile column, which is a separate, usually-empty
      // field most exam-only accounts never fill in.
      const sessionAnswers =
        typeof session.answers === 'string'
          ? JSON.parse(session.answers || '{}')
          : session.answers || {};
      const sessionMetadata = sessionAnswers._internal_metadata || {};

      return {
        id: session.user.id,
        name:
          sessionMetadata.name ||
          session.user.name ||
          session.user.email ||
          'Unknown',
        email: session.user.email,
        rollNumber:
          sessionMetadata.rollNumber || session.user.rollNumber || 'N/A',
        section: sessionMetadata.section || 'N/A',
        status:
          session.status === 'COMPLETED' ||
          (Date.now() >
            new Date(session.startTime).getTime() + exam.duration * 60000 &&
            session.status !== 'TERMINATED')
            ? 'Completed'
            : session.status === 'TERMINATED'
              ? 'Terminated'
              : 'In Progress',
        ip: session.ipAddress || 'Unknown',
        vmDetected: session.vmDetected || vmViolations.length > 0,
        vmType: vmViolations.length > 0 ? vmViolations[0].message : null,
        tabOuts: session.violations.filter(
          (v: any) => v.type === 'TAB_SWITCH' || v.type === 'TAB_SWITCH_OUT',
        ).length,
        tabIns: session.violations.filter(
          (v: any) => v.type === 'TAB_SWITCH_IN',
        ).length,
        isHighRisk: session.vmDetected || tabSwitchViolations.length > 5,
        lastActivity: new Date(session.updatedAt).toLocaleString(),
        startTime: new Date(session.startTime).toLocaleTimeString(),
        endTime: session.endTime
          ? new Date(session.endTime).toLocaleTimeString()
          : 'Ongoing',
        monitors: 1,
        loginCount: 1,
        sleepDuration: '0m',
        appVersion: 'Web',
        logs: session.violations.map((v: any) => ({
          time: new Date(v.timestamp).toLocaleTimeString(),
          event:
            v.type === 'TAB_SWITCH' || v.type === 'TAB_SWITCH_OUT'
              ? 'Tab Switch Out'
              : v.type === 'TAB_SWITCH_IN'
                ? 'Tab Switch In'
                : v.type === 'VM_DETECTED'
                  ? 'VM Detection'
                  : v.type,
          description: v.message || 'No details',
        })),
      };
    });
  }

  async getFeedbacks(examId: string, user: any) {
    // Verify ownership
    const exam = await this.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.checkAccess(exam, user);

    const feedbacks = await this.prisma.feedback.findMany({
      where: { examId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    return feedbacks.map((f: any) => ({
      id: f.id,
      userName: f.user.name || f.user.email || 'Anonymous',
      userEmail: f.user.email,
      rating: f.rating,
      comment: f.comment || '',
      time: new Date(f.timestamp).toLocaleString(),
      isSeen: false, // You can add a field to track this in the schema if needed
    }));
  }

  async terminateExamSession(examId: string, studentId: string, user: any) {
    // Verify ownership (Handle both ID and Slug)
    const isUuid = isUUID(examId);
    const examLookupWhere = isUuid
      ? { id: examId }
      : {
          slug: examId,
          ...(user.role === 'SUPER_ADMIN' ? {} : { orgId: user.orgId }),
        };

    const exam = await this.prisma.exam.findFirst({
      where: examLookupWhere as any,
    });

    if (!exam) throw new Error('Exam not found');
    await this.checkAccess(exam, user);

    const realExamId = exam.id;
    const examSlug = exam.slug;

    // Find sessions to invalidate cache
    const sessions = await this.prisma.examSession.findMany({
      where: { examId: realExamId, userId: studentId },
      select: { id: true, startTime: true },
    });

    // Update session status
    const terminatedAt = new Date();
    for (const session of sessions) {
      const computedTimeTakenSec = Math.max(
        0,
        Math.floor(
          (terminatedAt.getTime() - new Date(session.startTime).getTime()) /
            1000,
        ),
      );
      await this.prisma.examSession.update({
        where: { id: session.id },
        data: {
          status: 'TERMINATED',
          endTime: terminatedAt,
          timeTakenSec: computedTimeTakenSec,
        } as any,
      });
    }

    // Invalidate caches
    const sessionCacheKeys = sessions.flatMap((session: any) => [
      `session:status:${session.id}`,
      `session:meta:${session.id}`,
    ]);
    if (sessionCacheKeys.length > 0) {
      await this.redis.del(...sessionCacheKeys);
    }

    // Force kick via websocket - broadcast to both slug and ID rooms for maximum robustness
    await this.monitoringGateway.forceTerminate(realExamId, studentId);
    if (examSlug && examSlug !== realExamId) {
      await this.monitoringGateway.forceTerminate(examSlug, studentId);
    }

    return { success: true };
  }

  async unterminateExamSession(examId: string, studentId: string, user: any) {
    // Verify ownership (Handle both ID and Slug)
    const isUuid = isUUID(examId);
    const examLookupWhere = isUuid
      ? { id: examId }
      : {
          slug: examId,
          ...(user.role === 'SUPER_ADMIN' ? {} : { orgId: user.orgId }),
        };

    const exam = await this.prisma.exam.findFirst({
      where: examLookupWhere as any,
    });

    if (!exam) throw new Error('Exam not found');
    await this.checkAccess(exam, user);

    const realExamId = exam.id;

    // Find sessions to invalidate cache
    const sessions = await this.prisma.examSession.findMany({
      where: { examId: realExamId, userId: studentId },
    });

    // Update session status back to IN_PROGRESS
    await this.prisma.examSession.updateMany({
      where: { examId: realExamId, userId: studentId },
      data: { status: 'IN_PROGRESS', endTime: null },
    });

    // Invalidate caches to allow re-entry/re-processing
    const sessionCacheKeys = sessions.flatMap((session: any) => [
      `session:status:${session.id}`,
      `session:meta:${session.id}`,
    ]);
    if (sessionCacheKeys.length > 0) {
      await this.redis.del(...sessionCacheKeys);
    }

    return { success: true };
  }

  async getExamResults(
    examId: string,
    user: any,
    page: number = 1,
    limit: number = 50,
    search: string = '',
  ) {
    const boundedLimit = parseBoundedNumber(limit, 50, 1, 100);
    const boundedPage = parseBoundedNumber(page, 1, 1, 100000);
    const normalizedSearch = String(search || '').trim();
    const cacheKey = `teacher:exam_results:${user.id}:${user.role}:${examId}:p:${boundedPage}:l:${boundedLimit}:q:${normalizedSearch || '_'}`;

    // Verify ownership BEFORE serving cached data — caching the
    // authorization decision would let a caller who has since lost access
    // to this exam (unassigned, org/persona switch) keep seeing cached
    // results for the TTL window.
    const exam = await this.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.checkAccess(exam, user);

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const skip = (boundedPage - 1) * boundedLimit;

    // Where Clause
    const where: any = { examId };
    if (normalizedSearch) {
      where.user = {
        OR: [
          { name: { contains: normalizedSearch, mode: 'insensitive' } },
          { email: { contains: normalizedSearch, mode: 'insensitive' } },
          { rollNumber: { contains: normalizedSearch, mode: 'insensitive' } },
        ],
      };
    }

    // 2. Fetch Paginated Sessions
    const [sessions, totalFiltered] = await Promise.all([
      this.prisma.examSession.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              rollNumber: true,
            },
          },
        },
        orderBy: { endTime: 'desc' },
        skip,
        take: boundedLimit,
      }),
      this.prisma.examSession.count({ where }),
    ]);

    const computeTotalMarks = (questionsInput: any): number => {
      let dynamicTotalMarks = 0;
      let questionsData = questionsInput;

      if (typeof questionsData === 'string') {
        try {
          questionsData = JSON.parse(questionsData);
        } catch (e) {
          console.error('Failed to parse exam questions JSON', e);
          questionsData = null;
        }
      }

      const processQuestion = (q: any) => {
        const marks =
          Number(q.marks) || Number(q.points) || (q.type === 'Coding' ? 10 : 1);
        dynamicTotalMarks += marks;
      };

      if (questionsData) {
        if (questionsData.sections && Array.isArray(questionsData.sections)) {
          questionsData.sections.forEach((sec: any) => {
            if (sec.questions && Array.isArray(sec.questions)) {
              sec.questions.forEach(processQuestion);
            }
          });
        } else if (Array.isArray(questionsData)) {
          const firstItem = questionsData[0];
          if (
            firstItem &&
            (firstItem.questions || firstItem.id?.startsWith('sec-'))
          ) {
            questionsData.forEach((sec: any) => {
              if (sec.questions && Array.isArray(sec.questions)) {
                sec.questions.forEach(processQuestion);
              }
            });
          } else {
            questionsData.forEach(processQuestion);
          }
        } else if (typeof questionsData === 'object') {
          Object.values(questionsData).forEach((sec: any) => {
            if (sec && typeof sec === 'object') {
              if (sec.questions && Array.isArray(sec.questions)) {
                sec.questions.forEach(processQuestion);
              } else if (sec.id && sec.type) {
                processQuestion(sec);
              }
            }
          });
        }
      }

      return dynamicTotalMarks > 0
        ? dynamicTotalMarks
        : Number(exam.totalMarks) || 0;
    };

    const totalMarks = computeTotalMarks(exam.questions);
    const marksDenominator = totalMarks || Number(exam.totalMarks) || 100;

    // Map sessions to frontend format
    const mappedSessions = sessions.map((session: any) => {
      const answers =
        typeof session.answers === 'string'
          ? JSON.parse(session.answers)
          : session.answers || {};

      const metadata = answers._internal_metadata || {};

      const score =
        session.score !== null
          ? session.score
          : this.examService.calculateScore(answers, exam.questions);

      const status =
        totalMarks > 0
          ? score / totalMarks >= 0.4
            ? 'Passed'
            : 'Failed'
          : session.status === 'COMPLETED'
            ? 'Submitted'
            : 'Failed';

      return {
        sessionId: session.id,
        rollNo: metadata.rollNumber || session.user.rollNumber || 'N/A',
        name: metadata.name || session.user.name || 'Unknown',
        email: session.user.email,
        section: metadata.section || 'N/A',
        submittedAt: session.endTime
          ? new Date(session.endTime).toLocaleString()
          : 'Open',
        timeTaken: session.endTime
          ? Math.round(
              (new Date(session.endTime).getTime() -
                new Date(session.startTime).getTime()) /
                60000,
            ) + ' min'
          : 'N/A',
        attempted:
          Object.keys(answers).filter((k) => k.startsWith('_submitted_'))
            .length + ' Q',
        score: score,
        totalPossible: totalMarks,
        status: status,
      };
    });

    // Stats computed DB-side. Was: pull every ExamSession row for this exam and
    // sum/bucket them in a JS loop, which grew unbounded with submissions.
    // marksDenominator is known here, so the score buckets and pass threshold
    // become indexed COUNTs and avg/max become an aggregate — only a handful of
    // numbers cross the wire instead of every session. Semantics preserved:
    // a null score counts as 0 (old code used `Number(row.score) || 0`), so
    // null scores land in the 0-25% bucket and never count as passed — the
    // explicit `score: null` OR below keeps that behavior.
    const D = marksDenominator;
    const [scoreAgg, totalCount, passedCount, bucket0, bucket1, bucket2] =
      await Promise.all([
        this.prisma.examSession.aggregate({
          where: { examId },
          _sum: { score: true },
          _max: { score: true },
        }),
        this.prisma.examSession.count({ where: { examId } }),
        this.prisma.examSession.count({
          where: { examId, score: { gte: 0.4 * D } },
        }),
        this.prisma.examSession.count({
          where: { examId, OR: [{ score: { lt: 0.25 * D } }, { score: null }] },
        }),
        this.prisma.examSession.count({
          where: { examId, score: { gte: 0.25 * D, lt: 0.5 * D } },
        }),
        this.prisma.examSession.count({
          where: { examId, score: { gte: 0.5 * D, lt: 0.75 * D } },
        }),
      ]);

    const totalScore = Number(scoreAgg._sum.score || 0);
    const highScore = Number(scoreAgg._max.score || 0);
    const failedCount = totalCount - passedCount;
    // Remaining rows (score >= 0.75*D) — derived to avoid a 4th count query.
    const bucket3 = totalCount - bucket0 - bucket1 - bucket2;
    const distribution = [bucket0, bucket1, bucket2, bucket3];

    const response = {
      results: mappedSessions,
      resultsPublished: (exam as any).resultsPublished || false,
      pagination: {
        total: totalFiltered,
        page: boundedPage,
        limit: boundedLimit,
        totalPages: Math.ceil(totalFiltered / boundedLimit),
      },
      stats: {
        avgScore: totalScore / (totalCount || 1),
        passedCount,
        failedCount,
        totalCount,
        highScore,
        distribution: [
          { score: '0-25%', count: distribution[0] },
          { score: '25-50%', count: distribution[1] },
          { score: '50-75%', count: distribution[2] },
          { score: '75-100%', count: distribution[3] },
        ],
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 15);
    return response;
  }

  async updateSubmissionScore(
    sessionId: string,
    newScore: number,
    user: any,
    internalMarks?: Record<string, number>,
  ) {
    // Verify ownership via session -> exam
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: { exam: true },
    });

    if (!session) throw new Error('Session not found');
    await this.checkAccess(session.exam, user);

    const totalMarks = Number(session.exam?.totalMarks) || 0;
    const clampedScore =
      totalMarks > 0
        ? Math.max(0, Math.min(Number(newScore) || 0, totalMarks))
        : Math.max(0, Number(newScore) || 0);

    const updateData: any = { score: clampedScore };

    // If internal marks are provided, update the answers JSON
    if (internalMarks) {
      const currentAnswers = (session.answers as any) || {};
      updateData.answers = {
        ...currentAnswers,
        _internal_marks: internalMarks,
      };
    }

    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: updateData,
    });
  }

  async publishResults(examId: string, user: any) {
    const exam = await this.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.checkAccess(exam, user);

    return this.prisma.exam.update({
      where: { id: examId },
      data: { resultsPublished: true },
    });
  }

  async sendExamInvites(examId: string, data: SendExamInviteDto, user: any) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        organization: {
          select: {
            name: true,
            logo: true,
            domain: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!exam) throw new NotFoundException('Exam not found');
    await this.checkAccess(exam, user);

    const uniqueGroupIds = [
      ...new Set(
        (data.groupIds || [])
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    ];
    if (uniqueGroupIds.length === 0) {
      throw new BadRequestException('At least one group is required');
    }

    const groups = await this.prisma.studentGroup.findMany({
      where: {
        id: { in: uniqueGroupIds },
        ...(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
          ? { orgId: exam.orgId || user.orgId || undefined }
          : { teacherId: user.id }),
      },
      select: {
        id: true,
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (groups.length !== uniqueGroupIds.length) {
      throw new ForbiddenException('One or more groups are not accessible');
    }

    const recipientsMap = new Map<string, { email: string; name: string }>();
    for (const group of groups) {
      for (const student of group.students) {
        if (!student.isActive || !student.email) continue;
        const normalizedEmail = String(student.email).trim().toLowerCase();
        if (!normalizedEmail) continue;
        if (!recipientsMap.has(normalizedEmail)) {
          recipientsMap.set(normalizedEmail, {
            email: normalizedEmail,
            name: student.name || normalizedEmail,
          });
        }
      }
    }

    const recipients = Array.from(recipientsMap.values());
    if (recipients.length === 0) {
      return { queued: 0 };
    }

    const jobs = recipients.map((recipient) => ({
      name: 'exam-invite',
      data: {
        recipient,
        customMessage: data.customMessage?.trim() || undefined,
        exam: {
          id: exam.id,
          title: exam.title,
          slug: exam.slug,
          duration: exam.duration,
          testCode: exam.testCode,
          startTime: exam.startTime,
          endTime: exam.endTime,
        },
        organization: {
          name: exam.organization?.name || 'Mentrily',
          logo: exam.organization?.logo || undefined,
          primaryColor: exam.organization?.primaryColor || undefined,
          domain: exam.organization?.domain || undefined,
        },
      },
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }));

    await this.examInviteQueue.addBulk(jobs as any);

    return { queued: recipients.length };
  }
}
