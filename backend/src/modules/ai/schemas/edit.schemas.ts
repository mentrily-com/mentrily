import { z } from 'zod';

export const EDIT_OPS = [
  'edit_item',
  'add_item',
  'remove_item',
  'move_item',
  'add_section',
  'rename_section',
  'remove_section',
] as const;

// Flat on purpose: one object shape with optional fields is far more reliable
// across providers than a discriminated union in the JSON schema.
const editOperationSchema = z.object({
  op: z.enum(EDIT_OPS),
  itemId: z
    .string()
    .optional()
    .describe('Existing item id (edit_item, remove_item, move_item).'),
  sectionId: z
    .string()
    .optional()
    .describe(
      'Existing section id, or the newSectionRef of a section added in this plan.',
    ),
  newSectionRef: z
    .string()
    .optional()
    .describe('add_section only: a short ref such as "new-1".'),
  position: z.number().optional().describe('0-based position.'),
  title: z.string().optional(),
  instruction: z
    .string()
    .optional()
    .describe('edit_item only: exactly what to change in that item.'),
  type: z
    .string()
    .optional()
    .describe('add_item only: one of the allowed types.'),
  intent: z.string().optional(),
  difficulty: z.string().optional(),
  marks: z.number().optional(),
});

export const editPlanSchema = z.object({
  summary: z.string(),
  details: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  operations: z.array(editOperationSchema).max(30),
});

export type EditPlan = z.infer<typeof editPlanSchema>;
export type EditOperation = z.infer<typeof editOperationSchema>;
