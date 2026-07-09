import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WebhookService } from '../webhook/webhook.service';
import { ExamService } from '../exam/exam.service';
import {
  readStashedSessionAnswers,
  sessionAnswersHashKey,
  stashSessionAnswers,
} from '../common/session-answers.util';

@Processor('submission_queue', {
  // Optimize for serverless Redis (reduce command usage)
  stalledInterval: 300000, // 5 minutes
  maxStalledCount: 3,
  lockDuration: 60000, // 60s
  // Flush jobs are IO-bound (1 read + 1 write); with coalescing there is at
  // most one job per active session so a higher concurrency drains bursts
  // (e.g. everyone answering at exam start) without backlog.
  concurrency: 25,
})
export class SubmissionProcessor extends WorkerHost {
  constructor(
    private readonly supabase: SupabaseService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('student-analytics') private studentAnalyticsQueue: Queue,
    private examService: ExamService,
    private webhookService: WebhookService,
  ) {
    super();
  }

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'flush_answers':
        return this.handleFlushAnswers(job.data.sessionId);
      case 'save_answer':
        // Legacy job shape (in-flight during deploy): stage the payload,
        // then run the same flush path.
        await stashSessionAnswers(
          this.redis,
          job.data.sessionId,
          job.data.answer || {},
        );
        return this.handleFlushAnswers(job.data.sessionId);
      case 'auto_submit':
        return this.handleAutoSubmit(job);
    }
  }

  /**
   * Session metadata needed for flushing, cached in Redis for the duration
   * of the exam so repeated flushes cost zero extra DB reads.
   */
  private async getSessionMeta(sessionId: string): Promise<{
    userId: string | null;
    status: string | null;
    questions: any;
    linkedCourseId: string | null;
    startTimeMs: number | null;
    durationMins: number | null;
  } | null> {
    const sessionCacheKey = `session:meta:${sessionId}`;
    const cached = await this.redis.get(sessionCacheKey);
    if (cached) {
      try {
        const meta = JSON.parse(cached);
        if (
          typeof meta.linkedCourseId !== 'undefined' &&
          typeof meta.startTimeMs !== 'undefined'
        ) {
          return {
            userId: meta.userId || null,
            status: meta.status || null,
            questions: meta.questions,
            linkedCourseId: meta.linkedCourseId || null,
            startTimeMs: meta.startTimeMs ?? null,
            durationMins: meta.durationMins ?? null,
          };
        }
      } catch {
        /* fall through to DB */
      }
    }

    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        status: true,
        startTime: true,
        exam: {
          select: { questions: true, linkedCourseId: true, duration: true },
        },
      },
    });

    if (!session) return null;

    const meta = {
      userId: session.userId,
      status: session.status,
      questions: session.exam?.questions ?? null,
      linkedCourseId: session.exam?.linkedCourseId || null,
      startTimeMs: session.startTime
        ? new Date(session.startTime).getTime()
        : null,
      durationMins: session.exam?.duration ?? null,
    };

    await this.redis.set(
      sessionCacheKey,
      JSON.stringify({
        examId: session.id,
        userId: meta.userId,
        questions: meta.questions,
        status: meta.status,
        linkedCourseId: meta.linkedCourseId,
        startTimeMs: meta.startTimeMs,
        durationMins: meta.durationMins,
      }),
      'EX',
      10800,
    );

    return meta;
  }

  /** Grace window past the official end before the server closes a session. */
  private static readonly LATE_SUBMIT_GRACE_MS = 2 * 60 * 1000;

  /**
   * Server-side time enforcement. The client timer is advisory — a student
   * can freeze it with dev tools. If a write arrives past the deadline, the
   * session is closed (auto-submitted) instead of accepting answers forever.
   */
  private isPastDeadline(meta: {
    startTimeMs: number | null;
    durationMins: number | null;
  }): boolean {
    if (!meta.startTimeMs || !meta.durationMins) return false;
    const deadline =
      meta.startTimeMs +
      meta.durationMins * 60 * 1000 +
      SubmissionProcessor.LATE_SUBMIT_GRACE_MS;
    return Date.now() > deadline;
  }

  /**
   * Drain the session's staged answers from Redis into Postgres in a single
   * batched write, grading the batch once. Coalescing (one delayed job per
   * session, keyed by jobId) means this runs at most once per
   * FLUSH_DELAY_MS per session regardless of typing speed.
   */
  private async handleFlushAnswers(sessionId: string) {
    try {
      const staged = await readStashedSessionAnswers(this.redis, sessionId);
      if (Object.keys(staged).length === 0) {
        return;
      }

      const meta = await this.getSessionMeta(sessionId);
      if (!meta) return;

      // Ignore late writes for finished sessions
      if (meta.status === 'TERMINATED' || meta.status === 'COMPLETED') {
        return;
      }

      // Server-side time enforcement: a write arriving past the exam deadline
      // (plus grace) means the client timer was bypassed. Close the session
      // via the auto-submit path instead of persisting the late answers.
      if (this.isPastDeadline(meta)) {
        console.warn(
          `[SubmissionProcessor] Late write for session ${sessionId} past deadline — auto-submitting`,
        );
        return this.handleAutoSubmit({ data: { sessionId } } as Job);
      }

      const isCourseLinkedExam = Boolean(meta.linkedCourseId);

      if (isCourseLinkedExam) {
        // Course-linked exams are graded exclusively at submit time; persist
        // the answers and make sure no stale draft score survives.
        await this.prisma.$executeRaw`
          UPDATE "ExamSession"
          SET "answers" = (COALESCE("answers", '{}'::jsonb) || ${JSON.stringify(staged)}::jsonb)
                            - '_internal_marks' - '_internal_score',
              "score" = NULL,
              "updatedAt" = NOW()
          WHERE "id" = ${sessionId}
            AND "status" = 'IN_PROGRESS'
        `;
      } else if (meta.questions) {
        // Live-graded exams: read once, grade the merged view, write once.
        const currentSession = await this.prisma.examSession.findUnique({
          where: { id: sessionId },
          select: { answers: true },
        });

        const mergedAnswers = {
          ...((currentSession?.answers as any) || {}),
          ...staged,
        };

        const scoreDetails = this.examService.calculateScoreDetails(
          mergedAnswers,
          meta.questions,
        );

        await this.prisma.$executeRaw`
          UPDATE "ExamSession"
          SET "answers" = COALESCE("answers", '{}'::jsonb)
                            || ${JSON.stringify(staged)}::jsonb
                            || jsonb_build_object(
                                 '_internal_marks', ${JSON.stringify(scoreDetails.marksByQuestion)}::jsonb,
                                 '_internal_score', ${JSON.stringify({
                                   earnedMarks: scoreDetails.earnedMarks,
                                   totalMarks: scoreDetails.totalMarks,
                                   percentage: scoreDetails.percentage,
                                 })}::jsonb
                               ),
              "score" = ${scoreDetails.percentage},
              "updatedAt" = NOW()
          WHERE "id" = ${sessionId}
            AND "status" NOT IN ('COMPLETED', 'TERMINATED')
        `;

        // Question-attempt analytics, one entry per question per flush
        // (coalescing already collapsed the per-keystroke stream).
        if (meta.userId) {
          const jobs = Object.entries(staged)
            .filter(([qId]) => !qId.startsWith('_'))
            .map(([qId, ans]) => ({
              name: 'save-question-attempt',
              data: {
                userId: meta.userId,
                itemId: qId,
                sessionId,
                type: 'EXAM',
                content: ans,
                isCorrect: (scoreDetails.marksByQuestion[qId] || 0) > 0,
                score: scoreDetails.marksByQuestion[qId],
              },
            }));

          if (jobs.length > 0) {
            await this.studentAnalyticsQueue.addBulk(jobs as any);
          }
        }
      } else {
        // No grading data — persist answers only.
        await this.prisma.$executeRaw`
          UPDATE "ExamSession"
          SET "answers" = COALESCE("answers", '{}'::jsonb) || ${JSON.stringify(staged)}::jsonb,
              "updatedAt" = NOW()
          WHERE "id" = ${sessionId}
            AND "status" NOT IN ('COMPLETED', 'TERMINATED')
        `;
      }
    } catch (error) {
      console.error('[SubmissionProcessor] Failed to flush answers:', error);
      throw error; // Retry job
    }
  }

  private async handleAutoSubmit(job: Job) {
    const { sessionId } = job.data;
    console.log(`Auto-submitting session: ${sessionId}`);

    // Ensure score is calculated (in case of race conditions or missing updates)
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        answers: true,
        score: true,
        status: true,
        userId: true,
        startTime: true,
        exam: { select: { questions: true } },
      },
    });

    // Idempotency: manual submit may already have completed the session.
    if (!session || session.status === 'COMPLETED') {
      return;
    }

    const dbAnswers = (session.answers as any) || {};
    const staged = await readStashedSessionAnswers(this.redis, sessionId);
    const answers = { ...dbAnswers, ...staged };

    const scoreDetails = this.examService.calculateScoreDetails(
      answers,
      session.exam?.questions,
    );
    const finalScore = scoreDetails.percentage;

    const completedAt = new Date();
    const computedTimeTakenSec = session.startTime
      ? Math.max(
          0,
          Math.floor(
            (completedAt.getTime() - new Date(session.startTime).getTime()) /
              1000,
          ),
        )
      : null;

    const updated = await this.prisma.examSession.updateMany({
      where: { id: sessionId, status: { not: 'COMPLETED' } },
      data: {
        status: 'COMPLETED',
        endTime: completedAt,
        score: finalScore,
        answers: {
          ...answers,
          _internal_marks: scoreDetails.marksByQuestion,
          _internal_score: {
            earnedMarks: scoreDetails.earnedMarks,
            totalMarks: scoreDetails.totalMarks,
            percentage: scoreDetails.percentage,
          },
        },
        timeTakenSec: computedTimeTakenSec,
      } as any,
    });

    if (updated.count === 0) {
      return;
    }

    // Trigger analytics updates
    await this.studentAnalyticsQueue.add('update-streak', {
      userId: session.userId,
    });

    try {
      const examSession = await this.prisma.examSession.findUnique({
        where: { id: sessionId },
        select: {
          userId: true,
          score: true,
          examId: true,
          exam: { select: { orgId: true } },
        },
      });

      const orgId = examSession?.exam?.orgId || null;
      if (orgId && examSession) {
        await this.webhookService.dispatch(orgId, 'exam.completed', {
          sessionId,
          examId: examSession.examId,
          studentId: examSession.userId,
          score: Number(examSession.score || 0),
        });

        const threshold = Number(process.env.WEBHOOK_SCORE_THRESHOLD || 40);
        if (Number(examSession.score || 0) < threshold) {
          await this.webhookService.dispatch(orgId, 'score.below_threshold', {
            sessionId,
            examId: examSession.examId,
            studentId: examSession.userId,
            score: Number(examSession.score || 0),
            threshold,
          });
        }
      }
    } catch (error) {
      console.warn(
        `[SubmissionProcessor] Failed to dispatch webhook events for session ${sessionId}`,
        error,
      );
    }

    try {
      await this.examService.handleExamCompletion(sessionId);
    } catch (error: any) {
      console.warn(
        `[SubmissionProcessor] Exam completion post-processing skipped for session ${sessionId}: ${error?.message || 'unknown_error'}`,
      );
    }
  }
}
