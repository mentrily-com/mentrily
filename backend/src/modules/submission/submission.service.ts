import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ExamService } from '../exam/exam.service';
import {
  clearStashedSessionAnswers,
  readStashedSessionAnswers,
  stashSessionAnswers,
} from '../common/session-answers.util';

/** How long to coalesce answer saves before flushing to Postgres. */
const FLUSH_DELAY_MS = 2500;

@Injectable()
export class SubmissionService {
  constructor(
    @InjectQueue('submission_queue') private submissionQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly supabase: SupabaseService,
    private readonly examService: ExamService,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  /**
   * Resolve a session's owner (DB user id), cached in Redis so the hot
   * save-answer path pays one Redis GET instead of a Postgres read.
   */
  async getSessionOwner(sessionId: string): Promise<string | null> {
    const cacheKey = `session:owner:${sessionId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session) return null;

    await this.redis.set(cacheKey, session.userId, 'EX', 21600);
    return session.userId;
  }

  /**
   * Exam integrity: writes to a session (answers, section markers, final
   * submit) are only allowed by the student who owns it. Without this,
   * anyone holding a session UUID could overwrite answers or force-submit
   * another student's exam.
   */
  async assertSessionOwnership(sessionId: string, userId: string): Promise<void> {
    if (!sessionId || !userId) {
      throw new ForbiddenException('Session ownership could not be verified');
    }

    const ownerId = await this.getSessionOwner(sessionId);
    if (!ownerId) {
      throw new NotFoundException('Session not found');
    }
    if (ownerId !== userId) {
      throw new ForbiddenException('You do not own this exam session');
    }
  }

  /**
   * Stage an answer in Redis (atomic, per question) and schedule a single
   * coalesced DB flush for the session.
   *
   * Previously every save enqueued its own job, each costing multiple
   * Postgres reads/writes — with N students saving on a 1s debounce the
   * queue received N jobs/sec and the DB did ~4N queries/sec. Now the queue
   * holds at most ONE delayed flush job per session (deduplicated by jobId),
   * and each flush writes the whole accumulated batch in one statement.
   */
  async queueAnswer(sessionId: string, answer: any) {
    await stashSessionAnswers(this.redis, sessionId, answer || {});

    await this.submissionQueue.add(
      'flush_answers',
      { sessionId },
      {
        jobId: `flush:${sessionId}`,
        delay: FLUSH_DELAY_MS,
        // jobIds must leave the queue after completion so the next batch
        // for this session can schedule a fresh flush.
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }

  async scheduleAutoSubmit(sessionId: string, delay: number) {
    await this.submissionQueue.add('auto_submit', { sessionId }, { delay });
  }

  async submitExamNow(sessionId: string, finalAnswers?: Record<string, any>) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        answers: true,
        status: true,
        userId: true,
        startTime: true,
        exam: {
          select: {
            questions: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const dbAnswers =
      typeof session.answers === 'string'
        ? JSON.parse(session.answers || '{}')
        : session.answers || {};

    // Idempotency: a double-click or an auto-submit racing a manual submit
    // must not re-run scoring, webhooks, or certificate issuance.
    if (session.status === 'COMPLETED') {
      const existingScore = (dbAnswers as any)?._internal_score || {};
      return {
        status: 'submitted',
        score: Number(existingScore.percentage ?? 0),
        earnedMarks: Number(existingScore.earnedMarks ?? 0),
        totalMarks: Number(existingScore.totalMarks ?? 0),
      };
    }

    const redisAnswers = await readStashedSessionAnswers(this.redis, sessionId);

    const mergedAnswers = {
      ...dbAnswers,
      ...redisAnswers,
      ...(finalAnswers || {}),
    };
    delete (mergedAnswers as any)._final_sync;

    const scoreDetails = this.examService.calculateScoreDetails(
      mergedAnswers,
      session.exam?.questions,
    );
    const completedAt = new Date();
    const timeTakenSec = session.startTime
      ? Math.max(
          0,
          Math.floor(
            (completedAt.getTime() - new Date(session.startTime).getTime()) /
              1000,
          ),
        )
      : null;

    const answersWithMarks = {
      ...mergedAnswers,
      _internal_marks: scoreDetails.marksByQuestion,
      _internal_score: {
        earnedMarks: scoreDetails.earnedMarks,
        totalMarks: scoreDetails.totalMarks,
        percentage: scoreDetails.percentage,
      },
    };

    // Conditional write: only the request that flips the status runs the
    // completion side effects. Anyone who loses the race gets the stored
    // result via the COMPLETED branch above on retry.
    const updated = await this.prisma.examSession.updateMany({
      where: { id: sessionId, status: { not: 'COMPLETED' } },
      data: {
        answers: answersWithMarks,
        score: scoreDetails.percentage,
        status: 'COMPLETED',
        endTime: completedAt,
        timeTakenSec,
      } as any,
    });

    await clearStashedSessionAnswers(this.redis, sessionId);

    if (updated.count > 0) {
      try {
        await this.examService.handleExamCompletion(sessionId);
      } catch (error: any) {
        console.warn(
          `[SubmissionService] Exam completion post-processing skipped for session ${sessionId}: ${error?.message || 'unknown_error'}`,
        );
      }
    }

    return {
      status: 'submitted',
      score: scoreDetails.percentage,
      earnedMarks: scoreDetails.earnedMarks,
      totalMarks: scoreDetails.totalMarks,
    };
  }
}
