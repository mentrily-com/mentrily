import { randomUUID } from 'crypto';
import {
  BlueprintQuestion,
  DIFFICULTIES,
  QUESTION_TYPES,
  QuestionType,
  RawGeneratedQuestion,
} from '../schemas/generation.schemas';
import {
  cleanCode,
  composeCodingStatement,
  splitCodingStatement,
} from './coding-format';
import { asText, plainText, sanitizeRichText } from './sanitize';

/** Matches frontend/app/components/Authoring/types.ts `Question`. */
export interface BuilderQuestion {
  id: string;
  type: QuestionType;
  title: string;
  problemStatement: string;
  marks: number;
  difficulty: (typeof DIFFICULTIES)[number];
  tags: string[];
  options?: { id: string; text: string; isCorrect: boolean }[];
  codingConfig?: {
    templates: Record<
      string,
      { head: string; body: string; tail: string; solution: string }
    >;
    testCases: {
      input: string;
      output: string;
      isPublic: boolean;
      points: number;
    }[];
    showTestCases?: boolean;
  };
  webConfig?: {
    html: string;
    css: string;
    js: string;
    showFiles: { html: boolean; css: boolean; js: boolean };
    testCases: { description: string; code: string; weight: number }[];
  };
  readingConfig?: {
    contentBlocks: {
      id: string;
      type: 'text' | 'code-runner';
      content: string;
      runnerConfig?: {
        language: 'javascript' | 'python' | 'java' | 'cpp';
        initialCode: string;
      };
    }[];
  };
  notebookConfig?: {
    initialCode: string;
    language: 'python';
    maxExecutionTime?: number;
    allowedLibraries?: string[];
  };
}

export type QuestionReviewStatus =
  | 'ok'
  | 'verified'
  | 'needs_review'
  | 'unverified';

export interface AiQuestionMeta {
  status: QuestionReviewStatus;
  issues: string[];
}

export type GeneratedQuestion = BuilderQuestion & { aiMeta: AiQuestionMeta };

export interface BuilderSection {
  id: string;
  title: string;
  questions: GeneratedQuestion[];
}

// Only used when the model returned no code at all (placeholders).
const STARTER: Record<string, string> = {
  javascript:
    "const input = require('fs').readFileSync(0, 'utf8').trim();\n\n// Write your solution here",
  python:
    'import sys\n\ndata = sys.stdin.read().strip()\n\n# Write your solution here',
};

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function coerceType(
  raw: unknown,
  allowed: QuestionType[],
  fallback: QuestionType,
): QuestionType {
  const key = asText(raw)
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const match = QUESTION_TYPES.find((t) => t.toLowerCase() === key);
  if (match && allowed.includes(match)) return match;
  if (key === 'singlechoice' && allowed.includes('MCQ')) return 'MCQ';
  if (key === 'multiplechoice' && allowed.includes('MultiSelect')) {
    return 'MultiSelect';
  }
  return allowed.includes(fallback) ? fallback : allowed[0];
}

export function coerceDifficulty(raw: unknown): BuilderQuestion['difficulty'] {
  const v = asText(raw).toLowerCase();
  if (['easy', 'beginner', 'basic', 'low'].includes(v)) return 'Easy';
  if (['hard', 'advanced', 'difficult', 'high', 'expert'].includes(v)) {
    return 'Hard';
  }
  return 'Medium';
}

export function coerceMarks(raw: unknown, fallback: number): number {
  const n = Math.round(Number(raw));
  if (Number.isFinite(n) && n > 0 && n <= 1000) return n;
  return Math.max(1, Math.round(fallback || 1));
}

function distributePoints(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const points = Array.from({ length: count }, () => Math.max(1, base));
  const diff = total - points.reduce((a, b) => a + b, 0);
  points[points.length - 1] = Math.max(1, points[points.length - 1] + diff);
  return points;
}

