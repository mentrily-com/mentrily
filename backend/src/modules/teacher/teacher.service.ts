import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { MonitoringGateway } from '../monitoring/monitoring.gateway';
import { NotificationGateway } from '../notification/notification.gateway';
import { StorageService } from '../../services/storage/storage.service';
import { ExamService } from '../exam/exam.service';
import { CourseService } from '../course/course.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class TeacherService {
    constructor(
        private prisma: PrismaService,
        private monitoringGateway: MonitoringGateway,
        private notificationGateway: NotificationGateway,
        private storageService: StorageService,
        private examService: ExamService,
        private courseService: CourseService,
        @InjectRedis() private readonly redis: Redis
    ) { }

    private parseBoundedNumber(value: string | number | undefined, fallback: number, min: number, max: number): number {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.min(max, Math.max(min, Math.floor(numeric)));
    }

    private checkAccess(resource: any, user: any) {
        if (!resource) return;
        if (resource.creatorId === user.id) return true;
        if (user.role === 'ADMIN' && resource.orgId === user.orgId) return true;
        if (user.role === 'SUPER_ADMIN') return true;
        throw new ForbiddenException('Access denied: You do not own this resource');
    }

    async getStats(user: any) {
        const userId = user.id;

        // CACHE
        const cacheKey = `teacher:stats:${userId}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const totalExams = await this.prisma.exam.count({ where: { creatorId: userId, isActive: true } });

        // Scope students count based on role
        const studentWhere: any = { role: 'STUDENT' };
        if (user.role === 'ADMIN') {
            studentWhere.orgId = user.orgId;
        } else {
            // For teachers, count students enrolled in their courses
            studentWhere.courses = { some: { creatorId: user.id } };
        }

        const totalStudents = await this.prisma.user.count({ where: studentWhere });

        const recentSubmissionsCount = await this.prisma.examSession.count({
            where: {
                exam: { creatorId: userId },
                status: 'COMPLETED',
                updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
        });

        const stats = {
            totalExams,
            totalStudents,
            recentSubmissions: recentSubmissionsCount
        };

        // Cache for 60s
        await this.redis.set(cacheKey, JSON.stringify(stats), 'EX', 60);

        return stats;
    }

    async getExam(idOrSlug: string, user: any) {
        const exam = await this.prisma.exam.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            }
        });

        if (exam) {
            this.checkAccess(exam, user);
        }

        return exam;
    }

    async getCourse(idOrSlug: string, user: any) {
        const course = await this.prisma.course.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            },
            include: {
                modules: {
                    include: { units: true },
                    orderBy: { order: 'asc' }
                },
                tests: true
            }
        });

        if (course) {
            this.checkAccess(course, user);
        }

        return course;
    }

    async getRecentSubmissions(user: any) {
        // CACHE
        const cacheKey = `teacher:recent_submissions:${user.id}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const whereClause: any = {
            status: 'COMPLETED'
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
            include: {
                user: true,
                exam: true
            } // Removed generic mapping here to keep it simple, controller handles or returns raw
        });

        // Mapping to simpler view if needed, but let's assume UI handles it.
        // Actually the original code might have continued... let's check reading.

        // Map to frontend expected format
        const mappedSubmissions = submissions.map((sub: any) => ({
            id: sub.id,
            name: sub.user?.name || 'Unknown Student',
            module: sub.exam?.title || 'Unknown Exam',
            time: sub.updatedAt,
            status: sub.status === 'COMPLETED' ? 'Submitted' : 'Pending'
        }));

        // Cache for 30s
        await this.redis.set(cacheKey, JSON.stringify(mappedSubmissions), 'EX', 30);

        return mappedSubmissions;
    }

    async getMyModules(user: any) {
        const whereClause: any = {};
        if (user.role === 'ADMIN') {
            whereClause.orgId = user.orgId;
        } else {
            whereClause.creatorId = user.id;
        }

        const courses = await this.prisma.course.findMany({
            where: whereClause,
            include: {
                _count: {
                    select: { students: true }
                },
                students: {
                    select: { id: true }
                },
                modules: {
                    select: {
                        units: {
                            select: { id: true }
                        }
                    }
                },
                progress: {
                    select: {
                        userId: true,
                        percent: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        const allUnitIds = courses.flatMap((course: any) =>
            (course.modules || []).flatMap((module: any) => (module.units || []).map((unit: any) => unit.id))
        );

        const uniqueUnitIds = [...new Set(allUnitIds)];

        const completedSubmissions = uniqueUnitIds.length > 0
            ? await this.prisma.unitSubmission.findMany({
                where: {
                    status: 'COMPLETED',
                    unitId: { in: uniqueUnitIds }
                },
                select: {
                    unitId: true,
                    userId: true,
                    createdAt: true,
                    updatedAt: true
                }
            })
            : [];

        const completedByCourseAndUser = new Map<string, Set<string>>();
        const durationByCourse = new Map<string, { totalMinutes: number; count: number }>();

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

            const diffMs = new Date(sub.updatedAt).getTime() - new Date(sub.createdAt).getTime();
            const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
            const current = durationByCourse.get(courseId) || { totalMinutes: 0, count: 0 };
            current.totalMinutes += diffMinutes;
            current.count += 1;
            durationByCourse.set(courseId, current);
        }

        return courses.map((c: any) => ({
            ...(() => {
                const unitIds = (c.modules || []).flatMap((m: any) => (m.units || []).map((u: any) => u.id));
                const totalUnits = unitIds.length;

                let completionPercent = 0;

                if (c._count.students > 0 && totalUnits > 0) {
                    const progressByUser = new Map<string, number>();
                    for (const p of c.progress || []) {
                        progressByUser.set(p.userId, p.percent || 0);
                    }

                    const hasProgressForEnrolled = c.students.some((s: any) => progressByUser.has(s.id));

                    if (hasProgressForEnrolled) {
                        const totalPercent = c.students.reduce((acc: number, s: any) => acc + (progressByUser.get(s.id) || 0), 0);
                        completionPercent = Math.round(totalPercent / c._count.students);
                    } else {
                        let totalPercent = 0;
                        for (const student of c.students || []) {
                            const key = `${c.id}:${student.id}`;
                            const completedCount = completedByCourseAndUser.get(key)?.size || 0;
                            totalPercent += (completedCount / totalUnits) * 100;
                        }
                        completionPercent = Math.round(totalPercent / c._count.students);
                    }
                }

                const duration = durationByCourse.get(c.id);
                const avgTimeMinutes = duration && duration.count > 0
                    ? Math.round(duration.totalMinutes / duration.count)
                    : 0;

                return {
                    completion: completionPercent,
                    avgTimeMinutes,
                    avgTimeLabel: this.formatMinutes(avgTimeMinutes)
                };
            })(),
            id: c.id,
            title: c.title,
            slug: c.slug,
            students: c._count.students,
            status: c.status,
            lastUpdated: c.updatedAt.toLocaleDateString(),
            shortDescription: c.shortDescription || '',
            longDescription: c.longDescription || '',
            courseSummary: c.courseSummary || ''
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

    async getStudents(user: any, options?: { limit?: string | number; offset?: string | number }) {
        const limit = this.parseBoundedNumber(options?.limit, 50, 1, 100);
        const offset = this.parseBoundedNumber(options?.offset, 0, 0, 5000);
        const cacheKey = `teacher:students:${user.id}:${user.role}:${user.orgId || 'none'}:limit:${limit}:offset:${offset}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const whereClause: Prisma.UserWhereInput = { role: 'STUDENT' };
        const courseFilter: Prisma.CourseWhereInput = {};

        if (user.role === 'ADMIN') {
            whereClause.orgId = user.orgId;
            courseFilter.orgId = user.orgId;
        } else {
            whereClause.courses = { some: { creatorId: user.id } };
            courseFilter.creatorId = user.id;
        }

        const students = await this.prisma.user.findMany({
            where: whereClause,
            select: {
                id: true, name: true, email: true, rollNumber: true, createdAt: true, updatedAt: true,
                courses: {
                    where: courseFilter,
                    select: {
                        id: true,
                        title: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
        });

        const allStudentIds = students.map((s: any) => s.id);
        const uniqueCourseIds = [...new Set(
            students.flatMap((s: any) => (s.courses || []).map((c: any) => c.id))
        )];

        const courses = uniqueCourseIds.length > 0
            ? await this.prisma.course.findMany({
                where: { id: { in: uniqueCourseIds } },
                select: {
                    id: true,
                    title: true,
                    modules: { select: { units: { select: { id: true } } } },
                    tests: { select: { id: true, title: true, slug: true, questions: true } }
                }
            })
            : [];

        const courseById = new Map(courses.map((c: any) => [c.id, c]));
        const allUnitIds = [...new Set(
            courses.flatMap((course: any) =>
                (course.modules || []).flatMap((mod: any) => (mod.units || []).map((u: any) => u.id))
            )
        )];

        const completedSubmissions = (allStudentIds.length > 0 && allUnitIds.length > 0)
            ? await this.prisma.unitSubmission.findMany({
                where: {
                    userId: { in: allStudentIds },
                    status: 'COMPLETED',
                    unitId: { in: allUnitIds }
                },
                select: { userId: true, unitId: true },
                distinct: ['userId', 'unitId']
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
                try { data = JSON.parse(data); } catch { return []; }
            }
            if (Array.isArray(data)) {
                if (data.length > 0 && data[0].questions) {
                    // sections format
                    return data.flatMap((s: any) => (s.questions || []).map((q: any) => String(q.id)));
                }
                return data.map((q: any) => String(q.id));
            }
            if (data?.sections) {
                return data.sections.flatMap((s: any) => (s.questions || []).map((q: any) => String(q.id)));
            }
            return [];
        };

        const questionIds = [...new Set(
            courses.flatMap((course: any) =>
                (course.tests || []).flatMap((test: any) => extractQuestionIds(test.questions))
            )
        )];

        const questionAttempts = (allStudentIds.length > 0 && questionIds.length > 0)
            ? await this.prisma.questionAttempt.findMany({
                where: {
                    userId: { in: allStudentIds },
                    type: 'UNIT',
                    itemId: { in: questionIds }
                },
                select: { userId: true, itemId: true, isCorrect: true, score: true, createdAt: true }
            })
            : [];

        // Build a lookup: userId -> Map<itemId, { isCorrect, score, createdAt }>
        const attemptsByUserAndItem: Map<string, Map<string, { isCorrect: boolean; score: number | null; createdAt: Date }>> = new Map();
        for (const a of questionAttempts as any[]) {
            if (!attemptsByUserAndItem.has(a.userId)) {
                attemptsByUserAndItem.set(a.userId, new Map());
            }

            const userMap = attemptsByUserAndItem.get(a.userId)!;
            const existing = userMap.get(a.itemId);
            const existingScore = existing?.score ?? 0;
            const nextScore = a.score ?? 0;

            if (!existing || nextScore > existingScore || (nextScore === existingScore && new Date(a.createdAt) > new Date(existing.createdAt))) {
                userMap.set(a.itemId, { isCorrect: a.isCorrect, score: a.score, createdAt: a.createdAt });
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
                        tests: []
                    };
                }

                const allCourseUnitIds = course.modules.flatMap((m: any) => m.units.map((u: any) => u.id));
                const totalUnits = allCourseUnitIds.length;

                let completedCount = 0;
                for (const uid of allCourseUnitIds) {
                    if (completedUnitIds.has(uid)) completedCount++;
                }
                const progress = totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;

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

                    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : null;
                    return {
                        id: test.id,
                        slug: test.slug,
                        title: test.title,
                        totalQuestions,
                        answeredQuestions: answeredCount,
                        correctAnswers: correctCount,
                        score,
                        attempted: answeredCount > 0
                    };
                });

                return {
                    id: course.id,
                    title: course.title,
                    progress,
                    totalUnits,
                    completedUnits: completedCount,
                    tests
                };
            });

            const overallProgress = detailedCourses.length > 0
                ? Math.round(detailedCourses.reduce((acc: number, curr: any) => acc + curr.progress, 0) / detailedCourses.length)
                : 0;

            return {
                id: s.id,
                name: s.name || s.email,
                course: s.courses.length > 0 ? s.courses[0].title : 'Not Enrolled',
                courses: detailedCourses,
                progress: overallProgress,
                submissions: completedUnitIds.size,
                lastActive: s.updatedAt.toLocaleDateString()
            };
        });

        await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 45);
        return response;
    }

    async getStudentAnalytics(studentId: string, user: any) {
        const cacheKey = `teacher:student_analytics:${user.id}:${studentId}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // Verify teacher has access to this student
        if (user.role === 'ADMIN') {
            const student = await this.prisma.user.findUnique({ where: { id: studentId } });
            if (!student || student.orgId !== user.orgId) throw new Error('Access denied: Student not in your organization');
        } else {
            const enrollment = await this.prisma.course.findFirst({
                where: {
                    creatorId: user.id,
                    students: { some: { id: studentId } }
                }
            });
            if (!enrollment) throw new Error('Access denied: Student not enrolled in your courses');
        }

        const submissionScope: any = { userId: studentId };
        if (user.role === 'ADMIN') {
            submissionScope.unit = { module: { course: { orgId: user.orgId } } };
        } else {
            submissionScope.unit = { module: { course: { creatorId: user.id } } };
        }

        const submissions = await this.prisma.unitSubmission.findMany({
            where: submissionScope,
            include: {
                unit: {
                    include: {
                        module: {
                            include: {
                                course: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
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

            const passed = daySubmissions.filter((s: any) => s.status === 'COMPLETED').length;
            const failed = daySubmissions.length - passed;

            weeklyActivity.push({
                day: days[date.getDay()],
                attempts: daySubmissions.length,
                passed,
                failed
            });
        }

        // Course mastery
        const courseStats: Record<string, { total: number; completed: number }> = {};
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

        const courseMastery = Object.entries(courseStats).map(([subject, stats]) => ({
            subject: subject.substring(0, 15),
            A: Math.round((stats.completed / stats.total) * 150),
            B: 130,
            fullMark: 150
        }));

        const streak = await this.calculateStudentStreak(studentId);

        const response = {
            weeklyActivity,
            courseMastery,
            stats: {
                totalQuestions: attemptedUnitIds.size,
                totalAttempts: submissions.length,
                passedAttempts: submissions.filter((s: any) => s.status === 'COMPLETED').length,
                successRate: submissions.length > 0
                    ? Math.round((submissions.filter((s: any) => s.status === 'COMPLETED').length / submissions.length) * 100)
                    : 0,
                streak
            }
        };

        await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
        return response;
    }

    private async calculateStudentStreak(userId: string) {
        const activities: { dayString: Date }[] = await this.prisma.$queryRaw`
            SELECT DISTINCT DATE("createdAt") as "dayString"
            FROM (
                SELECT "createdAt" FROM "ExamSession" WHERE "userId" = ${userId} AND "status" = 'COMPLETED'
                UNION ALL
                SELECT "createdAt" FROM "UnitSubmission" WHERE "userId" = ${userId}
            ) as activity
            ORDER BY "dayString" DESC
            LIMIT 365
        `;

        if (activities.length === 0) return 0;

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastActivityDate = new Date(activities[0].dayString);
        lastActivityDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > 1) return 0;

        const activityDates = new Set(
            activities.map((a: any) => {
                const d = new Date(a.dayString);
                d.setHours(0, 0, 0, 0);
                return d.getTime();
            })
        );

        let currentDate = new Date(today);
        if (daysDiff === 1) {
            currentDate.setDate(currentDate.getDate() - 1);
        }

        while (activityDates.has(currentDate.getTime())) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }

        return streak;
    }

    async getStudentAttempts(studentId: string, user: any, options?: { limit?: string | number; offset?: string | number }) {
        const limit = this.parseBoundedNumber(options?.limit, 100, 1, 200);
        const offset = this.parseBoundedNumber(options?.offset, 0, 0, 5000);
        const cacheKey = `teacher:student_attempts:${user.id}:${studentId}:limit:${limit}:offset:${offset}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // Verify teacher/admin has access to this student
        const teacherId = user.id;
        const orgId = user.orgId;

        if (user.role === 'ADMIN') {
            const student = await this.prisma.user.findUnique({ where: { id: studentId } });
            if (!student || student.orgId !== orgId) throw new ForbiddenException('Access denied: Student not in your organization');
        } else if (user.role !== 'SUPER_ADMIN') {
            const enrollment = await this.prisma.course.findFirst({
                where: {
                    creatorId: teacherId,
                    students: { some: { id: studentId } }
                }
            });
            if (!enrollment) throw new ForbiddenException('Access denied: Student not enrolled in your courses');
        }

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
                        duration: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
        });

        const response = sessions.map((session: any) => ({
            id: session.id,
            examTitle: session.exam.title,
            examSlug: session.exam.slug,
            status: session.status,
            score: session.score,
            duration: session.exam.duration,
            startedAt: session.createdAt,
            submittedAt: session.endTime
        }));

        await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 45);
        return response;
    }

    async getStudentUnitSubmissions(studentId: string, user: any, options?: { limit?: string | number; offset?: string | number }) {
        const limit = this.parseBoundedNumber(options?.limit, 100, 1, 200);
        const offset = this.parseBoundedNumber(options?.offset, 0, 0, 5000);
        const cacheKey = `teacher:student_unit_subs:${user.id}:${studentId}:limit:${limit}:offset:${offset}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // Verify teacher/admin has access to this student
        const teacherId = user.id;
        const orgId = user.orgId;

        const submissionFilter: any = { userId: studentId };

        if (user.role === 'ADMIN') {
            const student = await this.prisma.user.findUnique({ where: { id: studentId } });
            if (!student || student.orgId !== orgId) throw new ForbiddenException('Access denied: Student not in your organization');
            submissionFilter.unit = { module: { course: { orgId } } };
        } else if (user.role !== 'SUPER_ADMIN') {
            const enrollment = await this.prisma.course.findFirst({
                where: {
                    creatorId: teacherId,
                    students: { some: { id: studentId } }
                }
            });
            if (!enrollment) throw new ForbiddenException('Access denied: Student not enrolled in your courses');
            submissionFilter.unit = { module: { course: { creatorId: teacherId } } };
        }

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
                                    select: { title: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
        });

        const response = submissions.map((sub: any) => {
            let testCases = '-';
            if (sub.content && typeof sub.content === 'object' && !Array.isArray(sub.content)) {
                const contentObj = sub.content as any;
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
                updatedAt: sub.updatedAt
            };
        });

        await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 45);
        return response;
    }

    async enrollStudent(courseId: string, studentId: string, user: any) {
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new Error('Course not found');
        this.checkAccess(course, user);

        return this.prisma.course.update({
            where: { id: courseId },
            data: {
                students: {
                    connect: { id: studentId }
                }
            }
        });
    }

    async unenrollStudent(courseId: string, studentId: string, user: any) {
        console.log('Service unenroll:', { courseId, studentId });
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
            console.log('Course not found:', courseId);
            throw new NotFoundException('Course not found');
        }
        this.checkAccess(course, user);

        return this.prisma.course.update({
            where: { id: courseId },
            data: {
                students: {
                    disconnect: { id: studentId }
                }
            }
        });
    }

    async enrollByEmails(courseId: string, emails: string[], user: any) {
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new Error('Course not found');
        this.checkAccess(course, user);

        const normalizedEmails = [...new Set(
            (emails || []).map((email) => String(email || '').trim().toLowerCase()).filter(Boolean)
        )];

        if (normalizedEmails.length === 0) {
            return {
                summary: {
                    totalProcessed: 0,
                    enrolled: 0,
                    failed: 0
                },
                details: []
            };
        }

        const [students, existingCourse] = await Promise.all([
            this.prisma.user.findMany({
                where: { email: { in: normalizedEmails } },
                select: { id: true, email: true, name: true, role: true }
            }),
            this.prisma.course.findUnique({
                where: { id: courseId },
                select: { students: { select: { id: true } } }
            })
        ]);

        const studentByEmail = new Map(students.map((s: any) => [String(s.email).toLowerCase(), s]));
        const enrolledSet = new Set((existingCourse?.students || []).map((s: any) => s.id));

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

                if (student.role !== 'STUDENT') {
                    results.push({ email, success: false, error: 'User is not a student' });
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
                results.push({ email, success: true, user: { id: student.id, name: student.name } });
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
                        connect: toConnect
                    }
                }
            });
        }

        return {
            summary: {
                totalProcessed: normalizedEmails.length,
                enrolled: enrolledCount,
                failed: failedCount
            },
            details: results
        };
    }

    async getSubmission(examId: string, identifier: string, user: any) {
        // Try finding session directly by ID first (most reliable)
        let session = null;

        // Only attempt findUnique if identifier looks like a UUID to avoid Postgres errors
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

        if (isUUID) {
            session = await this.prisma.examSession.findUnique({
                where: { id: identifier },
                include: {
                    user: { select: { name: true, email: true, rollNumber: true } },
                    exam: { select: { title: true, questions: true, duration: true, creatorId: true, orgId: true } }
                }
            });
        }

        // If not found by session ID, try by student roll/id
        if (!session) {
            const student = await this.prisma.user.findFirst({
                where: {
                    OR: [
                        { id: identifier },
                        { rollNumber: identifier }
                    ]
                }
            });

            if (student) {
                session = await this.prisma.examSession.findFirst({
                    where: {
                        examId,
                        userId: student.id
                    },
                    include: {
                        user: { select: { name: true, email: true, rollNumber: true } },
                        exam: { select: { title: true, questions: true, duration: true, creatorId: true, orgId: true } }
                    }
                });
            }
        }

        if (!session) throw new Error('Submission not found');

        this.checkAccess(session.exam, user);

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
                endTime: session.endTime
            },
            questions: Object.values(transformed.questions),
            questionsMap: transformed.questions,
            sections: transformed.sections,
            answers: session.answers,
            attempts: (session.answers as any)?._internal_attempts || {}
        };
    }

    async getCourses(user: any) {
        const where: any = {};

        if (typeof user === 'string') {
            where.creatorId = user;
        } else if (user?.role === 'ADMIN') {
            where.orgId = user.orgId;
        } else {
            where.creatorId = user?.id;
        }

        return this.prisma.course.findMany({
            where,
            include: {
                _count: { select: { modules: true, students: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });
    }

    async getExams(user: any) {
        const cacheKey = `teacher:exams:${user.id}:${user.role}:${user.orgId || 'none'}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const where: any = {};
        if (user.role === 'ADMIN') {
            where.orgId = user.orgId;
        } else {
            where.creatorId = user.id;
        }
        const response = await this.prisma.exam.findMany({
            where,
            orderBy: { updatedAt: 'desc' }
        });

        await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
        return response;
    }

    async deleteCourse(id: string, user: any) {
        try {
            const course = await this.prisma.course.findUnique({ where: { id } });
            if (!course) return { success: true, message: 'Course already deleted' };
            this.checkAccess(course, user);

            // Optimized: Use Cascade Delete defined in Prisma Schema
            // This replaces the previous N+1 manual deletion loop
            const deleted = await this.prisma.course.delete({ where: { id } });
            return { success: true, deleted };
        } catch (e) {
            console.error(`[TeacherService] Delete failed for course ${id}:`, e);
            throw new Error(`Failed to delete course: ${e.message}`);
        }
    }

    async updateCourse(id: string, user: any, data: any) {
        const existing = await this.prisma.course.findUnique({ where: { id } });
        if (!existing) throw new Error('Course not found');
        this.checkAccess(existing, user);

        const course = await this.prisma.course.update({
            where: { id },
            data: {
                title: data.title,
                slug: data.slug,
                shortDescription: data.shortDescription,
                longDescription: data.longDescription,
                difficulty: data.difficulty,
                tags: data.tags,
                thumbnail: data.thumbnail,
                courseSummary: data.courseSummary,
                aiTokensUsed: data.aiTokensUsed ? Number(data.aiTokensUsed) : undefined,
                isVisible: !!data.isVisible,
                status: data.status
            }
        });

        // Invalidate course cache
        await this.courseService.invalidateCourseCache(course.slug);
        if (existing.slug !== course.slug) {
            await this.courseService.invalidateCourseCache(existing.slug);
        }

        // 1. Sync Modules and Units
        if (data.sections && Array.isArray(data.sections)) {
            const existingModules = await this.prisma.courseModule.findMany({
                where: { courseId: id },
                include: { units: true }
            });

            const currentModuleIds = data.sections.map((s: any) => s.id).filter((id: string) => this.isUUID(id));
            const modulesToDelete = existingModules.filter((m: any) => !currentModuleIds.includes(m.id));

            for (const mod of modulesToDelete) {
                await this.prisma.courseModule.delete({ where: { id: mod.id } });
            }

            for (let i = 0; i < data.sections.length; i++) {
                const sec = data.sections[i];
                const isNewModule = !this.isUUID(sec.id);

                let module;
                if (!isNewModule) {
                    module = await this.prisma.courseModule.upsert({
                        where: { id: sec.id },
                        update: { title: sec.title, order: i },
                        create: { id: sec.id, title: sec.title, order: i, courseId: id }
                    });
                } else {
                    module = await this.prisma.courseModule.create({
                        data: { title: sec.title, order: i, courseId: id }
                    });
                }

                if (sec.questions && Array.isArray(sec.questions)) {
                    // Refresh existing units list for deletion check since we might have upserted the module
                    const unitsInDb = await this.prisma.unit.findMany({ where: { moduleId: module.id }, select: { id: true } });
                    const unitsInDbIds = unitsInDb.map(u => u.id);

                    const currentUnitIds = sec.questions.map((q: any) => q.id).filter((id: string) => this.isUUID(id));
                    const unitsToDelete = unitsInDbIds.filter((uid: string) => !currentUnitIds.includes(uid));

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
                            moduleId: module.id
                        };

                        if (hasUUID) {
                            await this.prisma.unit.upsert({
                                where: { id: q.id },
                                update: unitData,
                                create: { ...unitData, id: q.id }
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
                where: { courseId: id }
            });

            const currentTestIds = data.tests.map((t: { id: string }) => t.id).filter((id: string) => this.isUUID(id));
            const testsToDelete = existingTests.filter((t: any) => !currentTestIds.includes(t.id));

            for (const test of testsToDelete) {
                await this.prisma.courseTest.delete({ where: { id: test.id } });
            }

            for (const test of data.tests) {
                const hasUUID = this.isUUID(test.id);
                const testData = {
                    title: test.title,
                    slug: test.slug || `${test.title.toLowerCase().replace(/ /g, '-')}-${Date.now()}`,
                    questions: test.questions || [],
                    startDate: test.startDate ? new Date(test.startDate) : null,
                    endDate: test.endDate ? new Date(test.endDate) : null,
                    courseId: id
                };

                if (hasUUID) {
                    await this.prisma.courseTest.upsert({
                        where: { id: test.id },
                        update: testData,
                        create: { ...testData, id: test.id }
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
                students: { select: { id: true } }
            }
        });

        if (updatedCourse && updatedCourse.students.length > 0) {
            const allUnitIds = updatedCourse.modules.flatMap((m: any) => m.units.map((u: any) => u.id));
            const totalUnits = allUnitIds.length;

            for (const student of updatedCourse.students) {
                const completedSubmissions = await this.prisma.unitSubmission.findMany({
                    where: {
                        userId: student.id,
                        unitId: { in: allUnitIds },
                        status: 'COMPLETED'
                    },
                    select: { unitId: true }
                });

                const completedUnitIds = [...new Set(completedSubmissions.map((s: any) => s.unitId))];
                const completedCount = completedUnitIds.length;
                const percent = totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;
                const status =
                    completedCount === totalUnits && totalUnits > 0
                        ? 'Completed'
                        : completedCount > 0
                            ? 'In Progress'
                            : 'Not Started';

                // @ts-ignore
                await this.prisma.courseProgress.upsert({
                    where: { userId_courseId: { userId: student.id, courseId: id } },
                    update: { completedUnits: completedUnitIds, totalUnits, completedCount, percent, status },
                    create: { userId: student.id, courseId: id, completedUnits: completedUnitIds, totalUnits, completedCount, percent, status }
                });

                // Invalidate student stats caches
                await this.redis.del(`student:stats:${student.id}`);
                await this.redis.del(`student:analytics:${student.id}`);
            }
        }

        return course;
    }

    private isUUID(str: string): boolean {
        if (!str || typeof str !== 'string') return false;
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(str);
    }

    async createCourse(user: any, data: any) {
        const orgId = user.role === 'SUPER_ADMIN' && data.orgId ? data.orgId : user.orgId;
        if (!orgId) throw new Error('Organization ID is required');

        const course = await this.prisma.course.create({
            data: {
                title: data.title,
                slug: data.slug || `course-${Date.now()}`,
                creatorId: user.id, // Ensure Prisma schema has this
                orgId: orgId,
                // ... map other fields explicitly or cast data if needed
                shortDescription: data.shortDescription,
                longDescription: data.longDescription,
                difficulty: data.difficulty,
                tags: data.tags || [],
                thumbnail: data.thumbnail,
                courseSummary: data.courseSummary,
                aiTokensUsed: data.aiTokensUsed ? Number(data.aiTokensUsed) : undefined,
                isVisible: !!data.isVisible,
                status: data.status || 'Draft',
                modules: {
                    create: (data.modules || []).map((m: any) => ({
                        title: m.title,
                        order: m.order,
                        units: {
                            create: (m.units || []).map((u: any) => ({
                                title: u.title,
                                type: u.type,
                                order: u.order,
                                content: u.content || {}
                            }))
                        }
                    }))
                },
                tests: {
                    create: (data.tests || []).map((t: any) => ({
                        title: t.title,
                        slug: t.slug || `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        questions: t.questions || []
                    }))
                }
            } as any, // Cast to any to avoid creatorId type issues if schema is lagging
            include: {
                modules: { include: { units: true } },
                tests: true
            }
        });
        return course;
    }

    async createExam(user: any, data: any) {
        const orgId = user.role === 'SUPER_ADMIN' && data.orgId ? data.orgId : user.orgId;
        if (!orgId) throw new Error('Organization ID is required');

        return this.prisma.exam.create({
            data: {
                title: data.title,
                slug: data.slug || `exam-${Date.now()}`,
                creatorId: user.id,
                orgId: orgId,
                shortDescription: data.shortDescription,
                longDescription: data.longDescription,
                difficulty: data.difficulty,
                tags: data.tags || [],
                duration: Number(data.duration) || 60,
                totalMarks: data.totalMarks ? Number(data.totalMarks) : 0,
                testCode: data.testCode,
                testCodeType: data.testCodeType,
                rotationInterval: data.rotationInterval ? Number(data.rotationInterval) : null,
                inviteToken: data.inviteToken,
                allowedIPs: data.allowedIPs,
                examMode: data.examMode,
                aiProctoring: !!data.aiProctoring,
                tabSwitchLimit: data.tabSwitchLimit ? Number(data.tabSwitchLimit) : null,
                startTime: data.startTime ? new Date(data.startTime) : null,
                endTime: data.endTime ? new Date(data.endTime) : null,
                questions: data.sections || data.questions || [],
                aiTokensUsed: data.aiTokensUsed ? Number(data.aiTokensUsed) : undefined,
                isActive: data.isActive ?? data.isVisible ?? true
            } as any
        });
    }

    async updateExam(id: string, user: any, data: any) {
        const existing = await this.prisma.exam.findUnique({ where: { id } });
        if (!existing) throw new Error('Exam not found');
        this.checkAccess(existing, user);

        // Calculate total marks from questions if provided
        let calculatedTotalMarks = 0;
        const questionsSource = data.sections || data.questions;

        const sumMarks = (items: any[]) => {
            items.forEach(item => {
                if (item.questions && Array.isArray(item.questions)) {
                    sumMarks(item.questions);
                } else if (item.type || item.marks || item.points) {
                    calculatedTotalMarks += (Number(item.marks) || Number(item.points) || (item.type === 'Coding' ? 10 : 1));
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
        const finalTotalMarks = calculatedTotalMarks > 0 ? calculatedTotalMarks : (data.totalMarks ? Number(data.totalMarks) : undefined);

        const updatedExam = await this.prisma.exam.update({
            where: { id },
            data: {
                title: data.title,
                slug: data.slug,
                shortDescription: data.shortDescription,
                longDescription: data.longDescription,
                difficulty: data.difficulty,
                tags: data.tags,
                duration: data.duration ? Number(data.duration) : undefined,
                totalMarks: finalTotalMarks,
                testCode: data.testCode,
                testCodeType: data.testCodeType,
                rotationInterval: data.rotationInterval ? Number(data.rotationInterval) : null,
                inviteToken: data.inviteToken,
                allowedIPs: data.allowedIPs,
                examMode: data.examMode,
                aiProctoring: data.aiProctoring,
                tabSwitchLimit: data.tabSwitchLimit ? Number(data.tabSwitchLimit) : null,
                startTime: data.startTime ? new Date(data.startTime) : null,
                endTime: data.endTime ? new Date(data.endTime) : null,
                questions: data.sections || data.questions,
                aiTokensUsed: data.aiTokensUsed ? Number(data.aiTokensUsed) : undefined,
                isActive: data.isActive ?? data.isVisible
            }
        });

        // Invalidate Redis cache
        await this.redis.del(`exam:content:${updatedExam.slug}`);
        if (existing.slug !== updatedExam.slug) {
            await this.redis.del(`exam:content:${existing.slug}`);
        }

        return updatedExam;
    }

    async deleteExam(id: string, user: any) {
        try {
            const exam = await this.prisma.exam.findUnique({ where: { id } });
            if (!exam) return { success: true, message: 'Exam already deleted' };
            this.checkAccess(exam, user);

            await this.prisma.$transaction(async (tx) => {
                await tx.feedback.deleteMany({ where: { examId: id } });
                await tx.violation.deleteMany({ where: { session: { examId: id } } });
                await tx.examSession.deleteMany({ where: { examId: id } });
                await tx.exam.delete({ where: { id } });
            });

            await this.redis.del(`exam:content:${exam.slug}`);
            await this.redis.del(`exam:lookup:${exam.slug}`);

            return { success: true, deleted: { id } };
        } catch (e) {
            console.error(`[TeacherService] Final delete failed for exam ${id}:`, e);
            throw new Error(`Failed to delete exam: ${e.message}`);
        }
    }

    async getMonitoredStudents(examId: string, user: any) {
        // Verify ownership
        const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) throw new Error('Exam not found');
        this.checkAccess(exam, user);

        // Fetch all sessions for this exam
        const sessions = await this.prisma.examSession.findMany({
            where: { examId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        rollNumber: true
                    }
                },
                violations: {
                    orderBy: { timestamp: 'desc' }
                }
            },
            orderBy: { startTime: 'desc' }
        });

        // Transform to frontend format
        return sessions.map((session: any) => {
            const tabSwitchViolations = session.violations.filter((v: any) => v.type === 'TAB_SWITCH' || v.type === 'TAB_SWITCH_OUT' || v.type === 'TAB_SWITCH_IN');
            const vmViolations = session.violations.filter((v: any) => v.type === 'VM_DETECTED');

            return {
                id: session.user.id,
                name: session.user.name || session.user.email || 'Unknown',
                email: session.user.email,
                rollNumber: session.user.rollNumber || 'N/A',
                status: session.status === 'COMPLETED' || (Date.now() > (new Date(session.startTime).getTime() + (exam.duration * 60000)) && session.status !== 'TERMINATED') ? 'Completed' : session.status === 'TERMINATED' ? 'Terminated' : 'In Progress',
                ip: session.ipAddress || 'Unknown',
                vmDetected: session.vmDetected || vmViolations.length > 0,
                vmType: vmViolations.length > 0 ? vmViolations[0].message : null,
                tabOuts: session.violations.filter((v: any) => v.type === 'TAB_SWITCH' || v.type === 'TAB_SWITCH_OUT').length,
                tabIns: session.violations.filter((v: any) => v.type === 'TAB_SWITCH_IN').length,
                isHighRisk: session.vmDetected || tabSwitchViolations.length > 5,
                lastActivity: new Date(session.updatedAt).toLocaleString(),
                startTime: new Date(session.startTime).toLocaleTimeString(),
                endTime: session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'Ongoing',
                monitors: 1,
                loginCount: 1,
                sleepDuration: '0m',
                appVersion: 'Web',
                logs: session.violations.map((v: any) => ({
                    time: new Date(v.timestamp).toLocaleTimeString(),
                    event: v.type === 'TAB_SWITCH' || v.type === 'TAB_SWITCH_OUT' ? 'Tab Switch Out' : v.type === 'TAB_SWITCH_IN' ? 'Tab Switch In' : v.type === 'VM_DETECTED' ? 'VM Detection' : v.type,
                    description: v.message || 'No details'
                }))
            };
        });
    }

    async getFeedbacks(examId: string, user: any) {
        // Verify ownership
        const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) throw new Error('Exam not found');
        this.checkAccess(exam, user);

        const feedbacks = await this.prisma.feedback.findMany({
            where: { examId },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { timestamp: 'desc' }
        });

        return feedbacks.map((f: any) => ({
            id: f.id,
            userName: f.user.name || f.user.email || 'Anonymous',
            userEmail: f.user.email,
            rating: f.rating,
            comment: f.comment || '',
            time: new Date(f.timestamp).toLocaleString(),
            isSeen: false // You can add a field to track this in the schema if needed
        }));
    }

    async terminateExamSession(examId: string, studentId: string, user: any) {
        // Verify ownership (Handle both ID and Slug)
        const isUuid = this.isUUID(examId);
        let exam = await this.prisma.exam.findUnique({
            where: isUuid ? { id: examId } : { slug: examId }
        });

        if (!exam) throw new Error('Exam not found');
        this.checkAccess(exam, user);

        const realExamId = exam.id;
        const examSlug = exam.slug;

        // Find sessions to invalidate cache
        const sessions = await this.prisma.examSession.findMany({
            where: { examId: realExamId, userId: studentId }
        });

        // Update session status
        await this.prisma.examSession.updateMany({
            where: { examId: realExamId, userId: studentId },
            data: { status: 'TERMINATED', endTime: new Date() }
        });

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
        let exam = await this.prisma.exam.findUnique({
            where: isUuid ? { id: examId } : { slug: examId }
        });

        if (!exam) throw new Error('Exam not found');
        this.checkAccess(exam, user);

        const realExamId = exam.id;

        // Find sessions to invalidate cache
        const sessions = await this.prisma.examSession.findMany({
            where: { examId: realExamId, userId: studentId }
        });

        // Update session status back to IN_PROGRESS
        await this.prisma.examSession.updateMany({
            where: { examId: realExamId, userId: studentId },
            data: { status: 'IN_PROGRESS', endTime: null }
        });

        // Invalidate caches to allow re-entry/re-processing
        for (const session of sessions) {
            await this.redis.del(`session:status:${session.id}`);
            await this.redis.del(`session:meta:${session.id}`);
        }

        return { success: true };
    }

    async getExamResults(examId: string, user: any, page: number = 1, limit: number = 50, search: string = '') {
        const boundedLimit = this.parseBoundedNumber(limit, 50, 1, 100);
        const boundedPage = this.parseBoundedNumber(page, 1, 1, 100000);
        const normalizedSearch = String(search || '').trim();
        const cacheKey = `teacher:exam_results:${user.id}:${examId}:p:${boundedPage}:l:${boundedLimit}:q:${normalizedSearch || '_'}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        // Verify ownership
        const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) throw new Error('Exam not found');
        this.checkAccess(exam, user);

        const skip = (boundedPage - 1) * boundedLimit;

        // Where Clause
        const where: any = { examId };
        if (normalizedSearch) {
            where.user = {
                OR: [
                    { name: { contains: normalizedSearch, mode: 'insensitive' } },
                    { email: { contains: normalizedSearch, mode: 'insensitive' } },
                    { rollNumber: { contains: normalizedSearch, mode: 'insensitive' } }
                ]
            };
        }

        // 1. Fetch Stats (Minimal)
        const allStatsData = await this.prisma.examSession.findMany({
            where: { examId },
            select: { status: true, score: true }
        });

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
                            rollNumber: true
                        }
                    }
                },
                orderBy: { endTime: 'desc' },
                skip,
                take: boundedLimit
            }),
            this.prisma.examSession.count({ where })
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
                const marks = Number(q.marks) || Number(q.points) || (q.type === 'Coding' ? 10 : 1);
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
                    if (firstItem && (firstItem.questions || firstItem.id?.startsWith('sec-'))) {
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

            return dynamicTotalMarks > 0 ? dynamicTotalMarks : (Number(exam.totalMarks) || 0);
        };

        const totalMarks = computeTotalMarks(exam.questions);
        const marksDenominator = totalMarks || Number(exam.totalMarks) || 100;

        // Map sessions to frontend format
        const mappedSessions = sessions.map((session: any) => {
            const answers = typeof session.answers === 'string'
                ? JSON.parse(session.answers)
                : (session.answers || {});

            const metadata = answers._internal_metadata || {};

            const score = session.score !== null
                ? session.score
                : this.examService.calculateScore(answers, exam.questions);

            const status = totalMarks > 0
                ? (score / totalMarks >= 0.4 ? 'Passed' : 'Failed')
                : (session.status === 'COMPLETED' ? 'Submitted' : 'Failed');

            return {
                sessionId: session.id,
                rollNo: metadata.rollNumber || session.user.rollNumber || 'N/A',
                name: metadata.name || session.user.name || 'Unknown',
                email: session.user.email,
                section: metadata.section || 'N/A',
                submittedAt: session.endTime ? new Date(session.endTime).toLocaleString() : 'Open',
                timeTaken: session.endTime
                    ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000) + ' min'
                    : 'N/A',
                attempted: Object.keys(answers).filter(k => k.startsWith('_submitted_')).length + ' Q',
                score: score,
                totalPossible: totalMarks,
                status: status
            };
        });

        let totalScore = 0;
        let highScore = 0;
        let passedCount = 0;
        const distribution = [0, 0, 0, 0];

        for (const row of allStatsData as any[]) {
            const score = Number(row.score) || 0;
            totalScore += score;
            if (score > highScore) highScore = score;

            const pct = marksDenominator > 0 ? (score / marksDenominator) : 0;
            if (pct < 0.25) distribution[0] += 1;
            else if (pct < 0.5) distribution[1] += 1;
            else if (pct < 0.75) distribution[2] += 1;
            else distribution[3] += 1;

            if (pct >= 0.4) passedCount += 1;
        }

        const failedCount = allStatsData.length - passedCount;

        const response = {
            results: mappedSessions,
            resultsPublished: (exam as any).resultsPublished || false,
            pagination: {
                total: totalFiltered,
                page: boundedPage,
                limit: boundedLimit,
                totalPages: Math.ceil(totalFiltered / boundedLimit)
            },
            stats: {
                avgScore: totalScore / (allStatsData.length || 1),
                passedCount,
                failedCount,
                totalCount: allStatsData.length,
                highScore,
                distribution: [
                    { score: '0-25%', count: distribution[0] },
                    { score: '25-50%', count: distribution[1] },
                    { score: '50-75%', count: distribution[2] },
                    { score: '75-100%', count: distribution[3] },
                ]
            }
        };

        await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 15);
        return response;
    }

    async updateSubmissionScore(sessionId: string, newScore: number, user: any, internalMarks?: Record<string, number>) {
        // Verify ownership via session -> exam
        const session = await this.prisma.examSession.findUnique({
            where: { id: sessionId },
            include: { exam: true }
        });

        if (!session) throw new Error('Session not found');
        this.checkAccess(session.exam, user);

        const updateData: any = { score: newScore };

        // If internal marks are provided, update the answers JSON
        if (internalMarks) {
            const currentAnswers = (session.answers as any) || {};
            updateData.answers = {
                ...currentAnswers,
                _internal_marks: internalMarks
            };
        }

        return this.prisma.examSession.update({
            where: { id: sessionId },
            data: updateData
        });
    }

    async publishResults(examId: string, user: any) {
        const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) throw new Error('Exam not found');
        this.checkAccess(exam, user);

        return this.prisma.exam.update({
            where: { id: examId },
            data: { resultsPublished: true }
        });
    }

    // ─── GROUPS ────────────────────────────────────────────────────────────────

    async getGroups(user: any) {
        const cacheKey = `teacher:groups:${user.id}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const response = await this.prisma.studentGroup.findMany({
            where: { teacherId: user.id },
            include: {
                students: { select: { id: true, name: true, email: true, rollNumber: true } },
                _count: { select: { students: true, announcements: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
        return response;
    }

    async getGroup(groupId: string, user: any) {
        const group = await this.prisma.studentGroup.findUnique({
            where: { id: groupId },
            include: {
                students: { select: { id: true, name: true, email: true, rollNumber: true } },
                _count: { select: { students: true, announcements: true } }
            }
        });
        if (!group) throw new NotFoundException('Group not found');
        if (group.teacherId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Access denied');
        }
        return group;
    }

    async createGroup(user: any, data: { name: string; emails?: string[] }) {
        if (!data.name || !data.name.trim()) throw new BadRequestException('Group name is required');

        const group = await this.prisma.studentGroup.create({
            data: {
                name: data.name.trim(),
                teacherId: user.id,
                orgId: user.orgId || null
            }
        });

        // If emails provided, add students in bulk
        if (data.emails && data.emails.length > 0) {
            const result = await this.addGroupStudents(group.id, data.emails, user);
            return { ...group, enrollResult: result };
        }

        return group;
    }

    async updateGroup(groupId: string, user: any, data: { name: string }) {
        const group = await this.prisma.studentGroup.findUnique({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Group not found');
        if (group.teacherId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Access denied');
        }

        return this.prisma.studentGroup.update({
            where: { id: groupId },
            data: { name: data.name.trim() }
        });
    }

    async deleteGroup(groupId: string, user: any) {
        const group = await this.prisma.studentGroup.findUnique({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Group not found');
        if (group.teacherId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Access denied');
        }

        return this.prisma.studentGroup.delete({ where: { id: groupId } });
    }

    async addGroupStudents(groupId: string, emails: string[], user: any) {
        const group = await this.prisma.studentGroup.findUnique({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Group not found');
        if (group.teacherId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Access denied');
        }

        const normalizedEmails = [...new Set(
            (emails || []).map((email) => String(email || '').trim().toLowerCase()).filter(Boolean)
        )];

        if (normalizedEmails.length === 0) {
            return {
                summary: { totalProcessed: 0, added: 0, failed: 0 },
                details: []
            };
        }

        const [students, groupMembers] = await Promise.all([
            this.prisma.user.findMany({
                where: { email: { in: normalizedEmails } },
                select: { id: true, email: true, name: true, role: true }
            }),
            this.prisma.studentGroup.findUnique({
                where: { id: groupId },
                select: { students: { select: { id: true } } }
            })
        ]);

        const studentByEmail = new Map(students.map((s: any) => [String(s.email).toLowerCase(), s]));
        const memberSet = new Set((groupMembers?.students || []).map((s: any) => s.id));

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
                if (student.role !== 'STUDENT') {
                    results.push({ email, success: false, error: 'User is not a student' });
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
                results.push({ email, success: true, user: { id: student.id, name: student.name } });
                addedCount++;
            } catch (error: any) {
                results.push({ email, success: false, error: error.message });
                failedCount++;
            }
        }

        if (toConnect.length > 0) {
            await this.prisma.studentGroup.update({
                where: { id: groupId },
                data: { students: { connect: toConnect } }
            });
        }

        return {
            summary: { totalProcessed: normalizedEmails.length, added: addedCount, failed: failedCount },
            details: results
        };
    }

    async removeGroupStudent(groupId: string, studentId: string, user: any) {
        const group = await this.prisma.studentGroup.findUnique({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Group not found');
        if (group.teacherId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Access denied');
        }

        return this.prisma.studentGroup.update({
            where: { id: groupId },
            data: { students: { disconnect: { id: studentId } } }
        });
    }

    async enrollGroupInCourse(courseId: string, groupId: string, user: any) {
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new NotFoundException('Course not found');
        this.checkAccess(course, user);

        const group = await this.prisma.studentGroup.findUnique({
            where: { id: groupId },
            include: { students: { select: { id: true, email: true, name: true } } }
        });
        if (!group) throw new NotFoundException('Group not found');
        if (group.teacherId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Access denied');
        }

        const existingCourse = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { students: { select: { id: true } } }
        });

        const enrolledSet = new Set((existingCourse?.students || []).map((s: any) => s.id));
        const toConnect: Array<{ id: string }> = [];
        let alreadyEnrolled = 0;

        for (const student of group.students) {
            if (enrolledSet.has(student.id)) {
                alreadyEnrolled++;
            } else {
                enrolledSet.add(student.id);
                toConnect.push({ id: student.id });
            }
        }

        if (toConnect.length > 0) {
            await this.prisma.course.update({
                where: { id: courseId },
                data: { students: { connect: toConnect } }
            });
        }

        return {
            groupName: group.name,
            totalStudents: group.students.length,
            enrolled: toConnect.length,
            alreadyEnrolled
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
                _count: { select: { reads: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
        return response;
    }

    async createAnnouncement(user: any, data: {
        title: string;
        content: string;
        groupIds: string[];
        attachments?: { name: string; url: string; type: string; size: number }[];
    }) {
        if (!data.title?.trim()) throw new BadRequestException('Title is required');
        if (!data.content?.trim()) throw new BadRequestException('Content is required');
        if (!data.groupIds || data.groupIds.length === 0) throw new BadRequestException('At least one group must be selected');

        // Verify all groups belong to this teacher
        const groups = await this.prisma.studentGroup.findMany({
            where: { id: { in: data.groupIds }, teacherId: user.id },
            include: { students: { select: { id: true } } }
        });
        if (groups.length !== data.groupIds.length) {
            throw new ForbiddenException('One or more groups not found or not owned by you');
        }

        const announcement = await this.prisma.announcement.create({
            data: {
                title: data.title.trim(),
                content: data.content,
                attachments: data.attachments || [],
                teacherId: user.id,
                orgId: user.orgId || null,
                groups: { connect: data.groupIds.map(id => ({ id })) }
            },
            include: {
                groups: { select: { id: true, name: true } },
                teacher: { select: { name: true } }
            }
        });

        // Collect unique student IDs from all target groups
        const studentIdSet = new Set<string>();
        for (const group of groups) {
            for (const student of group.students) {
                studentIdSet.add(student.id);
            }
        }

        // Broadcast via WebSocket
        await this.notificationGateway.broadcastAnnouncement({
            id: announcement.id,
            title: announcement.title,
            content: announcement.content,
            attachments: announcement.attachments,
            teacherName: announcement.teacher.name || 'Teacher',
            groupNames: announcement.groups.map(g => g.name),
            createdAt: announcement.createdAt
        }, Array.from(studentIdSet));

        return announcement;
    }

    async updateAnnouncement(announcementId: string, user: any, data: {
        title: string;
        content: string;
        groupIds: string[];
        attachments?: { name: string; url: string; type: string; size: number }[];
    }) {
        const existing = await this.prisma.announcement.findUnique({
            where: { id: announcementId },
            include: { groups: { select: { id: true } } }
        });

        if (!existing) throw new NotFoundException('Announcement not found');
        if (existing.teacherId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Access denied');
        }

        if (!data.title?.trim()) throw new BadRequestException('Title is required');
        if (!data.content?.trim()) throw new BadRequestException('Content is required');
        if (!data.groupIds || data.groupIds.length === 0) throw new BadRequestException('At least one group must be selected');

        const groupOwnerId = existing.teacherId;
        const groups = await this.prisma.studentGroup.findMany({
            where: { id: { in: data.groupIds }, teacherId: groupOwnerId },
            select: { id: true }
        });

        if (groups.length !== data.groupIds.length) {
            throw new ForbiddenException('One or more groups not found or not owned by the announcement teacher');
        }

        const oldAttachments = Array.isArray(existing.attachments) ? (existing.attachments as any[]) : [];
        const nextAttachments = data.attachments || [];
        const nextAttachmentUrls = new Set(nextAttachments.map((att: any) => att?.url).filter(Boolean));

        for (const att of oldAttachments) {
            if (att?.url && !nextAttachmentUrls.has(att.url)) {
                await this.storageService.deleteFile(att.url).catch(() => undefined);
            }
        }

        return this.prisma.announcement.update({
            where: { id: announcementId },
            data: {
                title: data.title.trim(),
                content: data.content,
                attachments: nextAttachments,
                groups: {
                    set: data.groupIds.map(id => ({ id }))
                }
            },
            include: {
                groups: { select: { id: true, name: true } },
                _count: { select: { reads: true } }
            }
        });
    }

    async deleteAnnouncement(announcementId: string, user: any) {
        const announcement = await this.prisma.announcement.findUnique({
            where: { id: announcementId },
            include: { groups: true }
        });
        if (!announcement) throw new NotFoundException('Announcement not found');
        if (announcement.teacherId !== user.id && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Access denied');
        }

        // Delete attachment files from S3
        const attachments = announcement.attachments as any[];
        if (Array.isArray(attachments)) {
            for (const att of attachments) {
                if (att.url) {
                    await this.storageService.deleteFile(att.url);
                }
            }
        }

        return this.prisma.announcement.delete({ where: { id: announcementId } });
    }

    async uploadAnnouncementFile(fileData: any, filename: string, mimetype: string, contentLength?: number) {
        return this.storageService.uploadFile(fileData, filename, mimetype, 'announcements', contentLength);
    }

}
