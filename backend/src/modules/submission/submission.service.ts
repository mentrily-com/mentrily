import {
  BadRequestException,
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
import { WebhookService } from '../webhook/webhook.service';
import {
  answerPatchError,
  clearStashedSessionAnswers,
  isServerOnlyAnswerKey,
  readCodingResults,
  readStashedSessionAnswers,
  stashSessionAnswers,
} from '../common/session-answers.util';

/** Final submit carries every answer at once; per-save cap is 500 keys. */
const MAX_FINAL_ANSWER_KEYS = 5000;

/**
 * A session counts as "live monitored" only if the proctoring SOCKET touched it
 * (heartbeat / join / socket save_answer) within this window. The client
 * heartbeats every 30s, so 90s tolerates two missed beats / a brief blip.
 * HTTP writes deliberately do NOT refresh this — otherwise a student could drop
 * the monitoring socket to evade proctoring and still save/submit over plain
 * HTTP. The final submit is gated on it, so evading the socket costs the exam.
 */
const PRESENCE_WINDOW_MS = 90_000;
/** TTL must outlive a full exam so a long absence is still measurable as a gap. */
const PRESENCE_TTL_S = 21_600; // 6h

@Injectable()
export class SubmissionService {
  constructor(
    @InjectQueue('submission_queue') private submissionQueue: Queue,
    @InjectQueue('student-analytics') private studentAnalyticsQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly supabase: SupabaseService,
    private readonly examService: ExamService,
    private readonly webhookService: WebhookService,
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

  private presenceKey(sessionId: string) {
    return `session:lastseen:${sessionId}`;
  }

  /**
   * Record SOCKET presence for a session. Called ONLY from the WebSocket
   * gateway (heartbeat / join_exam / socket save_answer) — never from an HTTP
   * handler, so this tracks live monitoring-socket connectivity specifically.
   */
  async recordPresence(sessionId: string): Promise<void> {
    if (!sessionId) return;
    await this.redis.set(
      this.presenceKey(sessionId),
      Date.now().toString(),
      'EX',
      PRESENCE_TTL_S,
    );
  }

  /** ms since the monitoring socket last touched this session, or null if never. */
  async getPresenceGapMs(sessionId: string): Promise<number | null> {
    const raw = await this.redis.get(this.presenceKey(sessionId));
    if (!raw) return null;
    const last = Number(raw);
    if (!Number.isFinite(last)) return null;
    return Date.now() - last;
  }

  /**
   * Throw unless a proctoring socket has been present within the window.
   * Enforced on the user-initiated submit path (NOT the server's deadline
   * auto-submit) so dropping the monitoring socket to evade proctoring means
   * you cannot finalize the exam without reconnecting.
   */
  async assertLiveMonitoring(sessionId: string): Promise<void> {
    const gap = await this.getPresenceGapMs(sessionId);
    if (gap === null || gap > PRESENCE_WINDOW_MS) {
      throw new ForbiddenException({
        code: 'MONITORING_OFFLINE',
        message:
          'Live proctoring connection is not active. Reconnect to the exam to submit your answers.',
      });
    }
  }

  /**
   * Exam integrity: writes to a session (answers, section markers, final
   * submit) are only allowed by the student who owns it. Without this,
   * anyone holding a session UUID could overwrite answers or force-submit
   * another student's exam.
   */
  async assertSessionOwnership(
    sessionId: string,
    userId: string,
  ): Promise<void> {
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
   * queue received N jobs/sec and the DB did ~4N queries/sec. Now the due-set
   * holds at most ONE pending flush per session (ZADD NX on FLUSH_DUE_KEY),
   * and each flush writes the whole accumulated batch in one statement.
   */
  async queueAnswer(sessionId: string, answer: any) {
    const invalid = answerPatchError(answer || {});
    if (invalid) throw new BadRequestException(invalid);
    // Stages the answer and schedules one coalesced flush (see FLUSH_DUE_KEY).
    await stashSessionAnswers(this.redis, sessionId, answer || {});
  }

  async scheduleAutoSubmit(sessionId: string, delay: number) {
    await this.submissionQueue.add('auto_submit', { sessionId }, { delay });
  }

  /**
   * Merge everything a session has into the answers to grade/persist, under
   * the same rules as the flush: unknown keys and writes into submitted
   * sections are dropped. The Redis stash is read BEFORE the DB row: a flush
   * landing in between commits a field and clears it from Redis, so reading
   * the row first could miss it entirely.
   */
  async collectFinalAnswers<T extends { answers: any; examId: string }>(
    sessionId: string,
    readSession: () => Promise<T | null>,
    finalAnswers?: Record<string, any>,
  ) {
    const [redisAnswers, codingResults] = await Promise.all([
      readStashedSessionAnswers(this.redis, sessionId),
      readCodingResults(this.redis, sessionId),
    ]);
    const session = await readSession();
    if (!session) return { session, answers: {}, exam: null };
    const raw = session.answers;
    const dbAnswers: Record<string, any> =
      typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
    const { accepted, exam } = await this.examService.filterAnswersForExam(
      session.examId,
      { ...redisAnswers, ...(finalAnswers || {}) },
      dbAnswers,
    );
    const answers: Record<string, any> = {
      ...dbAnswers,
      ...accepted,
      ...codingResults,
    };
    delete answers._final_sync;
    return { session, answers, exam };
  }

  async submitExamNow(sessionId: string, finalAnswers?: Record<string, any>) {
    // Resumed clients echo back server keys they were sent (_internal_marks,
    // _internal_metadata, ...): drop those rather than reject the submit,
    // then apply the normal patch validation to the rest.
    const clientAnswers = Object.fromEntries(
      Object.entries(finalAnswers || {}).filter(
        ([key]) => !isServerOnlyAnswerKey(key),
      ),
    );
    const invalid = answerPatchError(clientAnswers, MAX_FINAL_ANSWER_KEYS);
    if (invalid) throw new BadRequestException(invalid);

    const {
      session,
      answers: mergedAnswers,
      exam,
    } = await this.collectFinalAnswers(
      sessionId,
      () =>
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
      clientAnswers,
    );

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Idempotency: a double-click or an auto-submit racing a manual submit
    // must not re-run scoring, webhooks, or certificate issuance.
    if (session.status === 'COMPLETED') {
      return this.persistedResult(sessionId);
    }

    if (session.status === 'TERMINATED') {
      throw new ForbiddenException(
        'Exam session has been terminated due to violations and cannot be submitted.',
      );
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new ForbiddenException(
        `Exam session is not in progress (current status: ${session.status}).`,
      );
    }

    const scoreDetails = this.examService.calculateScoreDetails(
      mergedAnswers,
      exam?.questions,
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

    // Conditional write: only transition if status is still IN_PROGRESS.
    // This prevents race conditions and strictly prevents reviving TERMINATED sessions.
    const updated = await this.prisma.examSession.updateMany({
      where: { id: sessionId, status: 'IN_PROGRESS' },
      data: {
        answers: answersWithMarks,
        score: scoreDetails.percentage,
        status: 'COMPLETED',
        endTime: completedAt,
        timeTakenSec,
      } as any,
    });

    if (updated.count === 0) {
      // Lost the completion race: another request (auto-submit, or a
      // duplicate submit) completed the session between our read above and
      // this write. Return what was actually persisted rather than this
      // request's own (possibly different) computed values, and leave the
      // Redis stash untouched -- the winner did its own read/clear at its
      // own point in time, so clearing here could delete an answer staged
      // after that winner already finished.
      return this.persistedResult(sessionId);
    }

    await clearStashedSessionAnswers(this.redis, sessionId);

    // Side effects run in the background so they don't hold up the response.
    void this.runCompletionSideEffects({
      sessionId,
      examId: session.examId,
      userId: session.userId,
      orgId: exam?.orgId ?? null,
      score: scoreDetails.percentage,
    });

    return {
      status: 'submitted',
      score: scoreDetails.percentage,
      earnedMarks: scoreDetails.earnedMarks,
      totalMarks: scoreDetails.totalMarks,
    };
  }

  private async persistedResult(sessionId: string) {
    const row = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { answers: true },
    });
    const raw: any = row?.answers;
    const answers: any =
      typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
    const score = answers?._internal_score || {};
    return {
      status: 'submitted',
      score: Number(score.percentage ?? 0),
      earnedMarks: Number(score.earnedMarks ?? 0),
      totalMarks: Number(score.totalMarks ?? 0),
    };
  }

  /**
   * Everything that follows a session becoming COMPLETED, shared by manual
   * submit and the deadline auto-submit (manual submit used to skip the
   * streak update and webhooks). Never throws.
   */
  async runCompletionSideEffects(params: {
    sessionId: string;
    examId: string;
    userId: string | null;
    orgId: string | null;
    score: number | null;
  }): Promise<void> {
    const { sessionId, examId, userId, orgId } = params;
    const score = Number(params.score || 0);
    try {
      await this.studentAnalyticsQueue.add('update-streak', { userId });
    } catch (error) {
      console.warn(
        `[SubmissionService] update-streak enqueue failed for session ${sessionId}`,
        error,
      );
    }

    try {
      if (orgId) {
        await this.webhookService.dispatch(orgId, 'exam.completed', {
          sessionId,
          examId,
          studentId: userId,
          score,
        });

        const threshold = Number(process.env.WEBHOOK_SCORE_THRESHOLD || 40);
        if (score < threshold) {
          await this.webhookService.dispatch(orgId, 'score.below_threshold', {
            sessionId,
            examId,
            studentId: userId,
            score,
            threshold,
          });
        }
      }
    } catch (error) {
      console.warn(
        `[SubmissionService] Failed to dispatch webhook events for session ${sessionId}`,
        error,
      );
    }

    try {
      await this.examService.handleExamCompletion(sessionId);
    } catch (error: any) {
      console.warn(
        `[SubmissionService] Exam completion post-processing failed for session ${sessionId}: ${error?.message || 'unknown_error'}`,
      );
    }
  }
}
