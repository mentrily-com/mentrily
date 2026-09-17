import { z } from 'zod';
import { QUESTION_TYPES } from '../schemas/generation.schemas';

export const briefInputSchema = z.object({
  kind: z.enum(['course', 'exam']),
  topic: z.string().trim().min(3).max(2000),
  audience: z.string().trim().max(300).optional(),
  outcomes: z.string().trim().max(1500).optional(),
  language: z.string().trim().max(40).optional(),
  sections: z.number().int().min(1).max(12),
  questionsPerSection: z.number().int().min(1).max(20),
  types: z.array(z.enum(QUESTION_TYPES)).min(1).max(QUESTION_TYPES.length),
  difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Mixed']).default('Mixed'),
  totalMarks: z.number().int().min(1).max(2000).optional(),
  codingLanguages: z
    .array(z.enum(['python', 'javascript']))
    .max(2)
    .optional(),
});

export const clientBlueprintSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(''),
  sections: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        title: z.string().trim().min(1).max(160),
        summary: z.string().trim().max(400).default(''),
        questions: z
          .array(
            z.object({
              id: z.string().max(64).optional(),
              type: z.string().max(40),
              title: z.string().trim().min(1).max(200),
              intent: z.string().trim().max(400).default(''),
              difficulty: z.string().max(20).optional(),
              marks: z.number().optional(),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(12),
});

export const referencesSchema = z
  .array(
    z.object({
      kind: z.enum(['course', 'exam']),
      id: z.string().uuid(),
      title: z.string().max(200).optional(),
    }),
  )
  .max(10)
  .default([]);

export const createJobSchema = z.object({
  kind: z.enum(['blueprint', 'generate', 'quiz']),
  brief: briefInputSchema,
  blueprint: clientBlueprintSchema.optional(),
  references: referencesSchema,
  quality: z.enum(['standard', 'pro']).default('standard'),
  conversationId: z.string().uuid().optional(),
  parentJobId: z.string().uuid().optional(),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;
