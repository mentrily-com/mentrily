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

  private parseOptionalDate(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private readonly legacyExamSelect = {
    id: true,
    slug: true,
    title: true,
    shortDescription: true,
    longDescription: true,
    difficulty: true,
    tags: true,
    duration: true,
    totalMarks: true,
    testCode: true,
    testCodeType: true,
    rotationInterval: true,
    inviteToken: true,
    allowedIPs: true,
    examMode: true,
    aiProctoring: true,
    tabSwitchLimit: true,
    strictness: true,
    startTime: true,
    endTime: true,
    timeZone: true,
    questions: true,
    isActive: true,
    resultsPublished: true,
    aiTokensUsed: true,
    creatorId: true,
    linkedCourseId: true,
    orgId: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private parseBoundedNumber(
    value: string | number | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(numeric)));
  }

  private async canUseCustomSlug(orgId?: string | null): Promise<boolean> {
    if (!orgId) return false;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, features: true },
    });

    const plan = (org?.plan as PlanKey) || 'FREE';
    const overrides =
      org?.features && typeof org.features === 'object' && !Array.isArray(org.features)
        ? (org.features as Record<string, unknown>)
        : {};

    return Boolean({
      ...(PLAN_FEATURES[plan] || PLAN_FEATURES.FREE),
      ...overrides,
    }.customSlug);
  }

  private async createUniqueSlug(
    model: 'course' | 'exam' | 'courseTest',
    title: string,
    orgId?: string | null,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const slug = generateRandomSlug(title, model === 'courseTest' ? 'test' : model);
      const exists =
        model === 'course'
          ? await this.prisma.course.findFirst({ where: { slug, orgId: orgId || null }, select: { id: true } })
          : model === 'exam'
            ? await this.prisma.exam.findFirst({ where: { slug, orgId: orgId || null }, select: { id: true } })
            : await this.prisma.courseTest.findFirst({ where: { slug, orgId: orgId || null }, select: { id: true } });

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

  private async createCourseRecordWithRetry(data: Prisma.CourseCreateInput, title: string, orgId?: string | null) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.course.create({
          data: {
            ...data,
            slug: attempt === 0 ? data.slug : await this.createUniqueSlug('course', title, orgId),
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
            slug: attempt === 0 ? data.slug : await this.createUniqueSlug('exam', title, orgId),
          } as any,
          select: this.legacyExamSelect as any,
        });
      } catch (error) {
        if (this.isMissingExamAttemptFieldError(error)) {
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
            select: this.legacyExamSelect as any,
          });
        }

        if ((error as any)?.code !== 'P2002' || attempt === 2) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Unable to create exam');
  }

  private isMissingExamAttemptFieldError(error: unknown): boolean {
    if (
      typeof error !== 'object' ||
      error === null ||
      (error as any).code !== 'P2022'
    ) {
      return false;
    }

    const column = String((error as any)?.meta?.column || '');
    return (
      column.includes('passingPercentage') ||
      column.includes('maxAttempts') ||
      column.includes('attemptBufferMins')
    );
  }

  private async findExamByIdCompat(id: string): Promise<any> {
    return this.prisma.exam.findUnique({
      where: { id },
      select: this.legacyExamSelect as any,
    });
  }

  private normalizeCourseStatus(
    status: unknown,
    isVisible?: boolean,
  ): 'Draft' | 'Published' | 'Archived' {
    if (typeof status === 'string') {
      const normalized = status.trim().toLowerCase();
      if (normalized === 'published') return 'Published';
      if (normalized === 'archived') return 'Archived';
      if (normalized === 'draft') return 'Draft';
    }

    if (typeof isVisible === 'boolean') {
      return isVisible ? 'Published' : 'Draft';
    }

    return isVisible ? 'Published' : 'Draft';
  }

  private collectQuestionTypesFromUnits(units: any[]): Set<string> {
    const types = new Set<string>();
    for (const unit of units || []) {
      const normalizedType = String(unit?.type || '')
        .trim()
        .toLowerCase();
      if (normalizedType) {
        types.add(normalizedType);
      }
    }
    return types;
  }

  private collectQuestionTypesFromExamContent(payload: unknown): Set<string> {
    const types = new Set<string>();

    const visit = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      if (typeof value !== 'object') {
        return;
      }

      const normalizedType = String(value.type || value.questionType || '')
        .trim()
        .toLowerCase();
      if (normalizedType) {
        types.add(normalizedType);
      }

      if (Array.isArray(value.questions)) {
        value.questions.forEach(visit);
      }
      if (Array.isArray(value.sections)) {
        value.sections.forEach(visit);
      }
    };

    visit(payload);
    return types;
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

  private async checkAccess(resource: any, user: any) {
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

  /**
   * The group CRUD methods below used to grant ANY user with role ADMIN
   * full read/write/delete access to ANY group platform-wide (a bare
   * `user.role === 'ADMIN'` check with no org match) — a plain global-role
   * check like the ones already fixed in monitoring.gateway.ts. Now that
   * self-serve Creator personas exist, org-scoping this is required.
   */
  private assertGroupAccess(
    group: { teacherId: string; orgId: string | null },
    user: any,
  ): void {
    if (group.teacherId === user.id) return;
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'ADMIN' && group.orgId && group.orgId === user.orgId) {
      return;
    }
    throw new ForbiddenException('Access denied');
  }

  /** Same bare-ADMIN-bypass bug as assertGroupAccess, same fix. */
  private assertAnnouncementAccess(
    announcement: { teacherId: string; orgId: string | null },
    user: any,
  ): void {
    if (announcement.teacherId === user.id) return;
    if (user.role === 'SUPER_ADMIN') return;
    if (
      user.role === 'ADMIN' &&
      announcement.orgId &&
      announcement.orgId === user.orgId
    ) {
      return;
    }
    throw new ForbiddenException('Access denied');
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

  async getStats(user: any) {
    const userId = user.id;
    const orgId = String(user?.orgId || '').trim() || null;

    // CACHE — keyed by role+org too: this account may hold multiple
    // personas (e.g. Learner + self-serve Creator), and stats differ per
    // active persona, not just per user id.
    const cacheKey = `teacher:stats:${userId}:${user.role}:${orgId || 'none'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const totalExams = await this.prisma.exam.count({
      where: { creatorId: userId, isActive: true },
    });

    // Scope students count based on role
    const studentWhere: any = { role: 'STUDENT' };
    if (user.role === 'ADMIN') {
      studentWhere.OR = [
        { orgId: user.orgId },
        { courses: { some: { orgId: user.orgId } } },
      ];
    } else {
      // For teachers, count students enrolled in their courses
      studentWhere.courses = { some: { creatorId: user.id } };
    }

    const totalStudents = await this.prisma.user.count({ where: studentWhere });

    const recentSubmissionsCount = await this.prisma.examSession.count({
      where: {
        exam: { creatorId: userId },
        status: 'COMPLETED',
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    let certificatesIssued = 0;
    if (user.role === 'ADMIN') {
      if (orgId) {
        certificatesIssued = await this.prisma.certificate.count({
          where: { orgId },
        });
      } else {
        certificatesIssued = 0;
      }
    } else {
      const [teacherCourses, teacherExams] = await Promise.all([
        this.prisma.course.findMany({
          where: { creatorId: userId },
          select: { id: true },
        }),
        this.prisma.exam.findMany({
          where: { creatorId: userId },
          select: { id: true },
        }),
      ]);

      const courseIds = teacherCourses.map((course: { id: string }) => course.id);
      const examIds = teacherExams.map((exam: { id: string }) => exam.id);

      if (orgId && (courseIds.length > 0 || examIds.length > 0)) {
        certificatesIssued = await this.prisma.certificate.count({
          where: {
            orgId,
            OR: [
              ...(courseIds.length
                ? [{ type: this.certificateTypeFilter('course'), resourceId: { in: courseIds } }]
                : []),
              ...(examIds.length
                ? [{ type: this.certificateTypeFilter('exam'), resourceId: { in: examIds } }]
                : []),
            ],
          },
        });
      } else {
        certificatesIssued = 0;
      }
    }

    const stats = {
      totalExams,
      totalStudents,
      recentSubmissions: recentSubmissionsCount,
      certificatesIssued,
    };

    // Cache for 60s
    await this.redis.set(cacheKey, JSON.stringify(stats), 'EX', 60);

    return stats;
  }

  async getExam(idOrSlug: string, user: any) {
    const exam = await this.prisma.exam.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });

    if (exam) {
      await this.checkAccess(exam, user);
    }

    return exam;
  }

  async getCourse(idOrSlug: string, user: any) {
    const course = await this.prisma.course.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        modules: {
          include: { units: true },
          orderBy: { order: 'asc' },
        },
        tests: true,
        linkedExam: {
          select: {
            id: true,
            title: true,
            slug: true,
            duration: true,
            totalMarks: true,
            passingPercentage: true,
            maxAttempts: true,
            attemptBufferMins: true,
            questions: true,
          },
        },
      },
    });

    if (course) {
      await this.checkAccess(course, user);
    }

    return course;
  }

  async getRecentSubmissions(user: any) {
    // CACHE — keyed by role+org too, same reasoning as getStats.
    const cacheKey = `teacher:recent_submissions:${user.id}:${user.role}:${user.orgId || 'none'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const whereClause: any = {
      status: 'COMPLETED',
    };

    if (user.role === 'ADMIN') {
      whereClause.exam = { orgId: user.orgId };
    } else {
      whereClause.exam = { creatorId: user.id };
    }

    const submissions = await this.prisma.examSession.findMany({
      where: whereClause,
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        updatedAt: true,
        status: true,
        user: {
          select: {
            name: true,
          },
        },
        exam: {
          select: {
            title: true,
          },
        },
      },
    });

    // Mapping to simpler view if needed, but let's assume UI handles it.
    // Actually the original code might have continued... let's check reading.

    // Map to frontend expected format
    const mappedSubmissions = submissions.map((sub: any) => ({
      id: sub.id,
      name: sub.user?.name || 'Unknown Student',
      module: sub.exam?.title || 'Unknown Exam',
      time: sub.updatedAt,
      status: sub.status === 'COMPLETED' ? 'Submitted' : 'Pending',
    }));

    // Cache for 30s
    await this.redis.set(cacheKey, JSON.stringify(mappedSubmissions), 'EX', 30);

    return mappedSubmissions;
  }

  private certificateTypeFilter(type: 'course' | 'exam') {
    return { in: [type, type.toUpperCase()] };
  }

  async getRecentActivity(user: any) {
    const cacheKey = `teacher:recent_activity:${user.id}:${user.role}:${user.orgId || 'none'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        await this.redis.del(cacheKey);
      }
    }
    const orgId = String(user?.orgId || '').trim() || null;

    const examSessionWhere: any = { status: 'COMPLETED' };
    if (user.role === 'ADMIN') {
      examSessionWhere.exam = { orgId: user.orgId };
    } else {
      examSessionWhere.exam = { creatorId: user.id };
    }

    const recentSessions = await this.prisma.examSession.findMany({
      where: examSessionWhere,
      take: 8,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
        exam: { select: { title: true } },
      },
    });

    let certificateWhere: any = { id: '__none__' };
    if (user.role === 'ADMIN') {
      if (orgId) {
        certificateWhere = { orgId };
      }
    } else {
      const [teacherCourses, teacherExams] = await Promise.all([
        this.prisma.course.findMany({
          where: { creatorId: user.id },
          select: { id: true },
        }),
        this.prisma.exam.findMany({
          where: { creatorId: user.id },
          select: { id: true },
        }),
      ]);

      const courseIds = teacherCourses.map((course: { id: string }) => course.id);
      const examIds = teacherExams.map((exam: { id: string }) => exam.id);

      if (orgId && (courseIds.length > 0 || examIds.length > 0)) {
        certificateWhere = {
          orgId,
          OR: [
            ...(courseIds.length
              ? [{ type: this.certificateTypeFilter('course'), resourceId: { in: courseIds } }]
              : []),
            ...(examIds.length
              ? [{ type: this.certificateTypeFilter('exam'), resourceId: { in: examIds } }]
              : []),
          ],
        };
      }
    }

    let recentCertificates: any[] = [];
    try {
      recentCertificates = await this.prisma.certificate.findMany({
        where: certificateWhere,
        take: 6,
        orderBy: { issuedAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        },
      });
    } catch (error) {
      console.error('[TeacherService] Failed to load recent certificates', {
        userId: user?.id,
        role: user?.role,
        orgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const activity = [
      ...recentSessions.map((session: any) => ({
        id: `exam-${session.id}`,
        type: 'exam_submission',
        title: `${session.user?.name || session.user?.email || 'Student'} submitted ${session.exam?.title || 'an exam'}`,
        user: session.user?.name || session.user?.email || 'Student',
        module: session.exam?.title || 'Exam',
        status: 'Submitted',
        time: session.updatedAt,
      })),
      ...recentCertificates.map((certificate: any) => ({
        id: `certificate-${certificate.id}`,
        type: 'certificate_issued',
        title: `${certificate.user?.name || certificate.user?.email || 'Learner'} earned ${certificate.title}`,
        user: certificate.user?.name || certificate.user?.email || 'Learner',
        module: certificate.title,
        status: 'Issued',
        time: certificate.issuedAt,
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);

    await this.redis.set(cacheKey, JSON.stringify(activity), 'EX', 30);

    return activity;
  }

  async getMyModules(user: any) {
    const whereClause: any = {};
    if (user.role === 'ADMIN') {
      whereClause.OR = [
        { orgId: user.orgId },
        { creatorId: user.id, orgId: null },
      ];
    } else {
      whereClause.creatorId = user.id;
    }

    const courses = await this.prisma.course.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { students: true },
        },
        students: {
          select: { id: true },
        },
        modules: {
          select: {
            units: {
              select: { id: true },
            },
          },
        },
        progress: {
          select: {
            userId: true,
            percent: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const allUnitIds = courses.flatMap((course: any) =>
      (course.modules || []).flatMap((module: any) =>
        (module.units || []).map((unit: any) => unit.id),
      ),
    );

    const uniqueUnitIds = [...new Set(allUnitIds)];

    const completedSubmissions =
      uniqueUnitIds.length > 0
        ? await this.prisma.unitSubmission.findMany({
            where: {
              status: 'COMPLETED',
              unitId: { in: uniqueUnitIds },
            },
            select: {
              unitId: true,
              userId: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : [];

    const completedByCourseAndUser = new Map<string, Set<string>>();
    const durationByCourse = new Map<
      string,
      { totalMinutes: number; count: number }
    >();

    const unitToCourse = new Map<string, string>();
    for (const course of courses as any[]) {
      for (const module of course.modules || []) {
        for (const unit of module.units || []) {
          unitToCourse.set(unit.id, course.id);
        }
      }
    }

    for (const sub of completedSubmissions as any[]) {
      const courseId = unitToCourse.get(sub.unitId);
      if (!courseId) continue;

      const completionKey = `${courseId}:${sub.userId}`;
      if (!completedByCourseAndUser.has(completionKey)) {
        completedByCourseAndUser.set(completionKey, new Set<string>());
      }
      completedByCourseAndUser.get(completionKey)!.add(sub.unitId);

      const diffMs =
        new Date(sub.updatedAt).getTime() - new Date(sub.createdAt).getTime();
      const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
      const current = durationByCourse.get(courseId) || {
        totalMinutes: 0,
        count: 0,
      };
      current.totalMinutes += diffMinutes;
      current.count += 1;
      durationByCourse.set(courseId, current);
    }

    return courses.map((c: any) => ({
      ...(() => {
        const unitIds = (c.modules || []).flatMap((m: any) =>
          (m.units || []).map((u: any) => u.id),
        );
        const totalUnits = unitIds.length;

        let completionPercent = 0;

        if (c._count.students > 0 && totalUnits > 0) {
          const progressByUser = new Map<string, number>();
          for (const p of c.progress || []) {
            progressByUser.set(p.userId, p.percent || 0);
          }

          const hasProgressForEnrolled = c.students.some((s: any) =>
            progressByUser.has(s.id),
          );

          if (hasProgressForEnrolled) {
            const totalPercent = c.students.reduce(
              (acc: number, s: any) => acc + (progressByUser.get(s.id) || 0),
              0,
            );
            completionPercent = Math.round(totalPercent / c._count.students);
          } else {
            let totalPercent = 0;
            for (const student of c.students || []) {
              const key = `${c.id}:${student.id}`;
              const completedCount =
                completedByCourseAndUser.get(key)?.size || 0;
              totalPercent += (completedCount / totalUnits) * 100;
            }
            completionPercent = Math.round(totalPercent / c._count.students);
          }
        }

        const duration = durationByCourse.get(c.id);
        const avgTimeMinutes =
          duration && duration.count > 0
            ? Math.round(duration.totalMinutes / duration.count)
            : 0;

        return {
          completion: completionPercent,
          avgTimeMinutes,
          avgTimeLabel: this.formatMinutes(avgTimeMinutes),
        };
      })(),
      id: c.id,
      title: c.title,
      slug: c.slug,
      linkedExamId: c.linkedExamId || null,
      certificateTemplateId: c.certificateTemplateId || null,
      students: c._count.students,
      status: this.normalizeCourseStatus(c.status, c.isVisible),
      lastUpdated: c.updatedAt.toLocaleDateString(),
      shortDescription: c.shortDescription || '',
      longDescription: c.longDescription || '',
      courseSummary: c.courseSummary || '',
    }));
  }

  private formatMinutes(totalMinutes: number): string {
    if (!totalMinutes || totalMinutes <= 0) return '0m';

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  async getStudents(
    user: any,
    options?: { limit?: string | number; offset?: string | number },
  ) {
    const limit = this.parseBoundedNumber(options?.limit, 50, 1, 100);
    const offset = this.parseBoundedNumber(options?.offset, 0, 0, 5000);
    const cacheKey = `teacher:students:${user.id}:${user.role}:${user.orgId || 'none'}:limit:${limit}:offset:${offset}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const whereClause: Prisma.UserWhereInput = { role: 'STUDENT' };
    const courseFilter: Prisma.CourseWhereInput = {};

    if (user.role === 'ADMIN') {
      whereClause.OR = [
        { orgId: user.orgId },
        { courses: { some: { orgId: user.orgId } } },
      ];
      courseFilter.OR = [{ orgId: user.orgId }, { creatorId: user.id, orgId: null }];
    } else if (user.role === 'TEACHER') {
      whereClause.courses = {
        some: {
          OR: [
            { creatorId: user.id },
            { assignments: { some: { teacherId: user.id } } },
          ],
        },
      };
      courseFilter.OR = [
        { creatorId: user.id },
        { assignments: { some: { teacherId: user.id } } },
      ];
    } else {
      whereClause.courses = { some: { creatorId: user.id } };
      courseFilter.creatorId = user.id;
    }

    const students = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        createdAt: true,
        updatedAt: true,
        courses: {
          where: courseFilter,
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const allStudentIds = students.map((s: any) => s.id);
    const uniqueCourseIds = [
      ...new Set(
        students.flatMap((s: any) => (s.courses || []).map((c: any) => c.id)),
      ),
    ];

    const courses =
      uniqueCourseIds.length > 0
        ? await this.prisma.course.findMany({
            where: { id: { in: uniqueCourseIds } },
            select: {
              id: true,
              title: true,
              modules: { select: { units: { select: { id: true } } } },
              tests: {
                select: { id: true, title: true, slug: true, questions: true },
              },
            },
          })
        : [];

    const courseById = new Map(courses.map((c: any) => [c.id, c]));
    const allUnitIds = [
      ...new Set(
        courses.flatMap((course: any) =>
          (course.modules || []).flatMap((mod: any) =>
            (mod.units || []).map((u: any) => u.id),
          ),
        ),
      ),
    ];

    const completedSubmissions =
      allStudentIds.length > 0 && allUnitIds.length > 0
        ? await this.prisma.unitSubmission.findMany({
            where: {
              userId: { in: allStudentIds },
              status: 'COMPLETED',
              unitId: { in: allUnitIds },
            },
            select: { userId: true, unitId: true },
            distinct: ['userId', 'unitId'],
          })
        : [];

    const completedByUser = new Map<string, Set<string>>();
    for (const row of completedSubmissions as any[]) {
      if (!completedByUser.has(row.userId)) {
        completedByUser.set(row.userId, new Set<string>());
      }
      completedByUser.get(row.userId)!.add(row.unitId);
    }

    // Collect all question IDs across all tests for a batch QuestionAttempt query
    const extractQuestionIds = (questions: any): string[] => {
      if (!questions) return [];
      let data = questions;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return [];
        }
      }
      if (Array.isArray(data)) {
        if (data.length > 0 && data[0].questions) {
          // sections format
          return data.flatMap((s: any) =>
            (s.questions || []).map((q: any) => String(q.id)),
          );
        }
        return data.map((q: any) => String(q.id));
      }
      if (data?.sections) {
        return data.sections.flatMap((s: any) =>
          (s.questions || []).map((q: any) => String(q.id)),
        );
      }
      return [];
    };

    const questionIds = [
      ...new Set(
        courses.flatMap((course: any) =>
          (course.tests || []).flatMap((test: any) =>
            extractQuestionIds(test.questions),
          ),
        ),
      ),
    ];

    const questionAttempts =
      allStudentIds.length > 0 && questionIds.length > 0
        ? await this.prisma.questionAttempt.findMany({
            where: {
              userId: { in: allStudentIds },
              type: 'UNIT',
              itemId: { in: questionIds },
            },
            select: {
              userId: true,
              itemId: true,
              isCorrect: true,
              score: true,
              createdAt: true,
            },
          })
        : [];

    // Build a lookup: userId -> Map<itemId, { isCorrect, score, createdAt }>
    const attemptsByUserAndItem: Map<
      string,
      Map<string, { isCorrect: boolean; score: number | null; createdAt: Date }>
    > = new Map();
    for (const a of questionAttempts as any[]) {
      if (!attemptsByUserAndItem.has(a.userId)) {
        attemptsByUserAndItem.set(a.userId, new Map());
      }

      const userMap = attemptsByUserAndItem.get(a.userId)!;
      const existing = userMap.get(a.itemId);
      const existingScore = existing?.score ?? 0;
      const nextScore = a.score ?? 0;

      if (
        !existing ||
        nextScore > existingScore ||
        (nextScore === existingScore &&
          new Date(a.createdAt) > new Date(existing.createdAt))
      ) {
        userMap.set(a.itemId, {
          isCorrect: a.isCorrect,
          score: a.score,
          createdAt: a.createdAt,
        });
      }
    }

    const response = students.map((s: any) => {
      const completedUnitIds = completedByUser.get(s.id) || new Set<string>();
      const userAttemptMap = attemptsByUserAndItem.get(s.id);

      const detailedCourses = s.courses.map((courseRef: any) => {
        const course = courseById.get(courseRef.id);
        if (!course) {
          return {
            id: courseRef.id,
            title: courseRef.title,
            progress: 0,
            totalUnits: 0,
            completedUnits: 0,
            tests: [],
          };
        }

        const allCourseUnitIds = course.modules.flatMap((m: any) =>
          m.units.map((u: any) => u.id),
        );
        const totalUnits = allCourseUnitIds.length;

        let completedCount = 0;
        for (const uid of allCourseUnitIds) {
          if (completedUnitIds.has(uid)) completedCount++;
        }
        const progress =
          totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;

        // Compute per-test scores
        const tests = (course.tests || []).map((test: any) => {
          const questionIds = extractQuestionIds(test.questions);
          const totalQuestions = questionIds.length;
          let answeredCount = 0;
          let correctCount = 0;

          for (const qid of questionIds) {
            const attempt = userAttemptMap?.get(qid);
            if (attempt) {
              answeredCount++;
              if (attempt.isCorrect) correctCount++;
            }
          }

          const score =
            totalQuestions > 0
              ? Math.round((correctCount / totalQuestions) * 100)
              : null;
          return {
            id: test.id,
            slug: test.slug,
            title: test.title,
            totalQuestions,
            answeredQuestions: answeredCount,
            correctAnswers: correctCount,
            score,
            attempted: answeredCount > 0,
          };
        });

        return {
          id: course.id,
          title: course.title,
          progress,
          totalUnits,
          completedUnits: completedCount,
          tests,
        };
      });

      const overallProgress =
        detailedCourses.length > 0
          ? Math.round(
              detailedCourses.reduce(
                (acc: number, curr: any) => acc + curr.progress,
                0,
              ) / detailedCourses.length,
            )
          : 0;

      return {
        id: s.id,
        name: s.name || s.email,
        course: s.courses.length > 0 ? s.courses[0].title : 'Not Enrolled',
        courses: detailedCourses,
        progress: overallProgress,
        submissions: completedUnitIds.size,
        lastActive: s.updatedAt.toLocaleDateString(),
      };
    });

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 45);
    return response;
  }

  async getStudentAnalytics(studentId: string, user: any) {
    // Access must be re-verified on every call, not just cache misses —
    // caching the authorization decision would let a caller who has since
    // lost access to this student (org/persona switch, unassigned course)
    // keep seeing cached data for the TTL window.
    const cacheKey = `teacher:student_analytics:${user.id}:${user.role}:${user.orgId || 'none'}:${studentId}`;

    // Verify teacher has access to this student
    if (user.role === 'ADMIN') {
      const student = await this.prisma.user.findFirst({
        where: {
          id: studentId,
          OR: [{ orgId: user.orgId }, { courses: { some: { orgId: user.orgId } } }],
        },
      });
      if (!student)
        throw new Error('Access denied: Student not in your organization');
    } else {
      const enrollment = await this.prisma.course.findFirst({
        where: {
          OR: [
            { creatorId: user.id },
            { assignments: { some: { teacherId: user.id } } },
          ],
          students: { some: { id: studentId } },
        },
      });
      if (!enrollment)
        throw new Error('Access denied: Student not enrolled in your courses');
    }

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const submissionScope: any = { userId: studentId };
    if (user.role === 'ADMIN') {
      submissionScope.unit = { module: { course: { orgId: user.orgId } } };
    } else {
      submissionScope.unit = {
        module: {
          course: {
            OR: [
              { creatorId: user.id },
              { assignments: { some: { teacherId: user.id } } },
            ],
          },
        },
      };
    }

    // Only createdAt/status/unitId and the course title are read below, so
    // select exactly those instead of include-ing full unit/module/course rows
    // (and the submission's own large `content` JSON). The deep include pulled
    // every column of three joined tables per submission for a single title.
    const submissions = await this.prisma.unitSubmission.findMany({
      where: submissionScope,
      select: {
        createdAt: true,
        status: true,
        unitId: true,
        unit: {
          select: {
            module: {
              select: {
                course: { select: { title: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Weekly activity via DB query optimization
    const weeklyActivity = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentSubmissions = submissions.filter((s: any) => {
      return new Date(s.createdAt) >= sevenDaysAgo;
    });

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const daySubmissions = recentSubmissions.filter((s: any) => {
        const subDate = new Date(s.createdAt);
        return subDate >= date && subDate < nextDate;
      });

      const passed = daySubmissions.filter(
        (s: any) => s.status === 'COMPLETED',
      ).length;
      const failed = daySubmissions.length - passed;

      weeklyActivity.push({
        day: days[date.getDay()],
        attempts: daySubmissions.length,
        passed,
        failed,
      });
    }

    // Course mastery
    const courseStats: Record<string, { total: number; completed: number }> =
      {};
    const attemptedUnitIds = new Set<string>();
    const completedUnitIds = new Set<string>();
    submissions.forEach((sub: any) => {
      const courseName = sub.unit.module.course.title;
      if (!courseStats[courseName]) {
        courseStats[courseName] = { total: 0, completed: 0 };
      }
      attemptedUnitIds.add(sub.unitId);
      courseStats[courseName].total++;
      if (sub.status === 'COMPLETED') {
        completedUnitIds.add(sub.unitId);
        courseStats[courseName].completed++;
      }
    });

    const courseMastery = Object.entries(courseStats).map(
      ([subject, stats]) => ({
        subject: subject.substring(0, 15),
        A: Math.round((stats.completed / stats.total) * 150),
        B: 130,
        fullMark: 150,
      }),
    );

    const streak = await this.calculateStudentStreak(studentId);

    const response = {
      weeklyActivity,
      courseMastery,
      stats: {
        totalQuestions: attemptedUnitIds.size,
        totalAttempts: submissions.length,
        passedAttempts: submissions.filter((s: any) => s.status === 'COMPLETED')
          .length,
        successRate:
          submissions.length > 0
            ? Math.round(
                (submissions.filter((s: any) => s.status === 'COMPLETED')
                  .length /
                  submissions.length) *
                  100,
              )
            : 0,
        streak,
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
    return response;
  }

  private async calculateStudentStreak(userId: string) {
    const { data, error } = await (this.supabase.client as any).rpc(
      'get_student_activity_dates',
      {
        p_user_id: userId,
        p_limit: 365,
      },
    );

    if (error) {
      throw new Error(error.message || 'Failed to fetch activity dates');
    }

    const activities = (data || []) as Array<{ day_string: string | Date }>;

    if (activities.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActivityDate = new Date(activities[0].day_string);
    lastActivityDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff > 1) return 0;

    const activityDates = new Set(
      activities.map((a: any) => {
        const d = new Date(a.day_string);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }),
    );

    const currentDate = new Date(today);
    if (daysDiff === 1) {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    while (activityDates.has(currentDate.getTime())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  }

  async getStudentAttempts(
    studentId: string,
    user: any,
    options?: { limit?: string | number; offset?: string | number },
  ) {
    const limit = this.parseBoundedNumber(options?.limit, 100, 1, 200);
    const offset = this.parseBoundedNumber(options?.offset, 0, 0, 5000);
    // Access must be re-verified on every call, not just cache misses —
    // caching the authorization decision would let a caller who has since
    // lost access to this student keep seeing cached data for the TTL.
    const cacheKey = `teacher:student_attempts:${user.id}:${user.role}:${user.orgId || 'none'}:${studentId}:limit:${limit}:offset:${offset}`;

    // Verify teacher/admin has access to this student
    const teacherId = user.id;
    const orgId = user.orgId;

    if (user.role === 'ADMIN') {
      const student = await this.prisma.user.findFirst({
        where: {
          id: studentId,
          OR: [{ orgId }, { courses: { some: { orgId } } }],
        },
      });
      if (!student)
        throw new ForbiddenException(
          'Access denied: Student not in your organization',
        );
    } else if (user.role !== 'SUPER_ADMIN') {
      const enrollment = await this.prisma.course.findFirst({
        where: {
          OR: [
            { creatorId: teacherId },
            { assignments: { some: { teacherId } } },
          ],
          students: { some: { id: studentId } },
        },
      });
      if (!enrollment)
        throw new ForbiddenException(
          'Access denied: Student not enrolled in your courses',
        );
    }

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const whereClause: any = { userId: studentId };
    if (user.role === 'ADMIN') {
      whereClause.exam = { orgId };
    } else if (user.role !== 'SUPER_ADMIN') {
      whereClause.exam = { creatorId: teacherId };
    }

    const sessions = await this.prisma.examSession.findMany({
      where: whereClause,
      include: {
        exam: {
          select: {
            title: true,
            slug: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const response = sessions.map((session: any) => ({
      id: session.id,
      examTitle: session.exam.title,
      examSlug: session.exam.slug,
      status: session.status,
      score: session.score,
      duration: session.exam.duration,
      startedAt: session.createdAt,
      submittedAt: session.endTime,
    }));

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 45);
    return response;
  }

  async getStudentUnitSubmissions(
    studentId: string,
    user: any,
    options?: { limit?: string | number; offset?: string | number },
  ) {
    const limit = this.parseBoundedNumber(options?.limit, 100, 1, 200);
    const offset = this.parseBoundedNumber(options?.offset, 0, 0, 5000);
    // Access must be re-verified on every call, not just cache misses —
    // caching the authorization decision would let a caller who has since
    // lost access to this student keep seeing cached data for the TTL.
    const cacheKey = `teacher:student_unit_subs:${user.id}:${user.role}:${user.orgId || 'none'}:${studentId}:limit:${limit}:offset:${offset}`;

    // Verify teacher/admin has access to this student
    const teacherId = user.id;
    const orgId = user.orgId;

    const submissionFilter: any = { userId: studentId };

    if (user.role === 'ADMIN') {
      const student = await this.prisma.user.findFirst({
        where: {
          id: studentId,
          OR: [{ orgId }, { courses: { some: { orgId } } }],
        },
      });
      if (!student)
        throw new ForbiddenException(
          'Access denied: Student not in your organization',
        );
      submissionFilter.unit = { module: { course: { orgId } } };
    } else if (user.role !== 'SUPER_ADMIN') {
      const enrollment = await this.prisma.course.findFirst({
        where: {
          OR: [
            { creatorId: teacherId },
            { assignments: { some: { teacherId } } },
          ],
          students: { some: { id: studentId } },
        },
      });
      if (!enrollment)
        throw new ForbiddenException(
          'Access denied: Student not enrolled in your courses',
        );
      submissionFilter.unit = {
        module: {
          course: {
            OR: [
              { creatorId: teacherId },
              { assignments: { some: { teacherId } } },
            ],
          },
        },
      };
    }

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const submissions = await this.prisma.unitSubmission.findMany({
      where: submissionFilter,
      include: {
        unit: {
          select: {
            title: true,
            type: true,
            module: {
              select: {
                course: {
                  select: { title: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const response = submissions.map((sub: any) => {
      let testCases = '-';
      if (
        sub.content &&
        typeof sub.content === 'object' &&
        !Array.isArray(sub.content)
      ) {
        const contentObj = sub.content;
        if (contentObj.testCases) {
          testCases = contentObj.testCases;
        }
      }

      // Fallback logic
      if (testCases === '-' && sub.score !== null) {
        testCases = sub.score === 100 ? '1 / 1' : '0 / 1';
      }

      return {
        id: sub.id,
        unitId: sub.unitId,
        unitTitle: sub.unit.title,
        unitType: sub.unit.type,
        courseTitle: sub.unit.module.course.title,
        status: sub.status,
        score: sub.score,
        testCases: testCases,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      };
    });

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 45);
    return response;
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
  private async getBlockedEnrollments(
    course: { orgId: string | null },
    studentIds: string[],
  ): Promise<Set<string>> {
    if (!course.orgId || studentIds.length === 0) return new Set();
    const { kind } = await this.membershipService.getOrgKind(course.orgId);
    if (kind !== 'STRICT') return new Set();
    return this.findNonMembers(course.orgId, studentIds);
  }

  async enrollStudent(courseId: string, studentId: string, user: any) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new Error('Course not found');
    await this.checkAccess(course, user);

    const blocked = await this.getBlockedEnrollments(course, [studentId]);
    if (blocked.has(studentId)) {
      throw new ForbiddenException(
        'This organization only allows enrolling its own members. Invite the student to the organization first.',
      );
    }

    const { error: enrollError } = await (this.supabase.client as any)
      .from('_CourseStudents')
      .upsert({ A: courseId, B: studentId }, { onConflict: 'A,B' });

    if (enrollError) {
      throw new BadRequestException(
        enrollError.message || 'Failed to enroll student',
      );
    }

    try {
      if (course.orgId) {
        await this.webhookService.dispatch(course.orgId, 'student.enrolled', {
          courseId,
          studentId,
          enrolledBy: user?.id,
        });
      }
    } catch (error) {
      console.warn(
        '[TeacherService] Failed to dispatch student.enrolled webhook',
        error,
      );
    }

    return course;
  }

  async unenrollStudent(courseId: string, studentId: string, user: any) {
    console.log('Service unenroll:', { courseId, studentId });
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      console.log('Course not found:', courseId);
      throw new NotFoundException('Course not found');
    }
    await this.checkAccess(course, user);

    const { error } = await (this.supabase.client as any)
      .from('_CourseStudents')
      .delete()
      .eq('A', courseId)
      .eq('B', studentId);

    if (error) {
      throw new BadRequestException(
        error.message || 'Failed to unenroll student',
      );
    }

    return { success: true };
  }

  async enrollByEmails(courseId: string, emails: string[], user: any) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new Error('Course not found');
    await this.checkAccess(course, user);

    const normalizedEmails = [
      ...new Set(
        (emails || [])
          .map((email) =>
            String(email || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];

    if (normalizedEmails.length === 0) {
      return {
        summary: {
          totalProcessed: 0,
          enrolled: 0,
          failed: 0,
        },
        details: [],
      };
    }

    const [students, existingCourse] = await Promise.all([
      this.prisma.user.findMany({
        where: { email: { in: normalizedEmails } },
        select: { id: true, email: true, name: true, role: true },
      }),
      this.prisma.course.findUnique({
        where: { id: courseId },
        select: { students: { select: { id: true } } },
      }),
    ]);

    const studentByEmail = new Map(
      students.map((s: any) => [String(s.email).toLowerCase(), s]),
    );
    const enrolledSet = new Set(
      (existingCourse?.students || []).map((s: any) => s.id),
    );
    const blocked = await this.getBlockedEnrollments(
      course,
      students.map((s: any) => s.id),
    );

    const results = [];
    let enrolledCount = 0;
    let failedCount = 0;
    const toConnect: Array<{ id: string }> = [];

    for (const email of normalizedEmails) {
      try {
        const student = studentByEmail.get(email);

        if (!student) {
          results.push({ email, success: false, error: 'User not found' });
          failedCount++;
          continue;
        }

        if (blocked.has(student.id)) {
          results.push({
            email,
            success: false,
            error: 'Not a member of this organization',
          });
          failedCount++;
          continue;
        }

        if (enrolledSet.has(student.id)) {
          results.push({ email, success: false, error: 'Already enrolled' });
          failedCount++;
          continue;
        }

        enrolledSet.add(student.id);
        toConnect.push({ id: student.id });
        results.push({
          email,
          success: true,
          user: { id: student.id, name: student.name },
        });
        enrolledCount++;
      } catch (error: any) {
        results.push({ email, success: false, error: error.message });
        failedCount++;
      }
    }

    if (toConnect.length > 0) {
      await this.prisma.course.update({
        where: { id: courseId },
        data: {
          students: {
            connect: toConnect,
          },
        },
      });

      try {
        if (course.orgId) {
          await Promise.all(
            toConnect.map((student) =>
              this.webhookService.dispatch(
                course.orgId as string,
                'student.enrolled',
                {
                  courseId,
                  studentId: student.id,
                  enrolledBy: user?.id,
                },
              ),
            ),
          );
        }
      } catch (error) {
        console.warn(
          '[TeacherService] Failed to dispatch bulk student.enrolled webhooks',
          error,
        );
      }
    }

    return {
      summary: {
        totalProcessed: normalizedEmails.length,
        enrolled: enrolledCount,
        failed: failedCount,
      },
      details: results,
    };
  }

  async getSubmission(examId: string, identifier: string, user: any) {
    // Try finding session directly by ID first (most reliable)
    let session = null;

    // Only attempt findUnique if identifier looks like a UUID to avoid Postgres errors
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    if (isUUID) {
      session = await this.prisma.examSession.findUnique({
        where: { id: identifier },
        include: {
          user: { select: { name: true, email: true, rollNumber: true } },
          exam: {
            select: {
              title: true,
              questions: true,
              duration: true,
              creatorId: true,
              orgId: true,
            },
          },
        },
      });
    }

    // If not found by session ID, try by student roll/id
    if (!session) {
      const student = await this.prisma.user.findFirst({
        where: {
          OR: [{ id: identifier }, { rollNumber: identifier }],
        },
      });

      if (student) {
        session = await this.prisma.examSession.findFirst({
          where: {
            examId,
            userId: student.id,
          },
          include: {
            user: { select: { name: true, email: true, rollNumber: true } },
            exam: {
              select: {
                title: true,
                questions: true,
                duration: true,
                creatorId: true,
                orgId: true,
              },
            },
          },
        });
      }
    }

    if (!session) throw new Error('Submission not found');

    await this.checkAccess(session.exam, user);

    const transformed = this.examService.transformExam(session.exam);

    return {
      details: {
        sessionId: session.id,
        studentName: session.user.name || session.user.email,
        rollNo: session.user.rollNumber || 'N/A',
        examId: session.examId,
        examTitle: session.exam.title,
        status: session.status,
        score: session.score,
        startTime: session.startTime,
        endTime: session.endTime,
      },
      questions: Object.values(transformed.questions),
      questionsMap: transformed.questions,
      sections: transformed.sections,
      answers: session.answers,
      attempts: (session.answers as any)?._internal_attempts || {},
    };
  }

  async getCourses(user: any) {
    const where: any = {};

    if (typeof user === 'string') {
      where.creatorId = user;
    } else if (user?.role === 'ADMIN') {
      where.OR = [
        { orgId: user.orgId },
        { creatorId: user.id, orgId: null },
      ];
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
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
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
          select: this.legacyExamSelect as any,
        }),
      ]);
    } catch (error) {
      if (!this.isMissingExamAttemptFieldError(error)) {
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
          select: this.legacyExamSelect as any,
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
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
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
    const incomingSections = this.normalizeCourseSections(data);

    if (hasSectionPayload) {
      const incomingTypes = this.collectQuestionTypesFromUnits(
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
        ? this.normalizeCourseStatus(data.status, data.isVisible)
        : this.normalizeCourseStatus(existing.status, existing.isVisible);

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
        .filter((id: string) => this.isUUID(id));
      const modulesToDelete = existingModules.filter(
        (m: any) => !currentModuleIds.includes(m.id),
      );

      for (const mod of modulesToDelete) {
        await this.prisma.courseModule.delete({ where: { id: mod.id } });
      }

      for (let i = 0; i < incomingSections.length; i++) {
        const sec = incomingSections[i];
        const isNewModule = !this.isUUID(sec.id);

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
            .filter((id: string) => this.isUUID(id));
          const unitsToDelete = unitsInDbIds.filter(
            (uid: string) => !currentUnitIds.includes(uid),
          );

          for (const uid of unitsToDelete) {
            await this.prisma.unit.delete({ where: { id: uid } });
          }

          for (let j = 0; j < sec.questions.length; j++) {
            const q = sec.questions[j];
            const hasUUID = this.isUUID(q.id);

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
        .filter((id: string) => this.isUUID(id));
      const testsToDelete = existingTests.filter(
        (t: any) => !currentTestIds.includes(t.id),
      );

      for (const test of testsToDelete) {
        await this.prisma.courseTest.delete({ where: { id: test.id } });
      }

      for (const test of data.tests) {
        const hasUUID = this.isUUID(test.id);
        const testData = {
          title: test.title,
          slug:
            normalizeSlug(String(test.slug || '')) ||
            (await this.createUniqueSlug('courseTest', test.title, existing.orgId || null)),
          questions: test.questions || [],
          startDate: this.parseOptionalDate(test.startDate),
          endDate: this.parseOptionalDate(test.endDate),
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

      for (const student of updatedCourse.students) {
        const completedSubmissions = await this.prisma.unitSubmission.findMany({
          where: {
            userId: student.id,
            unitId: { in: allUnitIds },
            status: 'COMPLETED',
          },
          select: { unitId: true },
        });

        const completedUnitIds = [
          ...new Set(completedSubmissions.map((s: any) => s.unitId)),
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

        // @ts-ignore
        await this.prisma.courseProgress.upsert({
          where: { userId_courseId: { userId: student.id, courseId: id } },
          update: {
            completedUnits: completedUnitIds,
            totalUnits,
            completedCount,
            percent,
            status,
          },
          create: {
            userId: student.id,
            courseId: id,
            completedUnits: completedUnitIds,
            totalUnits,
            completedCount,
            percent,
            status,
          },
        });

        // Invalidate student stats caches
        await this.redis.del(`student:stats:${student.id}`);
        await this.redis.del(`student:analytics:${student.id}`);
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

  private normalizeCourseSections(data: any): any[] {
    if (Array.isArray(data?.sections)) {
      return data.sections;
    }

    if (Array.isArray(data?.modules)) {
      return data.modules.map((module: any) => ({
        id: module.id,
        title: module.title,
        questions: Array.isArray(module.units)
          ? module.units.map((unit: any) => ({
              id: unit.id,
              title: unit.title,
              type: unit.type,
              ...(unit.content || {}),
            }))
          : [],
      }));
    }

    return [];
  }

  private isUUID(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    const regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
  }

  async createCourse(user: any, data: any) {
    const orgId =
      user.role === 'SUPER_ADMIN' && data.orgId ? data.orgId : user.orgId;

    const modules = Array.isArray(data.modules) ? data.modules : [];
    const sections = this.normalizeCourseSections(data);
    const inputTypes = this.collectQuestionTypesFromUnits([
      ...modules.flatMap((module: any) => module?.units || []),
      ...sections.flatMap((section: any) => section?.questions || []),
    ]);
    await this.enforceQuestionTypeAccess(user, inputTypes, orgId);
    if (orgId) {
      await this.quotaService.checkCourseQuota(orgId, 1);
      await this.quotaService.checkModuleQuota(orgId, undefined, modules.length);
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

    const normalizedStatus = this.normalizeCourseStatus(
      data.status,
      data.isVisible,
    );
    const normalizedVisibility =
      normalizedStatus === 'Published'
        ? true
        : normalizedStatus === 'Draft'
          ? false
          : !!data.isVisible;

    const course = await this.createCourseRecordWithRetry({
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
            slug: normalizeSlug(String(t.slug || '')) || generateRandomSlug(t.title, 'test'),
            questions: t.questions || [],
            startDate: this.parseOptionalDate(t.startDate),
            endDate: this.parseOptionalDate(t.endDate),
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

    const questionTypes = this.collectQuestionTypesFromExamContent(
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
          ? normalizeSlug(String(data.slug || '')) || (await this.createUniqueSlug('exam', data.title, orgId))
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
        totalMarks: linkedCourseId ? null : data.totalMarks ? Number(data.totalMarks) : 0,
        testCode: linkedCourseId ? null : data.testCode,
        testCodeType: data.testCodeType,
        rotationInterval: data.rotationInterval
          ? Number(data.rotationInterval)
          : null,
        inviteToken: linkedCourseId ? null : data.inviteToken,
        allowedIPs: linkedCourseId ? null : data.allowedIPs,
        examMode: data.examMode,
        aiProctoring: !!data.aiProctoring,
        tabSwitchLimit: data.tabSwitchLimit
          ? Number(data.tabSwitchLimit)
          : null,
        startTime: linkedCourseId ? null : data.startTime ? new Date(data.startTime) : null,
        endTime: linkedCourseId ? null : data.endTime ? new Date(data.endTime) : null,
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

    const exam = await this.createExamRecordWithRetry(examPayload, data.title, orgId);

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
      this.collectQuestionTypesFromExamContent(data.sections || data.questions || []),
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
      duration: isCourseLinked ? undefined : data.duration ? Number(data.duration) : undefined,
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
      tabSwitchLimit: data.tabSwitchLimit
        ? Number(data.tabSwitchLimit)
        : null,
      startTime: isCourseLinked ? null : data.startTime ? new Date(data.startTime) : null,
      endTime: isCourseLinked ? null : data.endTime ? new Date(data.endTime) : null,
      timeZone: isCourseLinked ? null : data.timeZone ?? undefined,
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
          ? existing.passingPercentage ?? 70
          : undefined,
      maxAttempts: Number.isFinite(Number(data.maxAttempts))
        ? Number(data.maxAttempts)
        : isCourseLinked
          ? existing.maxAttempts ?? 1
          : undefined,
      attemptBufferMins: Number.isFinite(Number(data.attemptBufferMins))
        ? Number(data.attemptBufferMins)
        : isCourseLinked
          ? existing.attemptBufferMins ?? 0
          : undefined,
    };

    let updatedExam: any;

    try {
      updatedExam = await this.prisma.exam.update({
        where: { id },
        data: updateData as any,
        select: this.legacyExamSelect as any,
      });
    } catch (error) {
      if (!this.isMissingExamAttemptFieldError(error)) {
        throw error;
      }

      delete updateData.passingPercentage;
      delete updateData.maxAttempts;
      delete updateData.attemptBufferMins;

      updatedExam = await this.prisma.exam.update({
        where: { id },
        data: updateData as any,
        select: this.legacyExamSelect as any,
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
    const isUuid = this.isUUID(examId);
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
    for (const session of sessions) {
      await this.redis.del(`session:status:${session.id}`);
      await this.redis.del(`session:meta:${session.id}`);
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
    const isUuid = this.isUUID(examId);
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
    for (const session of sessions) {
      await this.redis.del(`session:status:${session.id}`);
      await this.redis.del(`session:meta:${session.id}`);
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
    const boundedLimit = this.parseBoundedNumber(limit, 50, 1, 100);
    const boundedPage = this.parseBoundedNumber(page, 1, 1, 100000);
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

  // ─── GROUPS ────────────────────────────────────────────────────────────────

  async getGroups(user: any) {
    const cacheKey = `teacher:groups:${user.id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await this.prisma.studentGroup.findMany({
      where: { teacherId: user.id },
      include: {
        students: {
          select: { id: true, name: true, email: true, rollNumber: true },
        },
        _count: { select: { students: true, announcements: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
    return response;
  }

  async getGroup(groupId: string, user: any) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
      include: {
        students: {
          select: { id: true, name: true, email: true, rollNumber: true },
        },
        _count: { select: { students: true, announcements: true } },
      },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);
    return group;
  }

  async createGroup(user: any, data: { name: string; emails?: string[] }) {
    if (!data.name || !data.name.trim())
      throw new BadRequestException('Group name is required');

    const group = await this.prisma.studentGroup.create({
      data: {
        name: data.name.trim(),
        teacherId: user.id,
        orgId: user.orgId || null,
      },
    });

    // If emails provided, add students in bulk
    if (data.emails && data.emails.length > 0) {
      const result = await this.addGroupStudents(group.id, data.emails, user);
      return { ...group, enrollResult: result };
    }

    return group;
  }

  async updateGroup(groupId: string, user: any, data: { name: string }) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    return this.prisma.studentGroup.update({
      where: { id: groupId },
      data: { name: data.name.trim() },
    });
  }

  async deleteGroup(groupId: string, user: any) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    return this.prisma.studentGroup.delete({ where: { id: groupId } });
  }

  async addGroupStudents(groupId: string, emails: string[], user: any) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    const normalizedEmails = [
      ...new Set(
        (emails || [])
          .map((email) =>
            String(email || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];

    if (normalizedEmails.length === 0) {
      return {
        summary: { totalProcessed: 0, added: 0, failed: 0 },
        details: [],
      };
    }

    const [students, groupMembers] = await Promise.all([
      this.prisma.user.findMany({
        where: { email: { in: normalizedEmails } },
        select: { id: true, email: true, name: true, role: true },
      }),
      this.prisma.studentGroup.findUnique({
        where: { id: groupId },
        select: { students: { select: { id: true } } },
      }),
    ]);

    const studentByEmail = new Map(
      students.map((s: any) => [String(s.email).toLowerCase(), s]),
    );
    const memberSet = new Set(
      (groupMembers?.students || []).map((s: any) => s.id),
    );

    const results = [];
    let addedCount = 0;
    let failedCount = 0;
    const toConnect: Array<{ id: string }> = [];

    for (const email of normalizedEmails) {
      try {
        const student = studentByEmail.get(email);
        if (!student) {
          results.push({ email, success: false, error: 'User not found' });
          failedCount++;
          continue;
        }
        if (memberSet.has(student.id)) {
          results.push({ email, success: false, error: 'Already in group' });
          failedCount++;
          continue;
        }

        memberSet.add(student.id);
        toConnect.push({ id: student.id });
        results.push({
          email,
          success: true,
          user: { id: student.id, name: student.name },
        });
        addedCount++;
      } catch (error: any) {
        results.push({ email, success: false, error: error.message });
        failedCount++;
      }
    }

    if (toConnect.length > 0) {
      // Use Prisma relation writes so group membership works consistently
      // regardless of Supabase RLS/session behavior.
      await this.prisma.studentGroup.update({
        where: { id: groupId },
        data: {
          students: {
            connect: toConnect,
          },
        },
      });
    }

    return {
      summary: {
        totalProcessed: normalizedEmails.length,
        added: addedCount,
        failed: failedCount,
      },
      details: results,
    };
  }

  async removeGroupStudent(groupId: string, studentId: string, user: any) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    await this.prisma.studentGroup.update({
      where: { id: groupId },
      data: {
        students: {
          disconnect: { id: studentId },
        },
      },
    });

    return { success: true };
  }

  async enrollGroupInCourse(courseId: string, groupId: string, user: any) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('Course not found');
    await this.checkAccess(course, user);

    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
      include: { students: { select: { id: true, email: true, name: true } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    const existingCourse = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { students: { select: { id: true } } },
    });

    const enrolledSet = new Set(
      (existingCourse?.students || []).map((s: any) => s.id),
    );
    const blocked = await this.getBlockedEnrollments(
      course,
      group.students.map((s: any) => s.id),
    );
    const toConnect: Array<{ id: string }> = [];
    let alreadyEnrolled = 0;
    let skippedNonMembers = 0;

    for (const student of group.students) {
      if (blocked.has(student.id)) {
        skippedNonMembers++;
      } else if (enrolledSet.has(student.id)) {
        alreadyEnrolled++;
      } else {
        enrolledSet.add(student.id);
        toConnect.push({ id: student.id });
      }
    }

    if (toConnect.length > 0) {
      const { error } = await (this.supabase.client as any)
        .from('_CourseStudents')
        .upsert(
          toConnect.map((item) => ({ A: courseId, B: item.id })),
          { onConflict: 'A,B' },
        );

      if (error) {
        throw new BadRequestException(
          error.message || 'Failed to enroll group in course',
        );
      }
    }

    return {
      groupName: group.name,
      totalStudents: group.students.length,
      enrolled: toConnect.length,
      alreadyEnrolled,
      skippedNonMembers,
    };
  }

  // ─── ANNOUNCEMENTS ─────────────────────────────────────────────────────────

  async getAnnouncements(user: any) {
    const cacheKey = `teacher:announcements:${user.id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await this.prisma.announcement.findMany({
      where: { teacherId: user.id },
      include: {
        groups: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
    return response;
  }

  async createAnnouncement(
    user: any,
    data: {
      title: string;
      content: string;
      groupIds: string[];
      attachments?: { name: string; url: string; type: string; size: number }[];
    },
  ) {
    if (!data.title?.trim()) throw new BadRequestException('Title is required');
    if (!data.content?.trim())
      throw new BadRequestException('Content is required');
    if (!data.groupIds || data.groupIds.length === 0)
      throw new BadRequestException('At least one group must be selected');

    // Verify all groups belong to this teacher
    const groups = await this.prisma.studentGroup.findMany({
      where: { id: { in: data.groupIds }, teacherId: user.id },
      include: { students: { select: { id: true } } },
    });
    if (groups.length !== data.groupIds.length) {
      throw new ForbiddenException(
        'One or more groups not found or not owned by you',
      );
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        title: data.title.trim(),
        content: data.content,
        attachments: data.attachments || [],
        teacherId: user.id,
        orgId: user.orgId || null,
        groups: { connect: data.groupIds.map((id) => ({ id })) },
      },
      include: {
        groups: { select: { id: true, name: true } },
        teacher: { select: { name: true } },
      },
    });

    // Collect unique student IDs from all target groups
    const studentIdSet = new Set<string>();
    for (const group of groups) {
      for (const student of group.students) {
        studentIdSet.add(student.id);
      }
    }

    // Broadcast via WebSocket
    await this.notificationGateway.broadcastAnnouncement(
      {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        attachments: announcement.attachments,
        teacherName: announcement.teacher.name || 'Teacher',
        groupNames: announcement.groups.map((g) => g.name),
        createdAt: announcement.createdAt,
      },
      Array.from(studentIdSet),
    );

    return announcement;
  }

  async updateAnnouncement(
    announcementId: string,
    user: any,
    data: {
      title: string;
      content: string;
      groupIds: string[];
      attachments?: { name: string; url: string; type: string; size: number }[];
    },
  ) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: { groups: { select: { id: true } } },
    });

    if (!existing) throw new NotFoundException('Announcement not found');
    this.assertAnnouncementAccess(existing, user);

    if (!data.title?.trim()) throw new BadRequestException('Title is required');
    if (!data.content?.trim())
      throw new BadRequestException('Content is required');
    if (!data.groupIds || data.groupIds.length === 0)
      throw new BadRequestException('At least one group must be selected');

    const groupOwnerId = existing.teacherId;
    const groups = await this.prisma.studentGroup.findMany({
      where: { id: { in: data.groupIds }, teacherId: groupOwnerId },
      select: { id: true },
    });

    if (groups.length !== data.groupIds.length) {
      throw new ForbiddenException(
        'One or more groups not found or not owned by the announcement teacher',
      );
    }

    const oldAttachments = Array.isArray(existing.attachments)
      ? (existing.attachments as any[])
      : [];
    const nextAttachments = data.attachments || [];
    const nextAttachmentUrls = new Set(
      nextAttachments.map((att: any) => att?.url).filter(Boolean),
    );

    for (const att of oldAttachments) {
      if (att?.url && !nextAttachmentUrls.has(att.url)) {
        await this.storageService
          .deleteFile(att.url, existing.orgId || undefined)
          .catch(() => undefined);
      }
    }

    return this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        title: data.title.trim(),
        content: data.content,
        attachments: nextAttachments,
        groups: {
          set: data.groupIds.map((id) => ({ id })),
        },
      },
      include: {
        groups: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
    });
  }

  async deleteAnnouncement(announcementId: string, user: any) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: { groups: true },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    this.assertAnnouncementAccess(announcement, user);

    // Delete attachment files from S3
    const attachments = announcement.attachments as any[];
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.url) {
          await this.storageService.deleteFile(
            att.url,
            announcement.orgId || undefined,
          );
        }
      }
    }

    return this.prisma.announcement.delete({ where: { id: announcementId } });
  }
}
