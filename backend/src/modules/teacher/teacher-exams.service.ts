import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { MonitoringGateway } from '../monitoring/monitoring.gateway';
import { ExamService } from '../exam/exam.service';
import { QuotaService } from '../billing/quota.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendExamInviteDto } from './dto/send-exam-invite.dto';
import { TeacherService } from './teacher.service';
import { TeacherCoursesService } from './teacher-courses.service';
import { normalizeSlug } from '../common/slug.util';
import {
  collectQuestionTypesFromExamContent,
  isUUID,
  legacyExamSelect,
  isMissingExamAttemptFieldError,
  parseBoundedNumber,
} from './teacher.util';

/**
 * Exam CRUD, monitoring, grading, and invites, split out of the former
 * monolithic TeacherService -- see teacher-groups.service.ts for the full
 * context on why. checkAccess, slug generation, createExamRecordWithRetry,
 * findExamByIdCompat, assertLinkableCourse, enforceQuestionTypeAccess, and
 * invalidateTeacherExamListCache all remain on TeacherService
 * (TeacherCoursesService needs several of the same ones), injected here
 * rather than duplicated. invalidateExamCaches moved here in full since it
 * was only ever called from within this section. createExam auto-linking a
 * course also needs TeacherCoursesService.linkExamToCourse -- this is the
 * one place the split services depend on each other, and it only goes this
 * direction (Exams -> Courses), so there's no circular DI.
 */
@Injectable()
export class TeacherExamsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly teacherService: TeacherService,
    private readonly teacherCoursesService: TeacherCoursesService,
    private readonly monitoringGateway: MonitoringGateway,
    private readonly examService: ExamService,
    private readonly quotaService: QuotaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('exam-invite-email') private readonly examInviteQueue: Queue,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
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

      await this.teacherService.checkAccess(course, user);

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
        return this.teacherService.findExamByIdCompat(existingLinkedExamId);
      }
    }

    const questionTypes = collectQuestionTypesFromExamContent(
      data.sections || data.questions || [],
    );
    await this.teacherService.enforceQuestionTypeAccess(
      user,
      questionTypes,
      orgId,
    );
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
      slug: (await this.teacherService.canUseCustomSlug(orgId))
        ? normalizeSlug(String(data.slug || '')) ||
          (await this.teacherService.createUniqueSlug(
            'exam',
            data.title,
            orgId,
          ))
        : await this.teacherService.createUniqueSlug('exam', data.title, orgId),
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

    const exam = await this.teacherService.createExamRecordWithRetry(
      examPayload,
      data.title,
      orgId,
    );

    if (linkedCourseId) {
      await this.teacherCoursesService.linkExamToCourse(
        linkedCourseId,
        exam.id,
        user,
        {
          examPassThreshold: Number.isFinite(Number(data.examPassThreshold))
            ? Number(data.examPassThreshold)
            : 70,
          examUnlockThreshold: data.examUnlockThreshold,
          passingPercentage,
          maxAttempts,
          attemptBufferMins,
        },
      );
    }

    await this.quotaService.recordExamCreated({
      orgId,
      userId: user.id,
      examId: exam.id,
    });
    await this.teacherService.invalidateTeacherExamListCache(user);
    return this.teacherService.findExamByIdCompat(exam.id);
  }

  async updateExam(id: string, user: any, data: any) {
    const existing = await this.teacherService.findExamByIdCompat(id);
    if (!existing) throw new Error('Exam not found');
    await this.teacherService.checkAccess(existing, user);
    await this.teacherService.enforceQuestionTypeAccess(
      user,
      collectQuestionTypesFromExamContent(
        data.sections || data.questions || [],
      ),
      existing.orgId || user.orgId,
    );

    if (typeof data.linkedCourseId === 'string' && data.linkedCourseId.trim()) {
      await this.teacherService.assertLinkableCourse(
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
      slug: (await this.teacherService.canUseCustomSlug(
        existing.orgId || user.orgId,
      ))
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
      if (isMissingExamAttemptFieldError(error)) {
        delete updateData.passingPercentage;
        delete updateData.maxAttempts;
        delete updateData.attemptBufferMins;

        updatedExam = await this.prisma.exam.update({
          where: { id },
          data: updateData as any,
          select: legacyExamSelect as any,
        });
      } else if (
        (error as any)?.code === 'P2002' &&
        String((error as any)?.meta?.target || '').includes('testCode')
      ) {
        throw new BadRequestException(
          'That test code is already in use by another exam. Please choose a different code.',
        );
      } else {
        throw error;
      }
    }

    // Invalidate Redis cache
    await this.invalidateExamCaches(updatedExam.slug);
    if (existing.slug !== updatedExam.slug) {
      await this.invalidateExamCaches(existing.slug);
    }
    await this.teacherService.invalidateTeacherExamListCache(user);

    return updatedExam;
  }

  /**
   * Every slug-keyed exam cache entry, so an edit (e.g. clearing
   * allowedIPs) can't keep being served stale via check-status/lookup/
   * public-status for up to their TTL — see exam.service.ts's
   * getExamIdBySlug (1hr TTL, backs enterExam's IP-allowlist check),
   * getPublicStatus, and checkExamStatus for the corresponding reads.
   */
  async invalidateExamCaches(slug: string): Promise<void> {
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
      const exam = await this.teacherService.findExamByIdCompat(id);
      if (!exam) return { success: true, message: 'Exam already deleted' };
      await this.teacherService.checkAccess(exam, user);

      await this.prisma.$transaction(async (tx) => {
        await tx.feedback.deleteMany({ where: { examId: id } });
        await tx.violation.deleteMany({ where: { session: { examId: id } } });
        await tx.examSession.deleteMany({ where: { examId: id } });
        await tx.exam.delete({ where: { id } });
      });

      await this.invalidateExamCaches(exam.slug);
      await this.teacherService.invalidateTeacherExamListCache(user);

      return { success: true, deleted: { id } };
    } catch (e) {
      console.error(`[TeacherService] Final delete failed for exam ${id}:`, e);
      throw new Error(`Failed to delete exam: ${e.message}`);
    }
  }

  async getMonitoredStudents(examId: string, user: any) {
    // Verify ownership
    const exam = await this.teacherService.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.teacherService.checkAccess(exam, user);

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
    const exam = await this.teacherService.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.teacherService.checkAccess(exam, user);

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
    await this.teacherService.checkAccess(exam, user);

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
    await this.teacherService.checkAccess(exam, user);

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
    const exam = await this.teacherService.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.teacherService.checkAccess(exam, user);

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
      resultsPublished: exam.resultsPublished || false,
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
    await this.teacherService.checkAccess(session.exam, user);

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
    const exam = await this.teacherService.findExamByIdCompat(examId);
    if (!exam) throw new Error('Exam not found');
    await this.teacherService.checkAccess(exam, user);

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
    await this.teacherService.checkAccess(exam, user);

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
