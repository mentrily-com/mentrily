import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { CourseService } from '../course/course.service';
import { QuotaService } from '../billing/quota.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TeacherService } from './teacher.service';
import { generateRandomSlug, normalizeSlug } from '../common/slug.util';
import {
  normalizeCourseSections,
  normalizeCourseStatus,
  collectQuestionTypesFromUnits,
  isUUID,
  legacyExamSelect,
  isMissingExamAttemptFieldError,
  parseOptionalDate,
} from './teacher.util';

/**
 * Course CRUD and exam-linking, split out of the former monolithic
 * TeacherService -- see teacher-groups.service.ts for the full context on
 * why. checkAccess, slug generation (canUseCustomSlug/createUniqueSlug/
 * resolveIncomingSlug), createCourseRecordWithRetry, findExamByIdCompat,
 * assertLinkableExam, assertLinkableCertificateTemplate, and
 * enforceQuestionTypeAccess all remain on TeacherService (courses and exams
 * share most of this cross-cutting surface, and TeacherExamsService needs
 * several of the same ones), injected here rather than duplicated.
 */
@Injectable()
export class TeacherCoursesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly teacherService: TeacherService,
    private readonly courseService: CourseService,
    private readonly quotaService: QuotaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
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

  async deleteCourse(id: string, user: any) {
    try {
      const course = await this.prisma.course.findUnique({ where: { id } });
      if (!course) return { success: true, message: 'Course already deleted' };
      await this.teacherService.checkAccess(course, user);

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
    await this.teacherService.checkAccess(course, user);

    const exam = await this.teacherService.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.teacherService.checkAccess(exam, user);

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
    await this.teacherService.checkAccess(course, user);

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
    await this.teacherService.checkAccess(existing, user);
    const orgId = existing.orgId || user.orgId;

    const hasSectionPayload =
      Array.isArray(data?.sections) || Array.isArray(data?.modules);
    const incomingSections = normalizeCourseSections(data);

    if (hasSectionPayload) {
      const incomingTypes = collectQuestionTypesFromUnits(
        incomingSections.flatMap((section: any) => section?.questions || []),
      );
      await this.teacherService.enforceQuestionTypeAccess(
        user,
        incomingTypes,
        orgId,
      );
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
      await this.teacherService.assertLinkableExam(
        data.linkedExamId,
        orgId,
        user,
      );
    }
    if (
      typeof data.certificateTemplateId === 'string' &&
      data.certificateTemplateId.trim()
    ) {
      await this.teacherService.assertLinkableCertificateTemplate(
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
        slug: (await this.teacherService.canUseCustomSlug(orgId))
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
            (await this.teacherService.createUniqueSlug(
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
    await this.teacherService.enforceQuestionTypeAccess(
      user,
      inputTypes,
      orgId,
    );
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
      await this.teacherService.assertLinkableExam(
        data.linkedExamId,
        orgId,
        user,
      );
    }
    if (
      typeof data.certificateTemplateId === 'string' &&
      data.certificateTemplateId.trim()
    ) {
      await this.teacherService.assertLinkableCertificateTemplate(
        data.certificateTemplateId,
        orgId,
        user,
      );
    }

    const normalizedStatus = normalizeCourseStatus(data.status, data.isVisible);
    const normalizedVisibility =
      normalizedStatus === 'Published'
        ? true
        : normalizedStatus === 'Draft'
          ? false
          : !!data.isVisible;

    const course = await this.teacherService.createCourseRecordWithRetry(
      {
        title: data.title,
        slug: await this.teacherService.resolveIncomingSlug(
          data.slug,
          data.title,
          orgId,
        ),
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
}
