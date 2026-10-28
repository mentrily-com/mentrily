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
  examAccessSelect,
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
    // questions is omitted from the row fetch: the list only shows section
    // counts, so those are computed in SQL instead of shipping every exam's
    // full questions JSON to Node.
    const rawExams = await this.prisma.exam.findMany({
      where,
      omit: { questions: true },
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

    const sectionRows: Array<{ id: string; sections: any }> =
      rawExams.length > 0
        ? await this.prisma.$queryRaw`
            SELECT e.id,
              COALESCE((
                SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'id', s->'id',
                  'title', s->'title',
                  'questionCount', CASE WHEN jsonb_typeof(s->'questions') = 'array'
                    THEN jsonb_array_length(s->'questions') ELSE 0 END
                )) ORDER BY ord)
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(e.questions) = 'array' THEN e.questions
                    WHEN jsonb_typeof(e.questions->'sections') = 'array' THEN e.questions->'sections'
                    ELSE '[]'::jsonb
                  END
                ) WITH ORDINALITY AS t(s, ord)
              ), '[]'::jsonb) AS sections
            FROM "Exam" e
            WHERE e.id IN (${Prisma.join(rawExams.map((e) => e.id))})
          `
        : [];
    const sectionsById = new Map(sectionRows.map((r) => [r.id, r.sections]));

    const response = rawExams.map((exam: any) => ({
      ...exam,
      questions: sectionsById.get(exam.id) || [],
    }));

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

    await this.assertExamSlugAvailable(examPayload.slug);
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

    if (updateData.slug !== existing.slug) {
      await this.assertExamSlugAvailable(String(updateData.slug), id);
    }

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
    // code-execution caches questions (hidden tests) by id and slug.
    await this.redis.del(
      `exam:questions:${id}`,
      `exam:questions:${existing.slug}`,
      `exam:questions:${updatedExam.slug}`,
    );

    // session:meta caches durationMins for the flush deadline; drop it for
    // live attempts so a duration change takes effect immediately.
    if (
      updatedExam.duration !== undefined &&
      updatedExam.duration !== existing.duration
    ) {
      const live = await this.prisma.examSession.findMany({
        where: { examId: id, status: 'IN_PROGRESS' },
        select: { id: true },
      });
      for (let i = 0; i < live.length; i += 500) {
        await this.redis.del(
          ...live.slice(i, i + 500).map((s) => `session:meta:${s.id}`),
        );
      }
    }

    return updatedExam;
  }

  /**
   * Every slug-keyed exam cache entry, so an edit (e.g. clearing
   * allowedIPs) can't keep being served stale via check-status/lookup/
   * public-status for up to their TTL — see exam.service.ts's
   * getExamIdBySlug (1hr TTL, backs enterExam's IP-allowlist check),
   * getPublicStatus, and checkExamStatus for the corresponding reads.
   */
  /**
   * Exam URLs are /exam/:slug with no org in them, and slug lookups take the
   * first match, so a custom slug reused by another org would route that
   * org's students to the wrong exam. The schema only enforces per-org.
   */
  private async assertExamSlugAvailable(slug: string, excludeId?: string) {
    const taken = await this.prisma.exam.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (taken) {
      throw new BadRequestException(
        'That exam URL is already taken. Please choose a different one.',
      );
    }
  }

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

  /** Monitor polls hit this every 5s per proctor; skip the questions JSON. */
  private async findExamForAccess(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: examAccessSelect,
    });
    if (!exam) throw new Error('Exam not found');
    return exam;
  }

  /** Latest violations embedded per monitor row; the full log is paginated. */
  static readonly MONITOR_RECENT_LOGS = 5;
  // One rebuild per exam per process, shared by concurrent proctor polls.
  private readonly monitorBuilds = new Map<string, Promise<string>>();

  private static violationEvent(type: string): string {
    return type === 'TAB_SWITCH' || type === 'TAB_SWITCH_OUT'
      ? 'Tab Switch Out'
      : type === 'TAB_SWITCH_IN'
        ? 'Tab Switch In'
        : type === 'VM_DETECTED'
          ? 'VM Detection'
          : type;
  }

  private static toLog(v: {
    type: string;
    message: string | null;
    timestamp: Date | string;
  }) {
    return {
      time: new Date(v.timestamp).toLocaleTimeString(),
      event: TeacherExamsService.violationEvent(v.type),
      description: v.message || 'No details',
    };
  }

  async getMonitoredStudents(examId: string, user: any) {
    // Verify ownership
    const exam = await this.findExamForAccess(examId);
    await this.teacherService.checkAccess(exam, user);

    // Shared 3s cache: every proctor of this exam polls every 5s, so the
    // result is built once per window and served to the rest.
    const cacheKey = `teacher:monitored:${exam.id}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    let build = this.monitorBuilds.get(exam.id);
    if (!build) {
      build = this.buildMonitoredStudents(exam).finally(() =>
        this.monitorBuilds.delete(exam.id),
      );
      this.monitorBuilds.set(exam.id, build);
    }
    return JSON.parse(await build);
  }

  private async buildMonitoredStudents(exam: {
    id: string;
    duration: number;
  }): Promise<string> {
    // Violation counts are aggregated in SQL and only the latest few rows per
    // session come back; the full log is served by getSessionViolations.
    // answers->'_internal_metadata' avoids shipping the full answers JSON.
    const rawSessions: Array<{
      id: string;
      userId: string;
      status: string;
      startTime: Date;
      endTime: Date | null;
      updatedAt: Date;
      ipAddress: string | null;
      vmDetected: boolean;
      sessionMetadata: any;
      user_id: string;
      user_name: string | null;
      user_email: string;
      user_rollNumber: string | null;
      total: number;
      tabOuts: number;
      tabIns: number;
      vmCount: number;
      vmType: string | null;
      recent: Array<{
        type: string;
        message: string | null;
        timestamp: string;
      }>;
    }> = await this.prisma.$queryRaw`
      SELECT
        es.id,
        es."userId",
        es.status,
        es."startTime",
        es."endTime",
        es."updatedAt",
        es."ipAddress",
        es."vmDetected",
        es.answers->'_internal_metadata' AS "sessionMetadata",
        u.id AS user_id,
        u.name AS user_name,
        u.email AS user_email,
        u."rollNumber" AS "user_rollNumber",
        COALESCE(vc.total, 0)::int AS total,
        COALESCE(vc."tabOuts", 0)::int AS "tabOuts",
        COALESCE(vc."tabIns", 0)::int AS "tabIns",
        COALESCE(vc."vmCount", 0)::int AS "vmCount",
        vc."vmType",
        COALESCE(rv.recent, '[]'::json) AS recent
      FROM "ExamSession" es
      JOIN "User" u ON u.id = es."userId"
      LEFT JOIN (
        SELECT
          v."sessionId",
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE v.type IN ('TAB_SWITCH', 'TAB_SWITCH_OUT')) AS "tabOuts",
          COUNT(*) FILTER (WHERE v.type = 'TAB_SWITCH_IN') AS "tabIns",
          COUNT(*) FILTER (WHERE v.type = 'VM_DETECTED') AS "vmCount",
          (ARRAY_AGG(v.message ORDER BY v.timestamp DESC)
            FILTER (WHERE v.type = 'VM_DETECTED'))[1] AS "vmType"
        FROM "Violation" v
        JOIN "ExamSession" s ON s.id = v."sessionId"
        WHERE s."examId" = ${exam.id}
        GROUP BY v."sessionId"
      ) vc ON vc."sessionId" = es.id
      LEFT JOIN LATERAL (
        SELECT json_agg(r ORDER BY r.timestamp DESC) AS recent
        FROM (
          SELECT v.type, v.message, v.timestamp
          FROM "Violation" v
          WHERE v."sessionId" = es.id
          ORDER BY v.timestamp DESC
          LIMIT ${TeacherExamsService.MONITOR_RECENT_LOGS}
        ) r
      ) rv ON true
      WHERE es."examId" = ${exam.id}
      ORDER BY es."startTime" DESC
    `;

    // Transform to frontend format
    const result = rawSessions.map((session) => {
      const sessionMetadata =
        typeof session.sessionMetadata === 'string'
          ? JSON.parse(session.sessionMetadata || '{}')
          : session.sessionMetadata || {};
      const tabOuts = Number(session.tabOuts);
      const tabIns = Number(session.tabIns);
      const vmCount = Number(session.vmCount);

      return {
        id: session.user_id,
        sessionId: session.id,
        name:
          sessionMetadata.name ||
          session.user_name ||
          session.user_email ||
          'Unknown',
        email: session.user_email,
        rollNumber:
          sessionMetadata.rollNumber || session.user_rollNumber || 'N/A',
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
        vmDetected: session.vmDetected || vmCount > 0,
        vmType: vmCount > 0 ? session.vmType : null,
        tabOuts,
        tabIns,
        isHighRisk: session.vmDetected || tabOuts + tabIns > 5,
        lastActivity: new Date(session.updatedAt).toLocaleString(),
        startTime: new Date(session.startTime).toLocaleTimeString(),
        endTime: session.endTime
          ? new Date(session.endTime).toLocaleTimeString()
          : 'Ongoing',
        monitors: 1,
        loginCount: 1,
        sleepDuration: '0m',
        appVersion: 'Web',
        violationCounts: {
          total: Number(session.total),
          tabOuts,
          tabIns,
          vmDetected: vmCount,
        },
        logs: (session.recent || []).map((v) => TeacherExamsService.toLog(v)),
      };
    });

    const serialized = JSON.stringify(result);
    try {
      await this.redis.set(`teacher:monitored:${exam.id}`, serialized, 'EX', 3);
    } catch {}
    return serialized;
  }

  /** Full, paginated violation log for one session (monitor detail view). */
  async getSessionViolations(
    examId: string,
    sessionId: string,
    user: any,
    page: number | string = 1,
    limit: number | string = 100,
  ) {
    const exam = await this.findExamForAccess(examId);
    await this.teacherService.checkAccess(exam, user);

    const boundedLimit = parseBoundedNumber(limit, 100, 1, 500);
    const boundedPage = parseBoundedNumber(page, 1, 1, 100000);
    // Scoped by examId so a session id from another exam/tenant can't be read.
    const where = { sessionId, session: { examId: exam.id } };
    const [rows, total] = await Promise.all([
      this.prisma.violation.findMany({
        where,
        select: { type: true, message: true, timestamp: true },
        orderBy: { timestamp: 'desc' },
        skip: (boundedPage - 1) * boundedLimit,
        take: boundedLimit,
      }),
      this.prisma.violation.count({ where }),
    ]);

    return {
      logs: rows.map((v) => TeacherExamsService.toLog(v)),
      pagination: {
        total,
        page: boundedPage,
        limit: boundedLimit,
        totalPages: Math.ceil(total / boundedLimit),
      },
    };
  }

  async getFeedbacks(examId: string, user: any) {
    // Verify ownership
    const exam = await this.findExamForAccess(examId);
    await this.teacherService.checkAccess(exam, user);

    // Polled every 5s alongside the monitor view.
    const cacheKey = `teacher:feedbacks:${exam.id}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      /* cache is best-effort */
    }

    const feedbacks = await this.prisma.feedback.findMany({
      where: { examId: exam.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });

    const result = feedbacks.map((f: any) => ({
      id: f.id,
      userName: f.user.name || f.user.email || 'Anonymous',
      userEmail: f.user.email,
      rating: f.rating,
      comment: f.comment || '',
      time: new Date(f.timestamp).toLocaleString(),
      isSeen: false, // You can add a field to track this in the schema if needed
    }));

    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 5);
    } catch {
      /* cache is best-effort */
    }
    return result;
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

    // Only live attempts: COMPLETED/TERMINATED rows are final and must never
    // be overwritten (a graded submission would lose its endTime/status).
    const sessions = await this.prisma.examSession.findMany({
      where: { examId: realExamId, userId: studentId, status: 'IN_PROGRESS' },
      select: { id: true },
    });

    if (sessions.length > 0) {
      await this.prisma.$executeRaw`
        UPDATE "ExamSession"
        SET
          "status" = 'TERMINATED',
          "endTime" = (NOW() AT TIME ZONE 'UTC'),
          "timeTakenSec" = GREATEST(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "startTime"))::INT, 0),
          "updatedAt" = (NOW() AT TIME ZONE 'UTC')
        WHERE "examId" = ${realExamId}
          AND "userId" = ${studentId}
          AND "status" = 'IN_PROGRESS'
      `;
    }

    // Invalidate caches
    const sessionCacheKeys = [
      ...sessions.flatMap((session: any) => [
        `session:status:${session.id}`,
        `session:meta:${session.id}`,
      ]),
      `teacher:monitored:${realExamId}`,
    ];
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

    // Reopen only the latest TERMINATED attempt, never a COMPLETED one, and
    // only while the student has no other live attempt (guarded in the
    // UPDATE itself so a concurrent re-entry can't produce two).
    const target = await this.prisma.examSession.findFirst({
      where: { examId: realExamId, userId: studentId, status: 'TERMINATED' },
      orderBy: { startTime: 'desc' },
      select: { id: true },
    });
    if (!target) {
      throw new BadRequestException('No terminated session to restore');
    }

    const reopened: number = await this.prisma.$executeRaw`
      UPDATE "ExamSession"
      SET "status" = 'IN_PROGRESS', "endTime" = NULL,
          "updatedAt" = (NOW() AT TIME ZONE 'UTC')
      WHERE "id" = ${target.id}
        AND "status" = 'TERMINATED'
        AND NOT EXISTS (
          SELECT 1 FROM "ExamSession" o
          WHERE o."examId" = ${realExamId}
            AND o."userId" = ${studentId}
            AND o."status" = 'IN_PROGRESS'
        )
    `;
    if (reopened === 0) {
      throw new BadRequestException(
        'Student already has an active attempt for this exam',
      );
    }

    // Drop the cached TERMINATED status/meta, and reset the tab-switch
    // counters to 0 rather than deleting them: a missing counter rehydrates
    // from the Violation table, which would re-terminate on the next switch.
    await this.redis
      .multi()
      .del(
        `session:status:${target.id}`,
        `session:meta:${target.id}`,
        `teacher:monitored:${realExamId}`,
      )
      .set(`violation:count:in:${target.id}`, '0', 'EX', 6 * 60 * 60)
      .set(`violation:count:out:${target.id}`, '0', 'EX', 6 * 60 * 60)
      .exec();

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

    // Escape LIKE wildcards so the search matches literally, like Prisma's
    // `contains` in the count below.
    const searchPattern = `%${normalizedSearch.replace(/[\\%_]/g, '\\$&')}%`;
    const searchSql = normalizedSearch
      ? Prisma.sql`AND (u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR u."rollNumber" ILIKE ${searchPattern})`
      : Prisma.empty;

    // 2. Fetch Paginated Sessions. Only metadata and the _submitted_ key
    // count come back; the full answers JSON is fetched only for rows that
    // still need a score computed (score IS NULL).
    const [sessions, totalFiltered] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string;
          startTime: Date;
          endTime: Date | null;
          score: number | null;
          status: string;
          metadata: any;
          submittedCount: number;
          answers: any;
          user_name: string | null;
          user_email: string;
          user_rollNumber: string | null;
        }>
      >`
        SELECT
          es.id,
          es."startTime",
          es."endTime",
          es.score,
          es.status,
          es.answers->'_internal_metadata' AS metadata,
          (
            SELECT COUNT(*)::int
            FROM jsonb_object_keys(
              CASE WHEN jsonb_typeof(es.answers) = 'object' THEN es.answers ELSE '{}'::jsonb END
            ) AS k
            WHERE left(k, 11) = '_submitted_'
          ) AS "submittedCount",
          CASE WHEN es.score IS NULL THEN es.answers END AS answers,
          u.name AS user_name,
          u.email AS user_email,
          u."rollNumber" AS "user_rollNumber"
        FROM "ExamSession" es
        JOIN "User" u ON u.id = es."userId"
        WHERE es."examId" = ${examId}
        ${searchSql}
        ORDER BY es."endTime" DESC
        LIMIT ${boundedLimit} OFFSET ${skip}
      `,
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
    // session.score is a percentage (0-100), so pass/fail and the buckets compare
    // against percentages, not marks.
    // findExamByIdCompat's legacy select omits passingPercentage (older DBs
    // lack the column), so read it on its own and fall back to 40%.
    const passRow: any = await this.prisma.exam
      .findUnique({
        where: { id: exam.id },
        select: { passingPercentage: true } as any,
      })
      .catch(() => null);
    const passPct =
      passRow?.passingPercentage != null &&
      Number.isFinite(Number(passRow.passingPercentage))
        ? Number(passRow.passingPercentage)
        : 40;

    // Map sessions to frontend format
    const mappedSessions = sessions.map((session) => {
      const answers =
        typeof session.answers === 'string'
          ? JSON.parse(session.answers)
          : session.answers || {};

      const metadata =
        (typeof session.metadata === 'string'
          ? JSON.parse(session.metadata)
          : session.metadata) || {};

      const score =
        session.score !== null
          ? session.score
          : this.examService.calculateScore(answers, exam.questions);

      const status =
        totalMarks > 0
          ? score >= passPct
            ? 'Passed'
            : 'Failed'
          : session.status === 'COMPLETED'
            ? 'Submitted'
            : 'Failed';

      return {
        sessionId: session.id,
        rollNo: metadata.rollNumber || session.user_rollNumber || 'N/A',
        name: metadata.name || session.user_name || 'Unknown',
        email: session.user_email,
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
        attempted: Number(session.submittedCount) + ' Q',
        score: score,
        marksObtained:
          Math.round((((score || 0) * totalMarks) / 100) * 100) / 100,
        totalPossible: totalMarks,
        status: status,
      };
    });

    // Stats computed DB-side. Was: pull every ExamSession row for this exam and
    // sum/bucket them in a JS loop, which grew unbounded with submissions.
    // Scores are percentages, so the buckets and pass threshold are fixed
    // percentages and become indexed COUNTs; avg/max are an aggregate — only a handful of
    // numbers cross the wire instead of every session. Semantics preserved:
    // a null score counts as 0 (old code used `Number(row.score) || 0`), so
    // null scores land in the 0-25% bucket and never count as passed — the
    // explicit `score: null` OR below keeps that behavior.
    const [agg] = await this.prisma.$queryRaw<
      Array<{
        totalScore: number;
        highScore: number;
        totalCount: number;
        passedCount: number;
        bucket0: number;
        bucket1: number;
        bucket2: number;
      }>
    >`
      SELECT
        COALESCE(SUM(score), 0)::float8 AS "totalScore",
        COALESCE(MAX(score), 0)::float8 AS "highScore",
        COUNT(*)::int AS "totalCount",
        COUNT(*) FILTER (WHERE score >= ${passPct})::int AS "passedCount",
        COUNT(*) FILTER (WHERE score < 25 OR score IS NULL)::int AS bucket0,
        COUNT(*) FILTER (WHERE score >= 25 AND score < 50)::int AS bucket1,
        COUNT(*) FILTER (WHERE score >= 50 AND score < 75)::int AS bucket2
      FROM "ExamSession"
      WHERE "examId" = ${examId}
    `;

    const totalScore = Number(agg?.totalScore || 0);
    const highScore = Number(agg?.highScore || 0);
    const totalCount = Number(agg?.totalCount || 0);
    const passedCount = Number(agg?.passedCount || 0);
    const bucket0 = Number(agg?.bucket0 || 0);
    const bucket1 = Number(agg?.bucket1 || 0);
    const bucket2 = Number(agg?.bucket2 || 0);
    const failedCount = totalCount - passedCount;
    // Remaining rows (score >= 75%).
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
      select: {
        id: true,
        exam: {
          select: { ...examAccessSelect, totalMarks: true, questions: true },
        },
      },
    });

    if (!session) throw new Error('Session not found');
    await this.teacherService.checkAccess(session.exam, user);

    // The grader sends earned marks; `score` is stored as a percentage
    // everywhere else (results, certificates, pass checks), so convert using
    // the same denominator calculateScoreDetails uses.
    const totalMarks =
      this.examService.calculateScoreDetails({}, session.exam?.questions)
        .totalMarks ||
      Number(session.exam?.totalMarks) ||
      0;
    const earnedMarks =
      totalMarks > 0
        ? Math.max(0, Math.min(Number(newScore) || 0, totalMarks))
        : 0;
    const percentage =
      totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 10000) / 100 : 0;

    const internalScore = {
      earnedMarks: Math.round(earnedMarks * 100) / 100,
      totalMarks,
      percentage,
    };
    const patch: Record<string, unknown> = { _internal_score: internalScore };
    if (internalMarks && typeof internalMarks === 'object') {
      const marks: Record<string, number> = {};
      for (const [qId, value] of Object.entries(internalMarks)) {
        const n = Number(value);
        if (Number.isFinite(n)) marks[qId] = n;
      }
      patch._internal_marks = marks;
    }

    // jsonb merge in SQL: a read-modify-write of the whole answers object
    // could drop answers flushed between the read and this write.
    await this.prisma.$executeRaw`
      UPDATE "ExamSession"
      SET "score" = ${percentage},
          "answers" = COALESCE("answers", '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
          "updatedAt" = (NOW() AT TIME ZONE 'UTC')
      WHERE "id" = ${sessionId}
    `;

    return { id: sessionId, score: percentage, ...internalScore };
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
