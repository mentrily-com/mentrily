import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  AiOutputError,
  AiUpstreamError,
  OmniRouteService,
  type AiCallMeta,
} from '../engine/omniroute.service';
import { AiTier, estimateCredits } from '../engine/ai-types';
import {
  Blueprint,
  BlueprintQuestion,
  BlueprintSection,
  QuestionType,
  RawGeneratedQuestion,
  blueprintSchema,
  buildSectionSchema,
  summarySchema,
} from '../schemas/generation.schemas';
import {
  BLUEPRINT_SYSTEM,
  BriefInput,
  QUESTION_OP_SYSTEM,
  QuestionOp,
  SECTION_SYSTEM,
  SUMMARY_SYSTEM,
  blueprintPrompt,
  questionOpPrompt,
  sectionPrompt,
} from '../prompts/generation.prompts';
import {
  BuilderQuestion,
  BuilderSection,
  GeneratedQuestion,
  coerceDifficulty,
  coerceMarks,
  coerceType,
  newId,
  toBuilderQuestion,
} from '../quality/normalize';
import { validateQuestion } from '../quality/validators';
import { CodingVerifierService } from '../quality/coding-verifier.service';
import { plainText, sanitizeRichText } from '../quality/sanitize';

export type ChargeFn = (
  meta: AiCallMeta,
  operation: string,
  outcome?: { success: boolean; error?: string },
) => Promise<void>;

// Typical output per item, used for credit estimates. Calibrated against the
// AiUsage ledger (a Reading + MCQ + Coding section averages ~1.4k tokens).
const OUTPUT_TOKENS_TYPICAL: Record<QuestionType, number> = {
  MCQ: 200,
  MultiSelect: 230,
  Coding: 700,
  Web: 600,
  Reading: 500,
  Notebook: 400,
};
// Generous per-item output ceiling so long items are never truncated. Only
// bounds maxOutputTokens; usage is always charged on actual tokens.
const OUTPUT_TOKENS_MAX: Record<QuestionType, number> = {
  MCQ: 900,
  MultiSelect: 1000,
  Coding: 3600,
  Web: 2600,
  Reading: 3000,
  Notebook: 1800,
};
const MAX_REPAIRS_PER_SECTION = 3;
const SECTION_TIMEOUT_MS = 150_000;

