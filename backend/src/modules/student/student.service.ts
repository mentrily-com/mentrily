import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ExamService } from '../exam/exam.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CertificateService } from '../certificate/certificate.service';

@Injectable()
export class StudentService {
  constructor(
    private readonly supabase: SupabaseService,
    private examService: ExamService,
    private certificateService: CertificateService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('student-analytics') private studentAnalyticsQueue: Queue,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private isMissingOnboardingColumnError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as any).code === 'P2022' &&
      String((error as any)?.meta?.column || '').includes(
        'User.hasCompletedOnboarding',
      )
    );
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

  private isMissingExamSessionAttemptNumberError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as any).code === 'P2022' &&
      String((error as any)?.meta?.column || '').includes(
        'ExamSession.attemptNumber',
      )
    );
  }

  private readonly finalExamSessionStatuses = ['COMPLETED', 'TERMINATED'] as const;

  private async findUserCompat<T>(
    args: {
      where: Record<string, unknown>;
      select?: T;
      include?: T;
    },
  ): Promise<any> {
    try {
      return await this.prisma.user.findUnique(args as any);
    } catch (error) {
      if (
        !this.isMissingOnboardingColumnError(error) &&
        !this.isMissingExamAttemptFieldError(error)
      ) {
        throw error;
      }

      const fallbackArgs = { ...args } as any;
      if (fallbackArgs.select && typeof fallbackArgs.select === 'object') {
        delete fallbackArgs.select.hasCompletedOnboarding;
      }
      if (fallbackArgs.include && typeof fallbackArgs.include === 'object') {
        delete fallbackArgs.include.hasCompletedOnboarding;
        fallbackArgs.select = {
          ...(fallbackArgs.select || {}),
          ...fallbackArgs.include,
        };
        delete fallbackArgs.include;
      }
      const linkedExamSelect =
        fallbackArgs.select?.courses?.include?.linkedExam?.select ||
        fallbackArgs.select?.courses?.select?.linkedExam?.select;
      if (linkedExamSelect && typeof linkedExamSelect === 'object') {
        delete linkedExamSelect.passingPercentage;
        delete linkedExamSelect.maxAttempts;
        delete linkedExamSelect.attemptBufferMins;
      }

      return await this.prisma.user.findUnique(fallbackArgs);
    }
  }

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

  private async computeCourseCompletionSummary(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        modules: {
          select: {
            units: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const unitIds = course.modules.flatMap((module) =>
      module.units.map((unit) => unit.id),
    );

    const completedRows =
      unitIds.length > 0
        ? await this.prisma.unitSubmission.findMany({
            where: {
              userId,
              unitId: { in: unitIds },
              status: 'COMPLETED',
            },
            select: { unitId: true },
            distinct: ['unitId'],
          })
        : [];

    const totalUnits = unitIds.length;
    const completedCount = completedRows.length;
    const percent =
      totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;

    return { totalUnits, completedCount, percent };
  }

  private async buildLinkedExamAttemptSummary(
    userId: string,
    course: {
      examPassThreshold?: number | null;
      examUnlockThreshold?: number | null;
      linkedExam?: {
        id: string;
        slug: string;
        title: string;
        duration?: number | null;
        totalMarks?: number | null;
        isActive?: boolean | null;
        passingPercentage?: number | null;
        maxAttempts?: number | null;
        attemptBufferMins?: number | null;
      } | null;
    },
    progressPercent: number,
  ) {
    if (!course.linkedExam) {
      return null;
    }

    let latestAttempt: any;
    try {
      latestAttempt = await this.prisma.examSession.findFirst({
        where: {
          userId,
          examId: course.linkedExam.id,
          status: { in: this.finalExamSessionStatuses as any },
        },
        orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
        select: {
          status: true,
          score: true,
          attemptNumber: true,
          endTime: true,
        },
      });
    } catch (error) {
      if (!this.isMissingExamSessionAttemptNumberError(error)) {
        throw error;
      }

      latestAttempt = await this.prisma.examSession.findFirst({
        where: {
          userId,
          examId: course.linkedExam.id,
          status: { in: this.finalExamSessionStatuses as any },
        },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          status: true,
          score: true,
          endTime: true,
        },
      });
    }

    const attemptsUsed = await this.prisma.examSession.count({
      where: {
        userId,
        examId: course.linkedExam.id,
        status: { in: this.finalExamSessionStatuses as any },
      },
    });

    const passingPercentage = Number(
      course.linkedExam.passingPercentage ?? course.examPassThreshold ?? 70,
    );
    const maxAttempts = Number(course.linkedExam.maxAttempts ?? 1);
    const attemptBufferMins = Number(course.linkedExam.attemptBufferMins ?? 0);
    const nextAttemptAvailableAt =
      latestAttempt?.endTime && attemptBufferMins > 0
        ? new Date(
            new Date(latestAttempt.endTime).getTime() + attemptBufferMins * 60 * 1000,
          ).toISOString()
        : null;

    const hasFinishedAttempt = Boolean(latestAttempt);
    const passed =
      hasFinishedAttempt && typeof latestAttempt?.score === 'number'
        ? Number(latestAttempt.score) >= passingPercentage
        : hasFinishedAttempt
          ? false
          : null;
    const attemptsRemaining = passed === true
      ? 0
      : Math.max(0, maxAttempts - attemptsUsed);

    return {
      id: course.linkedExam.id,
      slug: course.linkedExam.slug,
      title: course.linkedExam.title,
      duration: course.linkedExam.duration,
      totalMarks: course.linkedExam.totalMarks,
      isActive: !!course.linkedExam.isActive,
      isUnlocked: progressPercent >= Number(course.examUnlockThreshold ?? 100),
      requiredPercent: Number(course.examUnlockThreshold ?? 100),
      passingPercentage,
      maxAttempts,
      attemptBufferMins,
      lastAttempt: latestAttempt
        ? {
            status: latestAttempt.status,
            score: latestAttempt.score,
            attemptNumber: Number(latestAttempt.attemptNumber || attemptsUsed || 1),
            endedAt: latestAttempt.endTime,
          }
        : null,
      passed,
      attemptsUsed,
      attemptsRemaining,
      nextAttemptAvailableAt,
    };
  }

  async getStats(userId: string) {
    // PERFORMANCE: Check cache first
    const cacheKey = `student:stats:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await this.findUserCompat({
      where: { id: userId },
      select: {
        // @ts-ignore
        dailyStreak: true,
        // @ts-ignore
        totalXP: true,
        unitSubmissions: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
      },
    });

    if (!user) throw new Error('User not found');

    // PERFORMANCE ⚡ Bolt: Replace fetching all rows with database-level aggregation
    // Calculate average score - only from published results using database aggregation
    const scoreAgg = await this.prisma.examSession.aggregate({
      where: {
        userId,
        score: { not: null },
        exam: { resultsPublished: true },
      },
      _avg: { score: true },
    });

    const averageScore = scoreAgg._avg.score !== null ? Math.round(scoreAgg._avg.score) : 0;

    const stats = {
      completedModules: (user as any).unitSubmissions.length,
      averageScore,
      streak: (user as any).dailyStreak,
      totalXP: (user as any).totalXP,
    };

    // Cache for 60 seconds (short lived)
    await this.redis.set(cacheKey, JSON.stringify(stats), 'EX', 60);

    return stats;
  }

  private async calculateDailyStreak(userId: string): Promise<number> {
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

    // Check if there's activity today or yesterday
    // Note: Raw query dates might be strings or Date objects depending on driver.
    // Prisma usually returns Date objects for 'date' type if mapped correctly, but let's be safe.
    const lastActivityDate = new Date(activities[0].day_string);
    lastActivityDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Streak is broken if last activity was more than 1 day ago
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
      // Start from yesterday if no activity today
      currentDate.setDate(currentDate.getDate() - 1);
    }

    while (activityDates.has(currentDate.getTime())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  }

  async getModules(user: any) {
    // Fetch published exams scoped to user's organization
    const exams = await this.prisma.exam.findMany({
      where: {
        isActive: true,
        orgId: user.orgId || undefined,
      } as any, // Bypass stale type definition
      include: {
        submissions: {
          where: { userId: user.id },
          select: { status: true, score: true },
        },
      },
    });

    return exams.map((exam: any) => {
      const session = exam.submissions[0]; // Gets the user's session if exists
      let percent = 0;
      if (session?.status === 'COMPLETED') percent = 100;
      else if (session?.status === 'IN_PROGRESS') percent = 30; // Arbitrary progress for now

      return {
        title: exam.title,
        slug: exam.slug,
        sections: Array.isArray(exam.questions)
          ? (exam.questions as any[]).length
          : 0,
        percent,
        status: session?.status || 'NOT_STARTED',
      };
    });
  }

  async getCourses(userId: string) {
    // Short-TTL cache: this loads the full enrolled-course tree, a bulk
    // completed-submissions query, and a per-course linked-exam summary on
    // every learner dashboard visit. Invalidated on submitUnit (progress
    // changes), same 60s window as student:stats.
    const cacheKey = `student:courses:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get courses the student is enrolled in
    const user = await this.findUserCompat({
      where: { id: userId },
      include: {
        courses: {
          include: {
            modules: {
              include: {
                units: { select: { id: true } },
              },
            },
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
            tests: {
              select: {
                id: true,
                title: true,
                slug: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
    });

    if (!user) return [];

    // Collect every unit ID across all enrolled courses in one pass
    const allUnitIds = (user as any).courses.flatMap((course: any) =>
      course.modules.flatMap((mod: any) => mod.units.map((u: any) => u.id)),
    );

    // Single query: all completed submissions for this student across all enrolled units
    const completedSubs =
      allUnitIds.length > 0
        ? await this.prisma.unitSubmission.findMany({
            where: { userId, unitId: { in: allUnitIds }, status: 'COMPLETED' },
            select: { unitId: true },
          })
        : [];

    const completedSet = new Set(completedSubs.map((s: any) => s.unitId));

    const courses = await Promise.all((user as any).courses.map(async (course: any) => {
      const totalUnits = course.modules.reduce(
        (sum: number, mod: any) => sum + mod.units.length,
        0,
      );
      const courseUnitIds = course.modules.flatMap((mod: any) =>
        mod.units.map((u: any) => u.id),
      );
      const completedCount = courseUnitIds.filter((uid: string) =>
        completedSet.has(uid),
      ).length;
      const percent =
        totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;
      const status =
        completedCount === totalUnits && totalUnits > 0
          ? 'Completed'
          : completedCount > 0
            ? 'In Progress'
            : 'Not Started';

      const linkedExam = await this.buildLinkedExamAttemptSummary(
        userId,
        course,
        percent,
      );

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.shortDescription,
        sections: course.modules.length,
        totalUnits,
        testCount: course.tests?.length || 0,
        tests: course.tests || [],
        status,
        percent,
        linkedExam,
      };
    }));

    await this.redis.set(cacheKey, JSON.stringify(courses), 'EX', 60);
    return courses;
  }

  async browseCourses(user: any) {
    // Catalog of self-enrollable courses: everything published/visible in the
    // learner's own org plus platform-wide org-less courses. Only card-level
    // metadata leaves the server — never unit content or exam payloads.
    const orgId = user.orgId || null;
    const courses = await this.prisma.course.findMany({
      where: {
        isVisible: true,
        OR: orgId ? [{ orgId }, { orgId: null }] : [{ orgId: null }],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        difficulty: true,
        tags: true,
        thumbnail: true,
        modules: { select: { units: { select: { id: true } } } },
        students: { where: { id: user.id }, select: { id: true } },
        linkedExamId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return courses.map((course: any) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      shortDescription: course.shortDescription,
      difficulty: course.difficulty,
      tags: course.tags || [],
      thumbnail: course.thumbnail,
      sections: course.modules.length,
      totalUnits: course.modules.reduce(
        (sum: number, mod: any) => sum + mod.units.length,
        0,
      ),
      hasFinalExam: !!course.linkedExamId,
      enrolled: course.students.length > 0,
    }));
  }

  async enrollInCourse(user: any, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        isVisible: true,
        orgId: true,
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    // Self-enroll is only open for browsable courses: visible AND either
    // org-less (platform-wide) or belonging to the learner's own org.
    const orgId = user.orgId || null;
    const enrollable =
      course.isVisible && (course.orgId === null || course.orgId === orgId);
    if (!enrollable) {
      throw new ForbiddenException('This course is not open for enrollment');
    }

    await this.prisma.course.update({
      where: { id: courseId },
      data: { students: { connect: { id: user.id } } },
    });

    // Bust the learner dashboard caches so the course shows up immediately
    await this.redis.del(`student:courses:${user.id}`);
    await this.redis.del(`student:stats:${user.id}`);

    return { enrolled: true, courseId: course.id, slug: course.slug };
  }

  async getCourseExamStatus(userId: string, courseSlug: string) {
    const buildQuery = () => ({
      where: {
        slug: courseSlug,
        students: {
          some: { id: userId },
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        examUnlockThreshold: true,
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
      },
    }) as any;

    const courseQuery = buildQuery();
    let course: any;

    try {
      course = await this.prisma.course.findFirst(courseQuery);
    } catch (error) {
      if (!this.isMissingExamAttemptFieldError(error)) {
        throw error;
      }

      const fallbackQuery = buildQuery();
      delete fallbackQuery.select.linkedExam.select.passingPercentage;
      delete fallbackQuery.select.linkedExam.select.maxAttempts;
      delete fallbackQuery.select.linkedExam.select.attemptBufferMins;
      course = await this.prisma.course.findFirst(fallbackQuery);
    }

    if (!course) {
      throw new Error('Course not found');
    }

    const completion = await this.computeCourseCompletionSummary(
      course.id,
      userId,
    );
    const currentPercent = completion.percent;
    const requiredPercent = Number(course.examUnlockThreshold ?? 100);

    return {
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
      },
      progressPercent: currentPercent,
      linkedExam: await this.buildLinkedExamAttemptSummary(userId, course, currentPercent),
    };
  }

  async getUpcomingExams(user: any) {
    const orgId = String(user?.orgId || '').trim();
    if (!orgId) return [];

    const now = new Date();
    const exams = await this.prisma.exam.findMany({
      where: {
        orgId,
        isActive: true,
        startTime: { gt: now },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        startTime: true,
        endTime: true,
        duration: true,
      },
      orderBy: { startTime: 'asc' },
      take: 20,
    });

    return exams.map((exam) => {
      const diffMs = Math.max(
        0,
        new Date(exam.startTime as Date).getTime() - now.getTime(),
      );
      const totalMinutes = Math.floor(diffMs / 60000);
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutes = totalMinutes % 60;

      return {
        ...exam,
        countdown: {
          ms: diffMs,
          days,
          hours,
          minutes,
        },
      };
    });
  }

  async getExamResult(userId: string, sessionId: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId, userId },
      include: {
        exam: true,
        user: { select: { name: true, email: true, rollNumber: true } },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (!(session.exam as any).resultsPublished) {
      throw new Error('Results not published yet');
    }

    const transformed = this.examService.transformExam(session.exam, false);
    let coursePassThreshold: number | null = null;
    if ((session.exam as any).linkedCourseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: (session.exam as any).linkedCourseId },
        select: { examPassThreshold: true },
      });
      coursePassThreshold = course?.examPassThreshold ?? null;
    }
    const passingPercentage = Number(
      (session.exam as any).passingPercentage ?? coursePassThreshold ?? 70,
    );

    return {
      details: {
        sessionId: session.id,
        studentName: session.user.name || session.user.email,
        rollNo: session.user.rollNumber || 'N/A',
        examId: session.examId,
        examTitle: session.exam.title,
        status: session.status,
        score: session.score,
        totalMarks: session.exam.totalMarks,
        startTime: session.startTime,
        endTime: session.endTime,
        passingPercentage,
        passed:
          typeof session.score === 'number'
            ? Number(session.score) >= passingPercentage
            : false,
      },
      questions: Object.values(transformed.questions),
      questionsMap: transformed.questions,
      sections: transformed.sections,
      answers: session.answers,
      attempts: (session.answers as any)?._internal_attempts || {},
    };
  }

  async getExamAttempts(
    userId: string,
    options?: { limit?: string | number; offset?: string | number },
  ) {
    const limit = this.parseBoundedNumber(options?.limit, 50, 1, 100);
    const offset = this.parseBoundedNumber(options?.offset, 0, 0, 10000);
    const cacheKey = `student:attempts:${userId}:limit:${limit}:offset:${offset}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const sessions = await this.prisma.examSession.findMany({
      where: {
        userId,
        exam: { resultsPublished: true },
      },
      select: {
        id: true,
        score: true,
        status: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        exam: {
          select: {
            title: true,
            resultsPublished: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const response = sessions.map((session: any) => {
      const isPublished = session.exam.resultsPublished;
      const startTime = new Date(session.startTime).getTime();
      const endTime = session.endTime
        ? new Date(session.endTime).getTime()
        : Date.now();
      const durationMins = Math.round((endTime - startTime) / 60000);

      return {
        id: session.id,
        examTitle: session.exam.title,
        score: isPublished
          ? session.score !== null
            ? session.score
            : 'Pending'
          : 'Hidden',
        duration: durationMins,
        startedAt: session.startTime,
        submittedAt: session.endTime,
        status: session.status,
        isPublished,
      };
    });

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
    return response;
  }

  async getDetailedUnitSubmissions(userId: string) {
    const submissions = await this.prisma.unitSubmission.findMany({
      where: { userId },
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
    });

    return submissions.map((sub: any) => {
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
  }

  async getAnalytics(userId: string) {
    const cacheKey = `student:analytics:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const weeklyActivity = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalAttempts,
      passedAttempts,
      attemptedUnitRows,
      completedUnitRows,
      recentSubmissions,
      streak,
    ] = await Promise.all([
      this.prisma.unitSubmission.count({ where: { userId } }),
      this.prisma.unitSubmission.count({
        where: { userId, status: 'COMPLETED' },
      }),
      this.prisma.unitSubmission.findMany({
        where: { userId },
        select: { unitId: true },
        distinct: ['unitId'],
      }),
      this.prisma.unitSubmission.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { unitId: true },
        distinct: ['unitId'],
      }),
      this.prisma.unitSubmission.findMany({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo },
        },
        select: { createdAt: true, status: true },
      }),
      this.calculateDailyStreak(userId),
    ]);

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

    const attemptedUnitIds = attemptedUnitRows.map((r: any) => r.unitId);
    const completedUnitSet = new Set(
      completedUnitRows.map((r: any) => r.unitId),
    );

    const attemptedUnits =
      attemptedUnitIds.length > 0
        ? await this.prisma.unit.findMany({
            where: { id: { in: attemptedUnitIds } },
            select: {
              id: true,
              module: {
                select: {
                  course: {
                    select: { title: true },
                  },
                },
              },
            },
          })
        : [];

    const courseStats: Record<
      string,
      { units: Set<string>; completedUnits: Set<string> }
    > = {};
    for (const unit of attemptedUnits as any[]) {
      const courseName = unit.module?.course?.title || 'Unknown';
      if (!courseStats[courseName]) {
        courseStats[courseName] = {
          units: new Set(),
          completedUnits: new Set(),
        };
      }
      courseStats[courseName].units.add(unit.id);
      if (completedUnitSet.has(unit.id)) {
        courseStats[courseName].completedUnits.add(unit.id);
      }
    }

    const courseMastery = Object.entries(courseStats).map(
      ([subject, stats]) => ({
        subject: subject.substring(0, 15), // Truncate for display
        A: Math.round((stats.completedUnits.size / stats.units.size) * 150), // Current proficiency based on completion
        B: 130, // Benchmark
        fullMark: 150,
      }),
    );

    const result = {
      weeklyActivity,
      courseMastery,
      stats: {
        totalQuestions: attemptedUnitIds.length,
        totalAttempts,
        passedAttempts,
        successRate:
          totalAttempts > 0
            ? Math.round((passedAttempts / totalAttempts) * 100)
            : 0,
        streak,
      },
    };

    // Cache result for 5 minutes
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

    return result;
  }

  async getProfile(userId: string) {
    const user = await this.findUserCompat({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: { name?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
      },
    });
  }

  async getBookmarks(userId: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      include: {
        unit: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookmarks.map((b: any) => ({
      id: b.id,
      unitId: b.customId, // Use customId for frontend links
      unitTitle: b.unit?.title || b.title || 'Untitled',
      unitType: b.unit?.type || b.type || 'Reading',
      moduleTitle: b.unit?.module?.title || b.moduleTitle || 'Miscellaneous',
      courseTitle: b.unit?.module?.course?.title || b.courseTitle || 'System',
      bookmarkedAt: b.createdAt,
    }));
  }

  async addBookmark(
    userId: string,
    unitId: string,
    metadata?: {
      title?: string;
      type?: string;
      moduleTitle?: string;
      courseTitle?: string;
    },
  ) {
    // Find if this unitId exists in the Unit table for the FK
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });

    const { data, error } = await (this.supabase.client as any)
      .from('Bookmark')
      .upsert(
        {
          userId,
          customId: unitId,
          unitId: unit ? unit.id : null,
          title: metadata?.title || null,
          type: metadata?.type || null,
          moduleTitle: metadata?.moduleTitle || null,
          courseTitle: metadata?.courseTitle || null,
        },
        { onConflict: 'userId,customId' },
      )
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to save bookmark');
    }

    return data;
  }

  async removeBookmark(userId: string, bookmarkId: string) {
    console.log('[StudentService] removeBookmark called');
    console.log('[StudentService] userId:', userId);
    console.log('[StudentService] bookmarkId:', bookmarkId);

    try {
      // First, check if this is a bookmark ID or customId
      // Try to find bookmark by ID first
      const bookmark = await this.prisma.bookmark.findUnique({
        where: { id: bookmarkId },
      });

      console.log(
        '[StudentService] Bookmark found by ID:',
        bookmark ? 'Yes' : 'No',
      );

      if (bookmark) {
        console.log('[StudentService] Bookmark data:', bookmark);
        // Verify ownership
        if (bookmark.userId !== userId) {
          console.log('[StudentService] ❌ Ownership mismatch');
          throw new Error('Unauthorized: Bookmark does not belong to user');
        }
        // Delete by ID
        console.log('[StudentService] Deleting bookmark by ID...');
        const result = await this.prisma.bookmark.delete({
          where: { id: bookmarkId },
        });
        console.log('[StudentService] ✅ Bookmark deleted successfully');
        return result;
      } else {
        // Try as customId (backward compatibility)
        console.log('[StudentService] Trying to delete by customId...');
        const result = await this.prisma.bookmark.delete({
          where: {
            userId_customId: { userId, customId: bookmarkId },
          },
        });
        console.log('[StudentService] ✅ Bookmark deleted by customId');
        return result;
      }
    } catch (error) {
      console.error('[StudentService] ❌ Error removing bookmark:', error);
      console.error('[StudentService] Error message:', error.message);
      console.error('[StudentService] Error code:', error.code);
      throw error;
    }
  }

  async getUnitSubmissions(userId: string, unitId: string) {
    // Check if this is a real Unit or a virtual test question
    const unitExists = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (unitExists) {
      return this.prisma.unitSubmission.findMany({
        where: { userId, unitId },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Virtual test question: return from QuestionAttempt instead
    const attempts = await this.prisma.questionAttempt.findMany({
      where: { userId, itemId: unitId, type: 'UNIT' },
      orderBy: { createdAt: 'desc' },
    });
    // Shape to match UnitSubmission structure that frontend expects
    return attempts.map((a: any) => ({
      id: a.id,
      userId: a.userId,
      unitId,
      status: a.isCorrect ? 'COMPLETED' : 'IN_PROGRESS',
      content: a.content,
      score: a.score,
      createdAt: a.createdAt,
      updatedAt: a.createdAt,
    }));
  }

  /**
   * MCQ/MultiSelect correctness must never come from the client — submitUnit
   * used to persist whatever `status`/`score` the frontend sent verbatim
   * (the frontend code even said as much: "In a real app, the backend would
   * evaluate this... mock evaluation logic for demo purposes"), so a request
   * built by hand (or a frontend bug, like MultiSelect previously letting a
   * student select every option) could claim COMPLETED/100 regardless of
   * what was actually selected. Recomputes from the unit's own stored
   * mcqOptions using the same exact-match rule as exams: the selected set
   * must equal the correct set exactly, no more, no fewer.
   */
  private recomputeMcqCorrectness(
    unitType: string,
    unitContent: any,
    submittedContent: any,
  ): { status: string; score: number } | null {
    if (unitType !== 'MCQ' && unitType !== 'MultiSelect') return null;

    const parsedContent =
      typeof unitContent === 'string' ? JSON.parse(unitContent) : unitContent;
    const options = parsedContent?.mcqOptions || parsedContent?.options || [];
    const correctIds = options
      .filter((o: any) => o?.isCorrect)
      .map((o: any) => String(o.id))
      .sort();
    const selectedIds = (
      Array.isArray(submittedContent)
        ? submittedContent
        : submittedContent != null
          ? [submittedContent]
          : []
    )
      .map((v: any) => String(v))
      .sort();

    const isCorrect =
      correctIds.length > 0 &&
      correctIds.length === selectedIds.length &&
      correctIds.every((id: string, i: number) => id === selectedIds[i]);

    return { status: isCorrect ? 'COMPLETED' : 'IN_PROGRESS', score: isCorrect ? 100 : 0 };
  }

  async submitUnit(
    userId: string,
    unitId: string,
    data: { status: string; content: any; score?: number },
  ) {
    // Check if this unitId maps to a real Unit record (FK constraint)
    const unitExists = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, type: true, content: true },
    });

    if (unitExists) {
      const authoritative = this.recomputeMcqCorrectness(
        unitExists.type,
        unitExists.content,
        data.content,
      );
      if (authoritative) {
        data = { ...data, status: authoritative.status, score: authoritative.score };
      }
    }

    let submission: any;

    if (unitExists) {
      const latestSubmission = await this.prisma.unitSubmission.findFirst({
        where: { userId, unitId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      const startedAt = latestSubmission?.createdAt || new Date();
      const computedTimeTakenSec =
        data.status === 'COMPLETED'
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
            )
          : null;

      // Normal unit — store in UnitSubmission
      submission = await this.prisma.unitSubmission.create({
        data: {
          userId,
          unitId,
          status: data.status,
          content: data.content,
          score: data.score,
          startedAt,
          timeTakenSec: computedTimeTakenSec,
        } as any,
      });

      // Trigger course-progress analytics only for real units
      await this.studentAnalyticsQueue.add('update-course-progress', {
        userId,
        unitId,
      });
    } else {
      // Virtual test question — store in QuestionAttempt (no FK to Unit)
      const attempt = await this.prisma.questionAttempt.create({
        data: {
          userId,
          itemId: unitId,
          type: 'UNIT',
          content: data.content,
          isCorrect: data.status === 'COMPLETED',
          score: data.score,
        },
      });
      // Shape to UnitSubmission-compatible response
      submission = {
        id: attempt.id,
        userId: attempt.userId,
        unitId,
        status: attempt.isCorrect ? 'COMPLETED' : 'IN_PROGRESS',
        content: attempt.content,
        score: attempt.score,
        createdAt: attempt.createdAt,
        updatedAt: attempt.createdAt,
      };
    }

    // Trigger analytics updates (common to both paths)
    await this.studentAnalyticsQueue.add('update-streak', { userId });
    await this.studentAnalyticsQueue.add('save-question-attempt', {
      userId,
      itemId: unitId,
      type: 'UNIT',
      content: data.content,
      isCorrect: data.status === 'COMPLETED',
      score: data.score,
    });

    // Invalidate cache
    await this.redis.del(`student:stats:${userId}`);
    await this.redis.del(`student:analytics:${userId}`);
    await this.redis.del(`student:courses:${userId}`);

    return submission;
  }

  async getCourseProgress(userId: string, courseSlug: string) {
    // 1. Find the course and its modules/units
    const course = await this.prisma.course.findFirst({
      where: {
        slug: courseSlug,
        students: {
          some: { id: userId },
        },
      },
      include: {
        modules: {
          include: {
            units: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // 2. Extract all unit IDs
    const unitIds = course.modules.flatMap((m) => m.units.map((u) => u.id));

    // 3. Find ALL submissions for these units (not just completed)
    const submissions = await this.prisma.unitSubmission.findMany({
      where: {
        userId,
        unitId: { in: unitIds },
      },
      select: {
        id: true,
        unitId: true,
        status: true,
        score: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Group submissions by unitId
    const attemptsMap: Record<string, any[]> = {};
    const completedUnitIds = new Set<string>();

    submissions.forEach((sub) => {
      if (!attemptsMap[sub.unitId]) {
        attemptsMap[sub.unitId] = [];
      }

      let testCases = '-';
      if (
        sub.content &&
        typeof sub.content === 'object' &&
        !Array.isArray(sub.content)
      ) {
        const contentObj = sub.content as any;
        if (contentObj.testCases) {
          testCases = contentObj.testCases;
        }
      }

      // Fallback logic similar to AttemptsView
      if (testCases === '-' && sub.score !== null) {
        testCases = sub.score === 100 ? '1 / 1' : '0 / 1';
      }

      attemptsMap[sub.unitId].push({
        id: sub.id,
        date:
          sub.createdAt.toLocaleDateString() +
          ' ' +
          sub.createdAt.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        score: sub.score !== null ? `${sub.score}%` : '-',
        testCases: testCases,
        status: sub.status === 'COMPLETED' ? 'success' : 'failed',
      });

      if (sub.status === 'COMPLETED') {
        completedUnitIds.add(sub.unitId);
      }
    });

    return {
      totalUnits: unitIds.length,
      completedUnitIds: Array.from(completedUnitIds),
      attempts: attemptsMap,
    };
  }

  async getCertificates(userId: string) {
    return this.certificateService.listCertificates(userId);
  }

  async downloadCertificate(userId: string, certificateId: string) {
    const certificate = await this.certificateService.getCertificateForUser(
      userId,
      certificateId,
    );
    return {
      id: certificate.id,
      fileUrl: certificate.fileUrl,
      type: certificate.type,
      title: certificate.title,
      issuedAt: certificate.issuedAt,
    };
  }

  // ─── ANNOUNCEMENTS ─────────────────────────────────────────────────────────

  async getAnnouncements(
    userId: string,
    options?: { limit?: string | number; offset?: string | number },
  ) {
    const limit = this.parseBoundedNumber(options?.limit, 50, 1, 100);
    const offset = this.parseBoundedNumber(options?.offset, 0, 0, 10000);
    const versionKey = `student:announcements:ver:${userId}`;
    const cacheVersion = (await this.redis.get(versionKey)) || '1';
    const cacheKey = `student:announcements:${userId}:v:${cacheVersion}:limit:${limit}:offset:${offset}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const announcements = await this.prisma.announcement.findMany({
      where: {
        groups: {
          some: {
            students: {
              some: { id: userId },
            },
          },
        },
      },
      include: {
        teacher: { select: { name: true, profilePicture: true } },
        groups: { select: { id: true, name: true } },
        reads: {
          where: { userId },
          select: { id: true, readAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const response = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      attachments: a.attachments,
      teacherName: a.teacher.name || 'Teacher',
      teacherPicture: a.teacher.profilePicture,
      groupNames: a.groups.map((g) => g.name),
      isRead: a.reads.length > 0,
      readAt: a.reads[0]?.readAt || null,
      createdAt: a.createdAt,
    }));

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
    return response;
  }

  async getUnreadAnnouncementCount(userId: string) {
    const cacheKey = `student:announcements:unread:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const count = await this.prisma.announcement.count({
      where: {
        groups: {
          some: {
            students: {
              some: { id: userId },
            },
          },
        },
        reads: {
          none: { userId },
        },
      },
    });

    const response = { count };
    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
    return response;
  }

  async markAnnouncementRead(userId: string, announcementId: string) {
    const result = await this.prisma.announcementRead.upsert({
      where: {
        userId_announcementId: { userId, announcementId },
      },
      create: { userId, announcementId },
      update: {},
    });

    await this.redis.del(`student:announcements:unread:${userId}`);
    await this.redis.incr(`student:announcements:ver:${userId}`);

    return result;
  }
}
