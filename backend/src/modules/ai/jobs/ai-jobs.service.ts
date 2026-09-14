import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../services/prisma/prisma.service';
import { getRequiredPlanForFeature } from '../../../config/plan-limits';
import type { AiActor } from '../engine/ai-types';
import { AiPlanContext, AiPlanService } from '../credits/ai-plan.service';
import { AiCreditsService } from '../credits/ai-credits.service';
import { ContentContextService } from '../context/content-context.service';
import { GenerationService } from '../generation/generation.service';
import {
  Blueprint,
  COURSE_TYPES,
  EXAM_TYPES,
  TYPE_FEATURE,
} from '../schemas/generation.schemas';
import { newId } from '../quality/normalize';
import type { BriefInput } from '../prompts/generation.prompts';
import { CreateJobInput, createJobSchema } from './job-input.schemas';
import type {
  AiJobInput,
  AiJobKind,
  AiJobPayload,
  AiJobProgress,
} from './ai-job.types';

export const AI_GENERATION_QUEUE = 'ai-generation';
const PROGRESS_TTL_SECONDS = 24 * 3600;

@Injectable()
export class AiJobsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(AI_GENERATION_QUEUE) private readonly queue: Queue,
    private readonly plans: AiPlanService,
    private readonly credits: AiCreditsService,
    private readonly context: ContentContextService,
    private readonly generation: GenerationService,
  ) {}

  progressKey(jobId: string) {
    return `ai:job:${jobId}:progress`;
  }

  cancelKey(jobId: string) {
    return `ai:job:${jobId}:cancel`;
  }

  parseInput(body: unknown): CreateJobInput {
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_AI_REQUEST',
        message: parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      });
    }
    return parsed.data;
  }

  /** Enforces the plan's type gates and size limits on a brief. */
  assertBriefAllowed(ctx: AiPlanContext, brief: BriefInput, kind: AiJobKind) {
    const kindTypes = brief.kind === 'exam' ? EXAM_TYPES : COURSE_TYPES;
    const invalid = brief.types.filter((t) => !kindTypes.includes(t));
    if (invalid.length) {
      throw new BadRequestException(
        `${invalid.join(', ')} ${invalid.length > 1 ? 'are' : 'is'} not available for ${brief.kind}s.`,
      );
    }
    for (const type of brief.types) {
      const feature = TYPE_FEATURE[type];
      if (feature && !ctx.unlimited && ctx.features[feature] !== true) {
        throw new ForbiddenException({
          code: 'PLAN_FEATURE_REQUIRED',
          feature,
          requiredPlan: getRequiredPlanForFeature(feature),
          upgradeUrl: '/dashboard/creator/billing',
          message: `${type} questions aren't included in your plan.`,
        });
      }
    }
    const maxQuestions = this.plans.limit(ctx, 'aiMaxQuestionsPerGeneration');
    const total =
      kind === 'quiz'
        ? brief.questionsPerSection
        : brief.sections * brief.questionsPerSection;
    if (maxQuestions >= 0 && total > maxQuestions) {
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        resource: 'aiMaxQuestionsPerGeneration',
        current: total,
        limit: maxQuestions,
        upgradeUrl: '/dashboard/creator/billing',
        message: `Your plan can generate up to ${maxQuestions} questions at a time (you asked for ${total}).`,
      });
    }
  }

  assertReferencesAllowed(ctx: AiPlanContext, count: number) {
    const max = this.plans.limit(ctx, 'aiMaxReferences');
    if (max >= 0 && count > max) {
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        resource: 'aiMaxReferences',
        current: count,
        limit: max,
        upgradeUrl: '/dashboard/creator/billing',
        message:
          max === 0
            ? 'Using your courses as AI references is available on the Starter plan and above.'
            : `Your plan allows ${max} reference${max === 1 ? '' : 's'} per request.`,
      });
    }
  }

  async create(actor: AiActor, body: unknown) {
    const input = this.parseInput(body);
    const ctx = await this.plans.resolve(actor);
    this.plans.assertFeature(ctx, 'aiStudio');
    if (input.kind === 'generate') this.plans.assertFeature(ctx, 'aiExams');

    const brief: BriefInput =
      input.kind === 'quiz' ? { ...input.brief, sections: 1 } : input.brief;
    this.assertBriefAllowed(ctx, brief, input.kind);
    this.assertReferencesAllowed(ctx, input.references.length);

    let blueprint: Blueprint | undefined;
    if (input.kind === 'generate') {
      if (!input.blueprint) {
        throw new BadRequestException('An approved outline is required.');
      }
      blueprint = this.fromClientBlueprint(brief, input.blueprint);
      const total = blueprint.sections.reduce(
        (acc, s) => acc + s.questions.length,
        0,
      );
      const maxQuestions = this.plans.limit(ctx, 'aiMaxQuestionsPerGeneration');
      if (maxQuestions >= 0 && total > maxQuestions) {
        throw new ForbiddenException({
          code: 'QUOTA_EXCEEDED',
          resource: 'aiMaxQuestionsPerGeneration',
          current: total,
          limit: maxQuestions,
          upgradeUrl: '/dashboard/creator/billing',
          message: `Your plan can generate up to ${maxQuestions} questions at a time (this outline has ${total}).`,
        });
      }
    }

    await this.credits.assertJobSlot(actor, ctx);

    const referenceText = input.references.length
      ? await this.context.referenceText(actor, input.references)
      : undefined;
    const tier = this.plans.effectiveTier(
      ctx,
      input.quality === 'pro' ? 'pro' : 'standard',
    );
    const refChars = referenceText?.length ?? 0;

    const estimate =
      input.kind === 'blueprint'
        ? this.generation.estimateBlueprint(brief, refChars)
        : input.kind === 'generate'
          ? this.generation.estimateGeneration(blueprint!, tier, refChars)
          : this.generation.estimateBlueprint(brief, refChars) +
            this.generation.estimateGeneration(
              this.syntheticBlueprint(brief),
              tier,
              refChars,
            );

    const reservation = await this.credits.reserve(actor, ctx, estimate);

    const jobInput: AiJobInput = {
      brief,
      blueprint,
      references: input.references,
      referenceText,
      tier,
      verifyCoding: brief.types.includes('Coding'),
      parentJobId: input.parentJobId,
    };

    let jobId: string;
    try {
      const job = await this.prisma.aiJob.create({
        data: {
          orgId: actor.orgId,
          userId: actor.userId,
          kind: input.kind,
          status: 'queued',
          input: jobInput as unknown as Prisma.InputJsonValue,
          creditsReserved: reservation.amount,
          conversationId: input.conversationId ?? null,
        },
        select: { id: true },
      });
      jobId = job.id;
      const payload: AiJobPayload = { jobId, actor, reservation };
      await this.writeProgress(jobId, {
        stage: 'queued',
        message: 'Waiting to start…',
        completed: 0,
        total: blueprint?.sections.length ?? 0,
        creditsUsed: 0,
        sections: [],
      });
      await this.queue.add('run', payload, {
        jobId,
        attempts: 1,
        removeOnComplete: 200,
        removeOnFail: 200,
      });
    } catch (error) {
      await this.credits.release(reservation);
      throw error;
    }

    return { jobId, kind: input.kind, estimate: reservation.amount, tier };
  }

  private fromClientBlueprint(
    brief: BriefInput,
    raw: NonNullable<CreateJobInput['blueprint']>,
  ): Blueprint {
    const fallback = brief.types[0];
    return {
      kind: brief.kind,
      title: raw.title,
      description: raw.description,
      sections: raw.sections.map((section) => ({
        id: section.id || newId('sec'),
        title: section.title,
        summary: section.summary,
        questions: section.questions.map((q) =>
          this.generation.normalizeBlueprintQuestion(q, brief.types, fallback),
        ),
      })),
    };
  }

  /** Shape used only to estimate a quiz before its outline exists. */
  private syntheticBlueprint(brief: BriefInput): Blueprint {
    return {
      kind: brief.kind,
      title: brief.topic,
      description: '',
      sections: [
        {
          id: 'estimate',
          title: 'estimate',
          summary: '',
          questions: Array.from(
            { length: brief.questionsPerSection },
            (_, i) => ({
              id: `e${i}`,
              type: brief.types[i % brief.types.length],
              title: '',
              intent: '',
              difficulty: 'Medium' as const,
              marks: 1,
            }),
          ),
        },
      ],
    };
  }

  async writeProgress(jobId: string, progress: AiJobProgress) {
    await this.redis.set(
      this.progressKey(jobId),
      JSON.stringify(progress),
      'EX',
      PROGRESS_TTL_SECONDS,
    );
  }

  async get(actor: AiActor, jobId: string) {
    const job = await this.prisma.aiJob.findFirst({
      where: { id: jobId, userId: actor.userId },
      select: {
        id: true,
        kind: true,
        status: true,
        progress: true,
        result: true,
        error: true,
        creditsReserved: true,
        creditsUsed: true,
        createdAt: true,
        finishedAt: true,
        input: true,
      },
    });
    if (!job) throw new NotFoundException('Generation not found');

    let progress = job.progress as AiJobProgress | null;
    if (job.status === 'queued' || job.status === 'running') {
      const live = await this.redis.get(this.progressKey(job.id));
      if (live) progress = JSON.parse(live) as AiJobProgress;
    }
    const input = job.input as unknown as AiJobInput;
    return {
      id: job.id,
      kind: job.kind,
      status: job.status,
      progress,
      result: job.result,
      error: job.error,
      creditsReserved: job.creditsReserved,
      creditsUsed: job.creditsUsed,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      brief: input?.brief,
      references: input?.references ?? [],
    };
  }

  async cancel(actor: AiActor, jobId: string) {
    const job = await this.prisma.aiJob.findFirst({
      where: { id: jobId, userId: actor.userId },
      select: { id: true, status: true },
    });
    if (!job) throw new NotFoundException('Generation not found');
    if (job.status !== 'queued' && job.status !== 'running') {
      return { id: job.id, status: job.status };
    }
    await this.redis.set(this.cancelKey(job.id), '1', 'EX', 3600);
    if (job.status === 'queued') {
      const queued = await this.queue.getJob(job.id);
      if (queued) {
        await this.credits.release((queued.data as AiJobPayload).reservation);
        await queued.remove().catch(() => undefined);
      }
      await this.prisma.aiJob.updateMany({
        where: { id: job.id, status: 'queued' },
        data: { status: 'cancelled', finishedAt: new Date() },
      });
    }
    return { id: job.id, status: 'cancelled' };
  }
}