export interface GenerateSectionInput {
  brief: BriefInput;
  title: string;
  description: string;
  section: BlueprintSection;
  referenceText?: string;
  tier: AiTier;
  verifyCoding: boolean;
  signal?: AbortSignal;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly omni: OmniRouteService,
    private readonly verifier: CodingVerifierService,
  ) {}

  // ── Estimates (credits reserved before a job starts) ─────────────────────

  estimateBlueprint(brief: BriefInput, referenceChars = 0): number {
    const items = brief.sections * brief.questionsPerSection;
    return estimateCredits(
      'lite',
      700 + Math.ceil(referenceChars / 4),
      200 + items * 35,
    );
  }

  estimateGeneration(
    blueprint: Blueprint,
    tier: AiTier,
    referenceChars = 0,
  ): number {
    let total = 0;
    for (const section of blueprint.sections) {
      const output = section.questions.reduce(
        (acc, q) => acc + OUTPUT_TOKENS_TYPICAL[q.type],
        0,
      );
      total += estimateCredits(
        tier,
        1200 + Math.ceil(referenceChars / 4) + section.questions.length * 60,
        output,
      );
    }
    const summary =
      blueprint.kind === 'course' ? estimateCredits('lite', 400, 400) : 0;
    // Headroom for targeted repairs of failing questions.
    return Math.ceil(total * 1.15) + summary;
  }

  // ── Blueprint ────────────────────────────────────────────────────────────

  async blueprint(
    brief: BriefInput,
    referenceText: string | undefined,
    charge: ChargeFn,
    signal?: AbortSignal,
  ): Promise<Blueprint> {
    const { data } = await this.callStructured(
      {
        tier: 'lite',
        system: BLUEPRINT_SYSTEM,
        prompt: blueprintPrompt(brief, referenceText),
        schema: blueprintSchema,
        schemaName: 'blueprint',
        maxOutputTokens: Math.min(
          8000,
          800 + brief.sections * brief.questionsPerSection * 160,
        ),
        timeoutMs: 90_000,
        abortSignal: signal,
      },
      'blueprint',
      charge,
    );
    return this.normalizeBlueprint(brief, data);
  }

  normalizeBlueprint(
    brief: BriefInput,
    raw: z.infer<typeof blueprintSchema>,
  ): Blueprint {
    const fallbackType = brief.types[0];
    const sections = raw.sections
      .slice(0, brief.sections)
      .map((section, sIdx) => ({
        id: newId('sec'),
        title: plainText(section.title, 160) || `Section ${sIdx + 1}`,
        summary: plainText(section.summary, 400),
        questions: section.questions
          .slice(0, brief.questionsPerSection)
          .map((q) =>
            this.normalizeBlueprintQuestion(q, brief.types, fallbackType),
          ),
      }))
      .filter((section) => section.questions.length > 0);

    return {
      kind: brief.kind,
      title: plainText(raw.title, 200) || plainText(brief.topic, 200),
      description: plainText(raw.description, 1000),
      sections,
    };
  }

  normalizeBlueprintQuestion(
    q: {
      id?: string;
      type?: string;
      title?: string;
      intent?: string;
      difficulty?: string;
      marks?: number;
    },
    allowed: QuestionType[],
    fallbackType: QuestionType,
  ): BlueprintQuestion {
    const type = coerceType(q.type, allowed, fallbackType);
    return {
      id: q.id && /^[\w-]{1,64}$/.test(q.id) ? q.id : newId('bq'),
      type,
      title: plainText(q.title, 200) || `${type} item`,
      intent: plainText(q.intent, 400),
      difficulty: coerceDifficulty(q.difficulty),
      marks: coerceMarks(q.marks, type === 'Coding' || type === 'Web' ? 10 : 2),
    };
  }

  // ── Sections ─────────────────────────────────────────────────────────────

  async generateSection(
    input: GenerateSectionInput,
    charge: ChargeFn,
  ): Promise<BuilderSection> {
    const types = [...new Set(input.section.questions.map((q) => q.type))];
    const schema = buildSectionSchema(types);
    const maxOutputTokens = Math.min(
      16_000,
      1000 +
        input.section.questions.reduce(
          (acc, q) => acc + OUTPUT_TOKENS_MAX[q.type],
          0,
        ),
    );

    const attempt = (feedback?: string) =>
      this.callStructured(
        {
          tier: input.tier,
          system: SECTION_SYSTEM,
          prompt: sectionPrompt({ ...input, feedback }),
          schema,
          schemaName: 'section',
          maxOutputTokens,
          timeoutMs: SECTION_TIMEOUT_MS,
          abortSignal: input.signal,
        },
        'section',
        charge,
      );

    let raw: RawGeneratedQuestion[];
    try {
      raw = (await attempt()).data.questions as RawGeneratedQuestion[];
    } catch (error) {
      if (!(error instanceof AiOutputError)) throw error;
      raw = (await attempt(error.issues)).data
        .questions as RawGeneratedQuestion[];
    }

    const questions: GeneratedQuestion[] = input.section.questions.map(
      (plan, idx) => {
        const candidate = raw[idx];
        if (!candidate) {
          return {
            ...this.placeholder(plan),
            aiMeta: { status: 'needs_review', issues: ['not generated'] },
          };
        }
        const question = toBuilderQuestion(
          candidate,
          plan,
          [plan.type],
          input.brief.codingLanguages,
        );
        const issues = validateQuestion(question);
        return {
          ...question,
          aiMeta: { status: issues.length ? 'needs_review' : 'ok', issues },
        };
      },
    );

    let repairs = 0;
    for (const [idx, question] of questions.entries()) {
      if (input.signal?.aborted) break;
      const plan = input.section.questions[idx];
      let current: GeneratedQuestion = question;

      if (current.aiMeta.issues.length && repairs < MAX_REPAIRS_PER_SECTION) {
        repairs += 1;
        current = await this.repairQuestion(
          current,
          current.aiMeta.issues,
          input,
          plan,
          charge,
        );
      }

      if (
        current.type === 'Coding' &&
        input.verifyCoding &&
        !current.aiMeta.issues.length
      ) {
        let verification = await this.verifier.verify(current);
        if (
          verification.status === 'failed' &&
          repairs < MAX_REPAIRS_PER_SECTION
        ) {
          repairs += 1;
          current = await this.repairQuestion(
            current,
            verification.failures,
            input,
            plan,
            charge,
          );
          verification = current.aiMeta.issues.length
            ? verification
            : await this.verifier.verify(current);
        }
        current = {
          ...current,
          aiMeta:
            verification.status === 'verified'
              ? { status: 'verified', issues: [] }
              : verification.status === 'unavailable'
                ? {
                    status: 'unverified',
                    issues: ['code runner unavailable, solution not executed'],
                  }
                : { status: 'needs_review', issues: verification.failures },
        };
      }
      questions[idx] = current;
    }

    return { id: newId('sec-ai'), title: input.section.title, questions };
  }

  private async repairQuestion(
    question: GeneratedQuestion,
    issues: string[],
    input: GenerateSectionInput,
    plan: BlueprintQuestion,
    charge: ChargeFn,
  ): Promise<GeneratedQuestion> {
    try {
      const repaired = await this.runQuestionOp(
        {
          op: 'regenerate',
          question,
          instruction: `Fix these problems: ${issues.join('; ')}. Keep the concept: ${plan.title} — ${plan.intent}`,
          tier: input.tier,
          allowedTypes: [plan.type],
          signal: input.signal,
        },
        charge,
        'repair',
      );
      return repaired;
    } catch (error) {
      this.logger.warn(
        `Repair failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return question;
    }
  }

  private placeholder(plan: BlueprintQuestion): BuilderQuestion {
    return toBuilderQuestion(
      {
        type: plan.type,
        title: plan.title,
        problemStatement: `<p>${plan.intent}</p>`,
        marks: plan.marks,
        difficulty: plan.difficulty,
        tags: [],
      },
      plan,
      [plan.type],
    );
  }

  // ── Single-question operations ───────────────────────────────────────────

  async runQuestionOp(
    input: {
      op: QuestionOp;
      question: BuilderQuestion;
      instruction?: string;
      context?: string;
      tier: AiTier;
      allowedTypes: QuestionType[];
      signal?: AbortSignal;
    },
    charge: ChargeFn,
    operation = `question.${input.op}`,
  ): Promise<GeneratedQuestion> {
    const type = input.question.type;
    const schema = buildSectionSchema([type]).shape.questions.element;
    const { data } = await this.callStructured(
      {
        tier: input.tier,
        system: QUESTION_OP_SYSTEM,
        prompt: questionOpPrompt({
          op: input.op,
          question: toRawQuestion(input.question),
          instruction: input.instruction,
          context: input.context,
        }),
        schema,
        schemaName: 'question',
        maxOutputTokens: 1000 + OUTPUT_TOKENS_MAX[type],
        timeoutMs: 90_000,
        abortSignal: input.signal,
      },
      operation,
      charge,
    );
    const plan: BlueprintQuestion = {
      id: input.question.id,
      type,
      title: input.question.title,
      intent: '',
      difficulty: input.question.difficulty,
      marks: input.question.marks,
    };
    const next = toBuilderQuestion(data as RawGeneratedQuestion, plan, [type]);
    const issues = validateQuestion(next);
    return {
      ...next,
      id: input.question.id,
      aiMeta: { status: issues.length ? 'needs_review' : 'ok', issues },
    };
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  async courseSummary(
    title: string,
    sections: BuilderSection[],
    charge: ChargeFn,
    signal?: AbortSignal,
  ): Promise<string> {
    const outline = sections
      .map(
        (s) =>
          `${s.title}: ${s.questions.map((q) => `${q.title} (${q.type})`).join(', ')}`,
      )
      .join('\n');
    const { data } = await this.callStructured(
      {
        tier: 'lite',
        system: SUMMARY_SYSTEM,
        prompt: `Course: ${title}\n${outline}`,
        schema: summarySchema,
        schemaName: 'summary',
        maxOutputTokens: 1500,
        timeoutMs: 60_000,
        abortSignal: signal,
      },
      'summary',
      charge,
    );
    return sanitizeRichText(data.summary);
  }

  // ── Plumbing ─────────────────────────────────────────────────────────────

  private async callStructured<T>(
    call: Parameters<OmniRouteService['generateStructured']>[0] & {
      schema: z.ZodType<T>;
    },
    operation: string,
    charge: ChargeFn,
  ): Promise<{ data: T; meta: AiCallMeta }> {
    try {
      const result = await this.omni.generateStructured<T>(call);
      await charge(result.meta, operation, { success: true });
      return result;
    } catch (error) {
      if (error instanceof AiOutputError || error instanceof AiUpstreamError) {
        await charge(error.meta, operation, {
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }
}

/** Builder question → the compact shape the generation schema uses. */
export function toRawQuestion(q: BuilderQuestion): RawGeneratedQuestion {
  const raw: RawGeneratedQuestion = {
    type: q.type,
    title: q.title,
    problemStatement: q.problemStatement,
    marks: q.marks,
    difficulty: q.difficulty,
    tags: q.tags,
  };
  if (q.options) {
    raw.options = q.options.map(({ text, isCorrect }) => ({ text, isCorrect }));
  }
  if (q.codingConfig) {
    raw.starterCode = {};
    raw.solution = {};
    for (const [lang, tpl] of Object.entries(q.codingConfig.templates)) {
      if (lang === 'javascript' || lang === 'python') {
        raw.starterCode[lang] = tpl.body;
        raw.solution[lang] = tpl.solution;
      }
    }
    raw.testCases = q.codingConfig.testCases.map(
      ({ input, output, isPublic }) => ({
        input,
        output,
        isPublic,
      }),
    );
  }
  if (q.webConfig) {
    raw.web = {
      html: q.webConfig.html,
      css: q.webConfig.css,
      js: q.webConfig.js,
    };
  }
  if (q.readingConfig) {
    raw.blocks = q.readingConfig.contentBlocks.map((block) =>
      block.type === 'code-runner'
        ? {
            kind: 'code' as const,
            content: block.runnerConfig?.initialCode ?? '',
            language: block.runnerConfig?.language,
          }
        : { kind: 'text' as const, content: block.content },
    );
  }
  if (q.notebookConfig) {
    raw.notebook = {
      initialCode: q.notebookConfig.initialCode,
      allowedLibraries: q.notebookConfig.allowedLibraries,
    };
  }
  return raw;
}
