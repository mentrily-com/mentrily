import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { CertificateService } from '../certificate/certificate.service';

@Processor('student-analytics', {
  // Optimize for serverless Redis (reduce command usage)
  stalledInterval: 300000, // 5 minutes
  maxStalledCount: 3,
})
@Injectable()
export class StudentProcessor extends WorkerHost {
  private readonly logger = new Logger(StudentProcessor.name);

  constructor(
    private readonly supabase: SupabaseService,
    private certificateService: CertificateService,
  ) {
    super();
  }

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'update-streak':
        return this.handleUpdateStreak(job.data);
      case 'update-course-progress':
        return this.handleUpdateCourseProgress(job.data);
      case 'save-question-attempt':
        return this.handleSaveQuestionAttempt(job.data);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleUpdateStreak(data: { userId: string }): Promise<void> {
    const { userId } = data;

    const { data: activityData, error } = await (
      this.supabase.client as any
    ).rpc('get_student_activity_dates', {
      p_user_id: userId,
      p_limit: 365,
    });

    if (error) {
      throw new Error(
        error.message || 'Failed to fetch student activity dates',
      );
    }

    const activities: { dayString: Date }[] = Array.isArray(activityData)
      ? activityData.map((item: any) => ({
          dayString: new Date(item.day_string),
        }))
      : [];

    let streak = 0;
    let lastActivityDate = null;

    if (activities.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Using the raw result
      lastActivityDate = new Date(activities[0].dayString);
      const lastActivityDay = new Date(activities[0].dayString);
      lastActivityDay.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (today.getTime() - lastActivityDay.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff <= 1) {
        const activityDates = new Set(
          activities.map((a: any) => {
            const d = new Date(a.dayString);
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
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        // @ts-ignore
        dailyStreak: streak,
        // @ts-ignore
        lastActivityDate: lastActivityDate,
      },
    });

    this.logger.debug(`Updated streak for user ${userId} to ${streak}`);
  }

  private async handleUpdateCourseProgress(data: {
    userId: string;
    courseId?: string;
    unitId?: string;
  }): Promise<void> {
    const { userId, unitId } = data;
    let { courseId } = data;

    // If courseId wasn't provided, try to find it from the unitId
    if (!courseId && unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        include: { module: { select: { courseId: true } } },
      });
      if (unit && unit.module) {
        courseId = unit.module.courseId;
      }
    }

    if (!courseId) {
      this.logger.warn(
        `Could not determine courseId for progress update for user ${userId}`,
      );
      return;
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
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

    if (!course) return;

    const allUnitIds = course.modules.flatMap((m) => m.units.map((u) => u.id));
    const totalUnits = allUnitIds.length;

    // Find all completed submissions for these units
    const completedSubmissions = await this.prisma.unitSubmission.findMany({
      where: {
        userId,
        unitId: { in: allUnitIds },
        status: 'COMPLETED',
      },
      select: { unitId: true },
    });

    const completedUnitIds = Array.from(
      new Set(completedSubmissions.map((s) => s.unitId)),
    );
    const completedCount = completedUnitIds.length;

    const percent =
      totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;
    const status =
      completedCount === totalUnits && totalUnits > 0
        ? 'Completed'
        : completedCount > 0
          ? 'In Progress'
          : 'Not Started';

    // @ts-ignore - Prisma types might be stale in IDE but schema is correct
    await this.prisma.courseProgress.upsert({
      where: {
        userId_courseId: { userId, courseId },
      },
      update: {
        completedUnits: completedUnitIds,
        totalUnits,
        completedCount,
        percent,
        status,
      },
      create: {
        userId,
        courseId,
        completedUnits: completedUnitIds,
        totalUnits,
        completedCount,
        percent,
        status,
      },
    });

    const completionThreshold = Number(course.completionThreshold ?? 100);
    const hasLinkedExam = Boolean(course.linkedExamId);
    const hasTemplate = Boolean(course.certificateTemplateId);

    if (percent >= completionThreshold && !hasLinkedExam && hasTemplate) {
      try {
        await this.certificateService.generateCertificate(
          userId,
          'course',
          courseId,
          course.certificateTemplateId || undefined,
        );
      } catch (error: any) {
        this.logger.warn(
          `Course certificate generation skipped for user ${userId}, course ${courseId}: ${error?.message || 'unknown_error'}`,
        );
      }
    }

    this.logger.debug(
      `Updated progress for user ${userId} on course ${courseId} to ${percent}%`,
    );
  }

  private async handleSaveQuestionAttempt(data: {
    userId: string;
    itemId: string;
    type: string;
    content: any;
    isCorrect: boolean;
    score?: number;
    sessionId?: string;
  }): Promise<void> {
    const { userId, itemId, type, content, isCorrect, score, sessionId } = data;

    // @ts-ignore
    await this.prisma.questionAttempt.create({
      data: {
        userId,
        itemId,
        type,
        content,
        isCorrect,
        score,
        sessionId,
      },
    });

    // Also update total XP if correct
    if (isCorrect) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          // @ts-ignore
          totalXP: { increment: 10 }, // 10 XP per correct question
        },
      });
    }
  }
}
