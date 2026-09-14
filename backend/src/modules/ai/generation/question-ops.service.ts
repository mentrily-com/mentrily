import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { AiActor, AiTier } from '../engine/ai-types';
import { AiPlanService } from '../credits/ai-plan.service';
import { AiCreditsService } from '../credits/ai-credits.service';
import { ContentContextService } from '../context/content-context.service';
import { AiJobsService } from '../jobs/ai-jobs.service';
import { referencesSchema } from '../jobs/job-input.schemas';
import { QUESTION_OPS, QuestionOp } from '../prompts/generation.prompts';
import {
  COURSE_TYPES,
  EXAM_TYPES,
  QUESTION_TYPES,
} from '../schemas/generation.schemas';
import type { BuilderQuestion } from '../quality/normalize';
import { CodingVerifierService } from '../quality/coding-verifier.service';
import { GenerationService } from './generation.service';

const questionOpSchema = z.object({
  op: z.enum(Object.keys(QUESTION_OPS) as [QuestionOp, ...QuestionOp[]]),
  kind: z.enum(['course', 'exam']),
  instruction: z.string().trim().max(1000).optional(),
  references: referencesSchema,
  question: z
    .object({
      id: z.string().max(100),
      type: z.enum(QUESTION_TYPES),
      title: z.string().max(300),
      problemStatement: z.string().max(60_000).default(''),
      marks: z.number().min(0).max(1000).default(1),
      difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
      tags: z.array(z.string().max(60)).max(20).default([]),
    })
    .passthrough(),
});

// Code-producing operations need the stronger tier to be worth running.
const OP_TIER: Partial<Record<QuestionOp, AiTier>> = {
  testcases: 'standard',
  solution: 'standard',
  regenerate: 'standard',
};

@Injectable()
export class QuestionOpsService {
  constructor(
    private readonly plans: AiPlanService,
    private readonly credits: AiCreditsService,
    private readonly context: ContentContextService,
    private readonly generation: GenerationService,
    private readonly verifier: CodingVerifierService,
    private readonly jobs: AiJobsService,
  ) {}

  async run(actor: AiActor, body: unknown) {
    const parsed = questionOpSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_AI_REQUEST',
        message: parsed.error.issues[0]?.message ?? 'Invalid request',
      });
    }
    const input = parsed.data;
    const question = input.question as unknown as BuilderQuestion;
    const allowed = input.kind === 'exam' ? EXAM_TYPES : COURSE_TYPES;
    if (!allowed.includes(question.type)) {
      throw new BadRequestException(
        `AI actions aren't available for ${question.type} items.`,
      );
    }
    if (
      (input.op === 'distractors' &&
        question.type !== 'MCQ' &&
        question.type !== 'MultiSelect') ||
      ((input.op === 'testcases' || input.op === 'solution') &&
        question.type !== 'Coding')
    ) {
      throw new BadRequestException(
        `"${input.op}" doesn't apply to ${question.type} questions.`,
      );
    }

    const ctx = await this.plans.resolve(actor);
    this.plans.assertFeature(ctx, 'aiStudio');
    this.jobs.assertBriefAllowed(
      ctx,
      {
        kind: input.kind,
        topic: question.title,
        sections: 1,
        questionsPerSection: 1,
        types: [question.type],
        difficulty: question.difficulty,
      },
      'quiz',
    );
    this.jobs.assertReferencesAllowed(ctx, input.references.length);

    const tier = this.plans.effectiveTier(ctx, OP_TIER[input.op] ?? 'lite');
    const reservation = await this.credits.reserve(
      actor,
      ctx,
      tier === 'lite' ? 10 : 30,
    );
    let creditsUsed = 0;
    try {
      const referenceText = input.references.length
        ? await this.context.referenceText(actor, input.references)
        : undefined;
      let result = await this.generation.runQuestionOp(
        {
          op: input.op,
          question,
          instruction: input.instruction,
          context: referenceText?.slice(0, 4000),
          tier,
          allowedTypes: [question.type],
        },
        async (meta, operation, outcome) => {
          creditsUsed += await this.credits.charge(
            reservation,
            meta,
            operation,
            {
              success: outcome?.success ?? true,
              errorMessage: outcome?.error ?? null,
            },
          );
        },
      );
      if (result.type === 'Coding' && !result.aiMeta.issues.length) {
        const verification = await this.verifier.verify(result);
        result = {
          ...result,
          aiMeta:
            verification.status === 'verified'
              ? { status: 'verified', issues: [] }
              : verification.status === 'unavailable'
                ? { status: 'unverified', issues: ['code runner unavailable'] }
                : { status: 'needs_review', issues: verification.failures },
        };
      }
      return { question: result, creditsUsed, tier };
    } finally {
      await this.credits.release(reservation);
    }
  }
}
