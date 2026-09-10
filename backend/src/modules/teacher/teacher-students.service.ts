import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ExamService } from '../exam/exam.service';
import { WebhookService } from '../webhook/webhook.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TeacherService } from './teacher.service';
import { parseBoundedNumber } from './teacher.util';

/**
 * Student roster, per-student analytics/attempts, and course enrollment,
 * split out of the former monolithic TeacherService -- see
 * teacher-groups.service.ts for the full context on why. checkAccess and
 * getBlockedEnrollments remain on TeacherService (also used by
 * TeacherGroupsService's group-enrollment flow), injected here rather than
 * duplicated.
 */
@Injectable()
export class TeacherStudentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly teacherService: TeacherService,
    private readonly examService: ExamService,
    private readonly webhookService: WebhookService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  async getStudents(
    user: any,
    options?: { limit?: string | number; offset?: string | number },
  ) {
    const limit = parseBoundedNumber(options?.limit, 50, 1, 100);
    const offset = parseBoundedNumber(options?.offset, 0, 0, 5000);
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
      courseFilter.OR = [
        { orgId: user.orgId },
        { creatorId: user.id, orgId: null },
      ];
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
          OR: [
            { orgId: user.orgId },
            { courses: { some: { orgId: user.orgId } } },
          ],
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
    const limit = parseBoundedNumber(options?.limit, 100, 1, 200);
    const offset = parseBoundedNumber(options?.offset, 0, 0, 5000);
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
    const limit = parseBoundedNumber(options?.limit, 100, 1, 200);
    const offset = parseBoundedNumber(options?.offset, 0, 0, 5000);
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

  async enrollStudent(courseId: string, studentId: string, user: any) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new Error('Course not found');
    await this.teacherService.checkAccess(course, user);

    const blocked = await this.teacherService.getBlockedEnrollments(course, [
      studentId,
    ]);
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
    await this.teacherService.checkAccess(course, user);

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
    await this.teacherService.checkAccess(course, user);

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
    const blocked = await this.teacherService.getBlockedEnrollments(
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

    await this.teacherService.checkAccess(session.exam, user);

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
}
