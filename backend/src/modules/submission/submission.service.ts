import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ExamService } from '../exam/exam.service';

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

  async queueAnswer(sessionId: string, answer: any) {
    // Add to write-behind queue
    await this.submissionQueue.add('save_answer', {
      sessionId,
      answer, // This can be a single answer or a map of answers
      timestamp: new Date(),
    });
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

    let dbAnswers =
      typeof session.answers === 'string'
        ? JSON.parse(session.answers || '{}')
        : session.answers || {};

    let redisAnswers = {};
    const redisKey = `session:answers:${sessionId}`;
    const cachedAnswers = await this.redis.get(redisKey);
    if (cachedAnswers) {
      try {
        redisAnswers = JSON.parse(cachedAnswers);
      } catch {
        redisAnswers = {};
      }
    }

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

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        answers: answersWithMarks,
        score: scoreDetails.percentage,
        status: 'COMPLETED',
        endTime: completedAt,
        timeTakenSec,
      } as any,
    });
    await this.redis.del(redisKey);

    try {
      await this.examService.handleExamCompletion(sessionId);
    } catch (error: any) {
      console.warn(
        `[SubmissionService] Exam completion post-processing skipped for session ${sessionId}: ${error?.message || 'unknown_error'}`,
      );
    }

    return {
      status: 'submitted',
      score: scoreDetails.percentage,
      earnedMarks: scoreDetails.earnedMarks,
      totalMarks: scoreDetails.totalMarks,
    };
  }
}
