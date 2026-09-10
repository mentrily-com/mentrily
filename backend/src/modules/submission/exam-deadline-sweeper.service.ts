import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { SupabaseService } from '../../services/supabase/supabase.service';

/**
 * Safety net for sessions that go silent past their deadline. Exam-deadline
 * enforcement is otherwise entirely reactive: the client timer auto-submits
 * (evadable via dev tools), and the server only closes a session when a late
 * write happens to arrive after the deadline (SubmissionProcessor.
 * isPastDeadline, triggered from handleFlushAnswers). A crashed browser, a
 * closed tab, or a laptop that goes to sleep before time runs out means no
 * further write ever arrives — nothing was proactively sweeping expired
 * IN_PROGRESS sessions, so they stayed open indefinitely: never scored,
 * never counted toward maxAttempts, and resumable (with a nonsensical
 * timeTakenSec) if the student ever reopened the link.
 *
 * This enqueues the exact same 'auto_submit' job SubmissionProcessor already
 * handles idempotently (guarded by `status: { not: 'COMPLETED' }`), so it
 * adds no new completion logic -- it only makes sure that job eventually
 * gets scheduled for sessions nothing else touches again.
 */
@Injectable()
export class ExamDeadlineSweeperService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ExamDeadlineSweeperService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly tickMs = 5 * 60 * 1000;
  private readonly lockTtlMs = 4 * 60 * 1000;
  /** Matches SubmissionProcessor.LATE_SUBMIT_GRACE_MS. */
  private readonly graceSeconds = 120;
  private readonly batchSize = 200;
  private readonly enabled =
    String(process.env.DISABLE_EXAM_DEADLINE_SWEEP || 'false').toLowerCase() !==
    'true';
  private sweeping = false;

  constructor(
    private readonly supabase: SupabaseService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue('submission_queue') private readonly submissionQueue: Queue,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log(
        'Exam deadline sweeper disabled (DISABLE_EXAM_DEADLINE_SWEEP=true)',
      );
      return;
    }

    this.timer = setInterval(() => {
      this.sweep().catch((error) => {
        this.logger.error(`Deadline sweep failed: ${error?.message || error}`);
      });
    }, this.tickMs);

    this.logger.log('Exam deadline sweeper started');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sweep() {
    if (this.sweeping) return; // in-process guard against overlapping ticks
    const lockKey = 'exam:deadline-sweep:lock';
    const gotLock = await this.redis.set(
      lockKey,
      '1',
      'PX',
      this.lockTtlMs,
      'NX',
    );
    if (gotLock !== 'OK') return; // another instance is sweeping

    this.sweeping = true;
    try {
      const expired: Array<{ id: string }> = await this.prisma.$queryRaw`
        SELECT es.id
        FROM "ExamSession" es
        JOIN "Exam" e ON e.id = es."examId"
        WHERE es.status = 'IN_PROGRESS'
          AND es."startTime" IS NOT NULL
          AND e.duration IS NOT NULL
          AND es."startTime"
            + ((e.duration * 60) + ${this.graceSeconds}) * INTERVAL '1 second'
            < NOW()
        LIMIT ${this.batchSize}
      `;

      if (expired.length === 0) return;

      for (const { id } of expired) {
        await this.submissionQueue.add(
          'auto_submit',
          { sessionId: id },
          {
            // Coalesce with any auto_submit already scheduled/queued for
            // this session (e.g. from a just-arrived late write).
            jobId: `auto-submit-${id}`,
            removeOnComplete: true,
            removeOnFail: 50,
          },
        );
      }

      this.logger.log(
        `Enqueued auto-submit for ${expired.length} session(s) past deadline`,
      );
    } finally {
      this.sweeping = false;
    }
  }
}
