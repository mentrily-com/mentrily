import { z } from 'zod';

export const QUESTION_TYPES = [
  'MCQ',
  'MultiSelect',
  'Coding',
  'Web',
  'Reading',
  'Notebook',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const COURSE_TYPES: QuestionType[] = [
  'Reading',
  'MCQ',
  'MultiSelect',
  'Coding',
  'Web',
  'Notebook',
];
export const EXAM_TYPES: QuestionType[] = [
  'MCQ',
  'MultiSelect',
  'Coding',
  'Web',
  'Notebook',
];

// Plan features that gate specific question types (mirrors the builders).
export const TYPE_FEATURE: Partial<Record<QuestionType, string>> = {
  Coding: 'coding',
  Web: 'webEditor',
  Notebook: 'pythonNotebook',
};

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

// ── Blueprint (outline) ────────────────────────────────────────────────────

export const blueprintQuestionSchema = z.object({
  type: z.string().describe(`One of the allowed question types.`),
  title: z.string().describe('Short name of the concept this item covers.'),
  intent: z
    .string()
    .describe('One sentence: what the learner should know or be able to do.'),
  difficulty: z.string().describe('Easy, Medium or Hard.'),
  marks: z.number().describe('Marks for this item.'),
});

export const blueprintSchema = z.object({
  title: z.string(),
  description: z.string().describe('Two or three sentences for learners.'),
  sections: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().describe('One sentence describing the section.'),
        questions: z.array(blueprintQuestionSchema),
      }),
    )
    .min(1),
});
export type RawBlueprint = z.infer<typeof blueprintSchema>;

export interface BlueprintQuestion {
  id: string;
  type: QuestionType;
  title: string;
  intent: string;
  difficulty: (typeof DIFFICULTIES)[number];
  marks: number;
}
export interface BlueprintSection {
  id: string;
  title: string;
  summary: string;
  questions: BlueprintQuestion[];
}
export interface Blueprint {
  kind: 'course' | 'exam';
  title: string;
  description: string;
  sections: BlueprintSection[];
}

// ── Section content ────────────────────────────────────────────────────────

const optionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
});

const testCaseSchema = z.object({
  input: z
    .string()
    .describe('Exact raw stdin, e.g. "5\\n10". Empty string if none.'),
  output: z.string().describe('Exact expected stdout, trimmed.'),
  isPublic: z.boolean(),
  explanation: z
    .string()
    .optional()
    .describe('Public cases only: one sentence on why this is the output.'),
});

const codeTemplateSchema = z.object({
  header: z
    .string()
    .describe(
      'Hidden, runs before the learner code: only imports or small helpers the function may use. Often empty.',
    ),
  starter: z
    .string()
    .describe(
      'The only code the learner sees and edits: the function with its full signature, a short docstring/comment on its parameters and return value, and a placeholder body. No input reading, no printing, no solution.',
    ),
  footer: z
    .string()
    .describe(
      'Hidden, runs after the learner code: reads all of stdin, parses it as inputFormat says, calls the function and prints the returned value as outputFormat says. No solution logic.',
    ),
  solution: z
    .string()
    .describe(
      'The same function as starter, fully implemented. header + solution + footer prints the expected output for every test case.',
    ),
});

const codingSchema = z.object({
  functionDescription: z
    .string()
    .describe(
      'What the function receives and must return, in plain words (no language syntax). End by saying the input is read for them and they should return the answer, not print it.',
    ),
  inputFormat: z.string().describe('The raw stdin layout, line by line.'),
  outputFormat: z.string().describe('Exactly what is printed.'),
  constraints: z
    .array(z.string())
    .describe('Input limits, e.g. "1 ≤ n ≤ 10<sup>5</sup>".'),
  templates: z.object({
    python: codeTemplateSchema.optional(),
    javascript: codeTemplateSchema.optional(),
  }),
  testCases: z.array(testCaseSchema).describe('3 to 6 test cases.'),
});

/**
 * Only the fields for the requested question types are included, so a
 * section of MCQs never pays prompt tokens for coding/web/notebook shapes.
 */
export function buildSectionSchema(types: QuestionType[]) {
  const has = (t: QuestionType) => types.includes(t);
  const shape: Record<string, z.ZodTypeAny> = {
    type: z.enum(types as [QuestionType, ...QuestionType[]]),
    title: z.string(),
    problemStatement: z
      .string()
      .describe(
        has('Coding')
          ? 'HTML using <p>, <ul>, <ol>, <li>, <strong>, <em>, <code>, <pre>, <blockquote>. No heading with the title, no answer options. For Coding: only the task (context and what to compute); function, formats, constraints and examples go in "coding".'
          : 'HTML using <p>, <ul>, <ol>, <li>, <strong>, <em>, <code>, <pre>, <blockquote>. No heading with the title, no answer options.',
      ),
    marks: z.number(),
    difficulty: z.string().describe('Easy, Medium or Hard.'),
    tags: z.array(z.string()),
  };
  if (has('MCQ') || has('MultiSelect')) {
    shape.options = z
      .array(optionSchema)
      .optional()
      .describe('MCQ/MultiSelect only: 4 or 5 options.');
  }
  if (has('Coding')) {
    shape.coding = codingSchema
      .optional()
      .describe(
        'Coding only: the function spec, header/starter/footer/solution per requested language, and test cases.',
      );
  }
  if (has('Web')) {
    shape.web = z
      .object({ html: z.string(), css: z.string(), js: z.string() })
      .optional()
      .describe('Web only: starter files.');
  }
  if (has('Reading')) {
    shape.blocks = z
      .array(
        z.object({
          kind: z.enum(['text', 'code']),
          content: z
            .string()
            .describe('HTML for text blocks, source code for code blocks.'),
          language: z.enum(['javascript', 'python', 'java', 'cpp']).optional(),
        }),
      )
      .optional()
      .describe('Reading only: lesson content blocks in order.');
  }
  if (has('Notebook')) {
    shape.notebook = z
      .object({
        initialCode: z.string(),
        allowedLibraries: z.array(z.string()).optional(),
      })
      .optional()
      .describe('Notebook only: Python starter code.');
  }
  return z.object({
    questions: z.array(z.object(shape)).min(1),
  });
}

export type RawCodeTemplate = z.infer<typeof codeTemplateSchema>;
export type RawCoding = z.infer<typeof codingSchema>;

export type RawGeneratedQuestion = {
  type: string;
  title: string;
  problemStatement: string;
  marks: number;
  difficulty: string;
  tags: string[];
  options?: { text: string; isCorrect: boolean }[];
  coding?: RawCoding;
  web?: { html: string; css: string; js: string };
  blocks?: {
    kind: 'text' | 'code';
    content: string;
    language?: 'javascript' | 'python' | 'java' | 'cpp';
  }[];
  notebook?: { initialCode: string; allowedLibraries?: string[] };
};

export const summarySchema = z.object({
  summary: z
    .string()
    .describe('Cheat sheet in HTML: key concepts grouped by section.'),
});
