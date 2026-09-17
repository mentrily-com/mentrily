import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../services/prisma/prisma.service';
import { AiCreditsService } from '../credits/ai-credits.service';
import { AiOutputError, AiUpstreamError } from '../engine/omniroute.service';
import { ChargeFn, GenerationService } from '../generation/generation.service';
import type { Blueprint } from '../schemas/generation.schemas';
import type { BuilderSection } from '../quality/normalize';
import { AI_GENERATION_QUEUE, AiJobsService } from './ai-jobs.service';
import { ContentEditService } from '../edit/content-edit.service';
import type {
  AiDraft,
  AiJobInput,
  AiJobPayload,
  AiJobProgress,
  AiJobResult,
} from './ai-job.types';

const SECTION_CONCURRENCY = 3;

class JobCancelledError extends Error {}

@Processor(AI_GENERATION_QUEUE, {
  concurrency: Number(process.env.AI_JOB_CONCURRENCY || 4),
  lockDuration: 120_000,
  stalledInterval: 300_000,
  maxStalledCount: 1,
})
export class AiGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly credits: AiCreditsService,
    private readonly generation: GenerationService,
    private readonly jobs: AiJobsService,
    private readonly edits: ContentEditService,
  ) {
    super();
  }

  async process(job: Job<AiJobPayload>): Promise<void> {
    const { jobId, reservation } = job.data;
    const record = await this.prisma.aiJob.findUnique({
      where: { id: jobId },
      select: { kind: true, status: true, input: true },
    });
    if (!record || record.status !== 'queued') {
      await this.credits.release(reservation);
      return;
    }

    const input = record.input as unknown as AiJobInput;
    const controller = new AbortController();
    let creditsUsed = 0;
    const progress: AiJobProgress = {
      stage: 'outline',
      message: 'Starting…',
      completed: 0,
      total: 0,
      creditsUsed: 0,
      sections: [],
    };
    const publish = () =>
      this.jobs.writeProgress(jobId, { ...progress, creditsUsed });

    const cancelWatch = setInterval(() => {
      void this.redis.get(this.jobs.cancelKey(jobId)).then((flag) => {
        if (flag) controller.abort(new JobCancelledError('cancelled'));
      });
    }, 1500);

    const charge: ChargeFn = async (meta, operation, outcome) => {
      creditsUsed += await this.credits.charge(
        reservation,
        meta,
        `job.${record.kind}.${operation}`,
        {
          jobId,
          success: outcome?.success ?? true,
          errorMessage: outcome?.error ?? null,
        },
      );
    };

    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: { status: 'running' },
    });

    try {
      let result: AiJobResult;
      if (record.kind === 'edit') {
        result = await this.edits.run(
          job.data.actor,
          input,
          progress,
          publish,
          charge,
          controller.signal,
        );
      } else if (record.kind === 'blueprint') {
        progress.message = 'Designing the outline…';
        await publish();
        const blueprint = await this.generation.blueprint(
          input.brief,
          input.referenceText,
          charge,
          controller.signal,
        );
        result = { type: 'blueprint', blueprint };
      } else {
        let blueprint = input.blueprint;
        if (!blueprint) {
          progress.message = 'Planning the questions…';
          await publish();
          blueprint = await this.generation.blueprint(
            input.brief,
            input.referenceText,
            charge,
            controller.signal,
          );
        }
        result = {
          type: 'draft',
          draft: await this.generateDraft(
            input,
            blueprint,
            progress,
            publish,
            charge,
            controller.signal,
          ),
        };
      }

      progress.stage = 'done';
      progress.message = 'Done';
      await publish();
      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          result: result as unknown as Prisma.InputJsonValue,
          progress: {
            ...progress,
            creditsUsed,
          } as unknown as Prisma.InputJsonValue,
          creditsUsed,
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      const cancelled =
        controller.signal.aborted ||
        error instanceof JobCancelledError ||
        (await this.redis.get(this.jobs.cancelKey(jobId))) !== null;
      const message = cancelled
        ? 'Cancelled'
        : error instanceof AiUpstreamError || error instanceof AiOutputError
          ? error instanceof AiOutputError
            ? 'The AI returned content we could not use. Please try again.'
            : error.message
          : 'Generation failed unexpectedly. Please try again.';
      if (!cancelled) {
        this.logger.error(
          `AI job ${jobId} failed: ${error instanceof Error ? error.stack || error.message : String(error)}`,
        );
      }
      progress.message = message;
      await publish();
      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: {
          status: cancelled ? 'cancelled' : 'failed',
          error: cancelled ? null : message,
          progress: {
            ...progress,
            creditsUsed,
          } as unknown as Prisma.InputJsonValue,
          creditsUsed,
          finishedAt: new Date(),
        },
      });
    } finally {
      clearInterval(cancelWatch);
      await this.credits.release(reservation);
    }
  }

  private async generateDraft(
    input: AiJobInput,
    blueprint: Blueprint,
    progress: AiJobProgress,
    publish: () => Promise<void>,
    charge: ChargeFn,
    signal: AbortSignal,
  ): Promise<AiDraft> {
    progress.stage = 'sections';
    progress.total = blueprint.sections.length;
    progress.sections = blueprint.sections.map((s) => ({
      id: s.id,
      title: s.title,
      status: 'pending',
      questionCount: s.questions.length,
    }));
    progress.message = `Writing ${blueprint.sections.length} section${blueprint.sections.length === 1 ? '' : 's'}…`;
    await publish();

    const results = new Array<BuilderSection | null>(
      blueprint.sections.length,
    ).fill(null);
    let cursor = 0;

    const worker = async () => {
      while (cursor < blueprint.sections.length) {
        const index = cursor++;
        const section = blueprint.sections[index];
        if (signal.aborted) throw new JobCancelledError('cancelled');
        progress.sections[index].status = 'running';
        await publish();
        try {
          const generated = await this.generation.generateSection(
            {
              brief: input.brief,
              title: blueprint.title,
              description: blueprint.description,
              section,
              referenceText: input.referenceText,
              tier: input.tier,
              verifyCoding: input.verifyCoding,
              signal,
            },
            charge,
          );
          results[index] = generated;
          progress.sections[index] = {
            ...progress.sections[index],
            status: 'done',
            preview: generated.questions.map((q) => ({
              title: q.title,
              type: q.type,
              status: q.aiMeta.status,
            })),
          };
        } catch (error) {
          if (signal.aborted) throw new JobCancelledError('cancelled');
          progress.sections[index] = {
            ...progress.sections[index],
            status: 'failed',
            error:
              error instanceof AiUpstreamError
                ? error.message
                : 'This section could not be generated.',
          };
        }
        progress.completed += 1;
        progress.message = `Wrote ${progress.completed} of ${progress.total} sections`;
        await publish();
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(SECTION_CONCURRENCY, blueprint.sections.length) },
        worker,
      ),
    );

    const sections = results.filter((s): s is BuilderSection => s !== null);
    if (!sections.length) {
      throw new AiUpstreamError(
        'None of the sections could be generated. Please try again.',
        null,
        {
          tier: input.tier,
          combo: '',
          provider: '',
          resolvedModel: '',
          costUsd: null,
          latencyMs: 0,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            totalTokens: 0,
          },
        },
      );
    }

    let summary: string | undefined;
    if (blueprint.kind === 'course' && !signal.aborted) {
      progress.stage = 'summary';
      progress.message = 'Writing the course summary…';
      await publish();
      summary = await this.generation
        .courseSummary(blueprint.title, sections, charge, signal)
        .catch(() => undefined);
    }

    const questions = sections.flatMap((s) => s.questions);
    return {
      kind: blueprint.kind,
      title: blueprint.title,
      description: blueprint.description,
      summary,
      sections,
      totalMarks: questions.reduce((acc, q) => acc + q.marks, 0),
      stats: {
        questions: questions.length,
        verified: questions.filter((q) => q.aiMeta.status === 'verified')
          .length,
        needsReview: questions.filter((q) => q.aiMeta.status === 'needs_review')
          .length,
      },
    };
  }
}
