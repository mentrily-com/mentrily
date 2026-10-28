import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { ExamService } from '../exam/exam.service';
import { SubmissionService } from './submission.service';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  clearFlushedSessionAnswerFields,
  clearStashedSessionAnswers,
  FLUSH_DUE_KEY,
  popDueSessionFlushes,
  readStashedForFlush,
  scheduleSessionFlush,
  stashSessionAnswers,
} from '../common/session-answers.util';

// Each flush holds a DB connection for a read + a write; keep the default
// well under the pool size. SUBMISSION_PROCESSOR_CONCURRENCY overrides.
const FLUSH_CONCURRENCY = Number(
  process.env.SUBMISSION_PROCESSOR_CONCURRENCY || 4,
);

const RELEASE_LOCK = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

@Processor('submission_queue', {
  // Optimize for serverless Redis (reduce command usage)
  stalledInterval: 300000, // 5 minutes
  maxStalledCount: 3,
  lockDuration: 60000, // 60s
  // Flush jobs are IO-bound (1 read + 1 write); with coalescing there is at
  // most one job per active session. Tune concurrency to avoid exhausting DB connection pool.
  concurrency: FLUSH_CONCURRENCY,
})
export class SubmissionProcessor
  extends WorkerHost
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly supabase: SupabaseService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('student-analytics') private studentAnalyticsQueue: Queue,
    private examService: ExamService,
    private submissionService: SubmissionService,
  ) {
    super();
  }

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private static readonly FLUSH_TICK_MS = 250;
  private static readonly FLUSH_BATCH = 200;
  private static readonly FLUSH_MAX_ATTEMPTS = 5;
  private readonly flushConcurrency = FLUSH_CONCURRENCY;
  private flushTimer?: NodeJS.Timeout;
  private flushing = false;

  onModuleInit() {
    this.flushTimer = setInterval(
      () => void this.drainDueFlushes(),
      SubmissionProcessor.FLUSH_TICK_MS,
    );
  }

  onModuleDestroy() {
    clearInterval(this.flushTimer);
  }

  /**
   * Drains FLUSH_DUE_KEY (filled by queueAnswer and go-connector). Replaces
   * one delayed BullMQ job per session: a ZADD is one cheap command where a
   * BullMQ add was a multi-key Lua script plus job hashes, on every save.
   */
  private async drainDueFlushes(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const due = await popDueSessionFlushes(
        this.redis,
        SubmissionProcessor.FLUSH_BATCH,
      );
      for (let i = 0; i < due.length; i += this.flushConcurrency) {
        // allSettled: one failure must not abandon the rest of the popped batch.
        await Promise.allSettled(
          due
            .slice(i, i + this.flushConcurrency)
            .map((sessionId) => this.flushWithRetry(sessionId)),
        );
      }
    } catch (error) {
      console.error('[SubmissionProcessor] Flush drain failed:', error);
    } finally {
      this.flushing = false;
    }
  }

  private async flushWithRetry(sessionId: string): Promise<void> {
    const attemptsKey = `submission:flush:attempts:${sessionId}`;
    try {
      await this.handleFlushAnswers(sessionId);
      await this.redis.del(attemptsKey);
    } catch {
      // Staged answers stay in Redis either way; submit still reads them.
      try {
        const attempts = await this.redis.incr(attemptsKey);
        await this.redis.expire(attemptsKey, 3600);
        if (attempts < SubmissionProcessor.FLUSH_MAX_ATTEMPTS) {
          await scheduleSessionFlush(
            this.redis,
            sessionId,
            1000 * 2 ** attempts,
          );
        }
      } catch (error) {
        // Bookkeeping failed too: still re-queue, or the session is never
        // flushed again (it was already popped from the due set).
        await this.redis
          .zadd(FLUSH_DUE_KEY, 'NX', Date.now() + 30_000, sessionId)
          .catch(() => undefined);
        console.error(
          `[SubmissionProcessor] Flush retry bookkeeping failed for ${sessionId}:`,
          error,
        );
      }
    }
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
    examId: string;
    userId: string | null;
    status: string | null;
    linkedCourseId: string | null;
    startTimeMs: number | null;
    durationMins: number | null;
  } | null> {
    const sessionCacheKey = `session:meta:${sessionId}`;
    const cached = await this.redis.get(sessionCacheKey);
    if (cached) {
      try {
        const meta = JSON.parse(cached);
        // v2 = questions no longer embedded; older entries are rebuilt below.
        if (meta.v === 2 && meta.examId) {
          // Duration comes from the 60s exam memo, not this 3h cache, so a
          // teacher extending the exam mid-way takes effect within a minute.
          const exam = await this.examService.getExamGradingData(meta.examId);
          return {
            examId: meta.examId,
            userId: meta.userId || null,
            status: meta.status || null,
            linkedCourseId: meta.linkedCourseId || null,
            startTimeMs: meta.startTimeMs ?? null,
            durationMins: exam ? exam.duration : (meta.durationMins ?? null),
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
        examId: true,
        exam: {
          select: { linkedCourseId: true, duration: true },
        },
      },
    });

    if (!session) return null;

    const meta = {
      examId: session.examId,
      userId: session.userId,
      status: session.status,
      linkedCourseId: session.exam?.linkedCourseId || null,
      startTimeMs: session.startTime
        ? new Date(session.startTime).getTime()
        : null,
      durationMins: session.exam?.duration ?? null,
    };

    await this.redis.set(
      sessionCacheKey,
      JSON.stringify({
        v: 2,
        examId: session.examId,
        userId: meta.userId,
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
    // Two instances (or a retry racing the next tick) must not flush the same
    // session at once: both would grade and write, and analytics double-count.
    const lockKey = `flush:lock:${sessionId}`;
    const token = randomBytes(8).toString('hex');
    if ((await this.redis.set(lockKey, token, 'PX', 30_000, 'NX')) !== 'OK') {
      await scheduleSessionFlush(this.redis, sessionId, 1000);
      return;
    }
    try {
      return await this.flushLocked(sessionId);
    } finally {
      await this.redis
        .eval(RELEASE_LOCK, 1, lockKey, token)
        .catch(() => undefined);
    }
  }

  private async flushLocked(sessionId: string) {
    try {
      const { answers: stagedRaw, raw } = await readStashedForFlush(
        this.redis,
        sessionId,
      );
      if (Object.keys(stagedRaw).length === 0) {
        return;
      }

      const meta = await this.getSessionMeta(sessionId);
      if (!meta) return;

      const currentSession = await this.prisma.examSession.findUnique({
        where: { id: sessionId },
        select: { answers: true },
      });
      const storedAnswers = (currentSession?.answers as any) || {};

      // Unknown keys and writes into already-submitted sections never reach
      // Postgres. Only accepted fields are cleared from the stash: a field
      // dropped here (e.g. against a stale question list) stays in Redis,
      // where final submit filters it again.
      const { accepted: staged, exam } =
        await this.examService.filterAnswersForExam(
          meta.examId,
          stagedRaw,
          storedAnswers,
        );
      const questions = exam?.questions;
      const flushedRaw: Record<string, string> = {};
      for (const key of Object.keys(staged)) {
        if (key in raw) flushedRaw[key] = raw[key];
      }

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
              "updatedAt" = (NOW() AT TIME ZONE 'UTC')
          WHERE "id" = ${sessionId}
            AND "status" = 'IN_PROGRESS'
        `;
        await clearFlushedSessionAnswerFields(
          this.redis,
          sessionId,
          flushedRaw,
        );
      } else if (questions) {
        // Live-graded exams: grade the merged view, write once.
        const mergedAnswers = { ...storedAnswers, ...staged };

        const scoreDetails = this.examService.calculateScoreDetails(
          mergedAnswers,
          questions,
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
              "updatedAt" = (NOW() AT TIME ZONE 'UTC')
          WHERE "id" = ${sessionId}
            AND "status" NOT IN ('COMPLETED', 'TERMINATED')
        `;
        await clearFlushedSessionAnswerFields(
          this.redis,
          sessionId,
          flushedRaw,
        );

        // Question-attempt analytics, one entry per question per flush
        // (coalescing already collapsed the per-keystroke stream). Reading
        // `staged` here (not a fresh Redis read) is deliberate: it must
        // match exactly what was just cleared above, or a field could be
        // both cleared AND miss its analytics job (or double-count it) on a
        // future flush.
        //
        // Idempotency: a re-save of the exact same answer (re-visiting an
        // already-submitted question without changing it, a stray resave,
        // etc.) must NOT create another QuestionAttempt row or award XP
        // again — handleSaveQuestionAttempt does a plain create() + XP
        // increment with no dedup of its own, so skip anything unchanged
        // from what was already persisted before this flush.
        if (meta.userId) {
          const previousAnswers = storedAnswers;
          const jobs = Object.entries(staged)
            .filter(([qId]) => !qId.startsWith('_'))
            .filter(
              ([qId, ans]) =>
                JSON.stringify(previousAnswers[qId]) !== JSON.stringify(ans),
            )
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
              "updatedAt" = (NOW() AT TIME ZONE 'UTC')
          WHERE "id" = ${sessionId}
            AND "status" NOT IN ('COMPLETED', 'TERMINATED')
        `;
        await clearFlushedSessionAnswerFields(
          this.redis,
          sessionId,
          flushedRaw,
        );
      }
    } catch (error) {
      console.error('[SubmissionProcessor] Failed to flush answers:', error);
      throw error; // Retry job
    }
  }

  private async handleAutoSubmit(job: Job) {
    const { sessionId } = job.data;
    console.log(`Auto-submitting session: ${sessionId}`);

    // Same merge + validation as manual submit (stash read before the row).
    const { session, answers, exam } =
      await this.submissionService.collectFinalAnswers(sessionId, () =>
        this.prisma.examSession.findUnique({
          where: { id: sessionId },
          select: {
            answers: true,
            status: true,
            userId: true,
            startTime: true,
            examId: true,
          },
        }),
      );

    // Idempotency: only IN_PROGRESS sessions can be auto-submitted.
    // TERMINATED sessions (e.g. cheating disqualification) must never be completed.
    if (!session || session.status !== 'IN_PROGRESS') {
      return;
    }

    const scoreDetails = this.examService.calculateScoreDetails(
      answers,
      exam?.questions,
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
      where: { id: sessionId, status: 'IN_PROGRESS' },
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

    await clearStashedSessionAnswers(this.redis, sessionId);

    await this.submissionService.runCompletionSideEffects({
      sessionId,
      examId: session.examId,
      userId: session.userId,
      orgId: exam?.orgId ?? null,
      score: finalScore,
    });
  }
}