/** Converts one raw model question into the builder's Question shape. */
export function toBuilderQuestion(
  raw: RawGeneratedQuestion,
  plan: BlueprintQuestion | undefined,
  allowed: QuestionType[],
  codingLanguages?: ('python' | 'javascript')[],
): BuilderQuestion {
  const id = newId('q-ai');
  const type = coerceType(raw.type, allowed, plan?.type ?? allowed[0]);
  const title = plainText(raw.title || plan?.title || `${type} question`, 200);
  const marks = coerceMarks(raw.marks, plan?.marks ?? 5);

  const question: BuilderQuestion = {
    id,
    type,
    title,
    problemStatement: sanitizeRichText(raw.problemStatement),
    marks,
    difficulty: coerceDifficulty(raw.difficulty ?? plan?.difficulty),
    tags: (Array.isArray(raw.tags) ? raw.tags : [])
      .map((t) => plainText(t, 40))
      .filter(Boolean)
      .slice(0, 6),
  };

  if (type === 'MCQ' || type === 'MultiSelect') {
    const seen = new Set<string>();
    question.options = (Array.isArray(raw.options) ? raw.options : [])
      .map((opt) => ({
        text: plainText(opt?.text, 400),
        isCorrect: Boolean(opt?.isCorrect),
      }))
      .filter((opt) => {
        const key = opt.text.toLowerCase();
        if (!opt.text || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6)
      .map((opt, idx) => ({ id: `opt-${id}-${idx}`, ...opt }));
  }

  if (type === 'Coding') {
    const coding = raw.coding;
    const templates: NonNullable<BuilderQuestion['codingConfig']>['templates'] =
      {};
    const languages = codingLanguages?.length
      ? codingLanguages
      : (['python', 'javascript'] as const);
    for (const lang of languages) {
      const tpl = coding?.templates?.[lang];
      const starter = cleanCode(tpl?.starter);
      const solution = cleanCode(tpl?.solution);
      if (!starter && !solution) continue;
      templates[lang] = {
        head: cleanCode(tpl?.header),
        body: starter || STARTER[lang],
        tail: cleanCode(tpl?.footer),
        solution,
      };
    }
    if (Object.keys(templates).length === 0) {
      templates.python = {
        head: '',
        body: STARTER.python,
        tail: '',
        solution: '',
      };
    }
    const cases = (Array.isArray(coding?.testCases) ? coding.testCases : [])
      .filter((tc) => tc && String(tc.output ?? '').trim() !== '')
      .slice(0, 6);
    const points = distributePoints(
      Math.max(marks, cases.length),
      cases.length,
    );
    const testCases = cases.map((tc, idx) => ({
      input: String(tc.input ?? '').replace(/\r\n?/g, '\n'),
      output: String(tc.output ?? '')
        .replace(/\r\n?/g, '\n')
        .trim(),
      isPublic: Boolean(tc.isPublic),
      points: points[idx],
    }));
    if (testCases.length && !testCases.some((tc) => tc.isPublic)) {
      testCases[0].isPublic = true;
    }
    question.codingConfig = { templates, testCases, showTestCases: false };
    question.marks = testCases.reduce((acc, tc) => acc + tc.points, 0) || marks;

    if (coding) {
      // A model that echoes an already-composed statement back into the task
      // would otherwise get every section twice.
      const echoed = splitCodingStatement(question.problemStatement);
      const constraints = (
        Array.isArray(coding.constraints) ? coding.constraints : []
      )
        .map(asText)
        .filter((c) => c.trim())
        .slice(0, 8);
      // Sanitised when composed; may carry inline <code>.
      const explanations = cases.map((tc) =>
        asText(tc.explanation).slice(0, 600),
      );
      question.problemStatement = composeCodingStatement(
        {
          task: echoed.task,
          functionDescription:
            asText(coding.functionDescription) || echoed.functionDescription,
          inputFormat: asText(coding.inputFormat) || echoed.inputFormat,
          outputFormat: asText(coding.outputFormat) || echoed.outputFormat,
          constraints: constraints.length ? constraints : echoed.constraints,
          examples: testCases
            .map((tc, idx) => ({ ...tc, explanation: explanations[idx] }))
            .filter((tc) => tc.isPublic),
        },
        templates,
      );
    }
  }

  if (type === 'Web') {
    question.webConfig = {
      html: String(raw.web?.html ?? '<main>\n  <h1>Hello</h1>\n</main>'),
      css: String(raw.web?.css ?? ''),
      js: String(raw.web?.js ?? ''),
      showFiles: { html: true, css: true, js: true },
      testCases: [],
    };
  }

  if (type === 'Reading') {
    const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
      .map((block) =>
        block.kind === 'code'
          ? {
              id: newId('blk'),
              type: 'code-runner' as const,
              content: '',
              runnerConfig: {
                language: block.language ?? 'python',
                initialCode: String(block.content ?? ''),
              },
            }
          : {
              id: newId('blk'),
              type: 'text' as const,
              content: sanitizeRichText(block.content),
            },
      )
      .filter((block) =>
        block.type === 'text'
          ? block.content.length > 0
          : block.runnerConfig.initialCode.trim().length > 0,
      );
    if (!blocks.length && question.problemStatement) {
      blocks.push({
        id: newId('blk'),
        type: 'text',
        content: question.problemStatement,
      });
    }
    question.readingConfig = { contentBlocks: blocks };
  }

  if (type === 'Notebook') {
    question.notebookConfig = {
      initialCode: String(
        raw.notebook?.initialCode ?? '# Write your Python code here\n',
      ),
      language: 'python',
      maxExecutionTime: 10,
      allowedLibraries: (raw.notebook?.allowedLibraries ?? ['numpy', 'pandas'])
        .map((lib) => plainText(lib, 40))
        .filter(Boolean)
        .slice(0, 10),
    };
  }

  return question;
}

/** Strips review metadata before content is handed to the builders. */
export function stripAiMeta(question: GeneratedQuestion): BuilderQuestion {
  const { aiMeta: _aiMeta, ...rest } = question;
  return rest;
}
