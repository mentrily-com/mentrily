import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TeacherService } from './teacher.service';
import {
  certificateTypeFilter,
  formatMinutes,
  normalizeCourseStatus,
} from './teacher.util';

/**
 * Teacher-facing dashboard stats and single-resource lookups (getStats,
 * getExam, getCourse, getRecentSubmissions, getRecentActivity, getMyModules),
 * split out of the former monolithic TeacherService -- see
 * teacher-groups.service.ts for the full context on why. checkAccess remains
 * on TeacherService (shared across every split service), injected here
 * rather than duplicated.
 */
@Injectable()
export class TeacherStatsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly teacherService: TeacherService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
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

      const courseIds = teacherCourses.map(
        (course: { id: string }) => course.id,
      );
      const examIds = teacherExams.map((exam: { id: string }) => exam.id);

      if (orgId && (courseIds.length > 0 || examIds.length > 0)) {
        certificatesIssued = await this.prisma.certificate.count({
          where: {
            orgId,
            OR: [
              ...(courseIds.length
                ? [
                    {
                      type: certificateTypeFilter('course'),
                      resourceId: { in: courseIds },
                    },
                  ]
                : []),
              ...(examIds.length
                ? [
                    {
                      type: certificateTypeFilter('exam'),
                      resourceId: { in: examIds },
                    },
                  ]
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
      await this.teacherService.checkAccess(exam, user);
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
      await this.teacherService.checkAccess(course, user);
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

      const courseIds = teacherCourses.map(
        (course: { id: string }) => course.id,
      );
      const examIds = teacherExams.map((exam: { id: string }) => exam.id);

      if (orgId && (courseIds.length > 0 || examIds.length > 0)) {
        certificateWhere = {
          orgId,
          OR: [
            ...(courseIds.length
              ? [
                  {
                    type: certificateTypeFilter('course'),
                    resourceId: { in: courseIds },
                  },
                ]
              : []),
            ...(examIds.length
              ? [
                  {
                    type: certificateTypeFilter('exam'),
                    resourceId: { in: examIds },
                  },
                ]
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
          avgTimeLabel: formatMinutes(avgTimeMinutes),
        };
      })(),
      id: c.id,
      title: c.title,
      slug: c.slug,
      linkedExamId: c.linkedExamId || null,
      certificateTemplateId: c.certificateTemplateId || null,
      students: c._count.students,
      status: normalizeCourseStatus(c.status, c.isVisible),
      lastUpdated: c.updatedAt.toLocaleDateString(),
      shortDescription: c.shortDescription || '',
      longDescription: c.longDescription || '',
      courseSummary: c.courseSummary || '',
    }));
  }
}
