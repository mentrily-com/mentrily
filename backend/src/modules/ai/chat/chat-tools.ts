import { tool } from 'ai';
import { z } from 'zod';
import type { AiActor } from '../engine/ai-types';
import type { ContentContextService } from '../context/content-context.service';
import type { ContentEditService } from '../edit/content-edit.service';

const safe = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Not available',
    };
  }
};

/**
 * Tools over the caller's own content. The actor is bound here on the
 * server; the model can only choose ids, never whose data it touches.
 * Nothing here saves: edit_content only proposes changes, and applying them
 * is always a click by the teacher.
 */
export function buildChatTools(
  actor: AiActor,
  context: ContentContextService,
  edits?: { service: ContentEditService; conversationId: string },
) {
  return {
    search_my_content: tool({
      description:
        "Find the teacher's own courses and exams by title. Use when they mention a course or exam by name.",
      inputSchema: z.object({
        query: z
          .string()
          .max(100)
          .describe('Words from the title. Empty for recent items.'),
      }),
      execute: ({ query }) => safe(() => context.search(actor, query, 8)),
    }),
    get_course_outline: tool({
      description:
        "Read the outline of one of the teacher's courses: sections, units and short excerpts.",
      inputSchema: z.object({ courseId: z.string().uuid() }),
      execute: ({ courseId }) =>
        safe(async () => ({
          outline: await context.courseDigest(actor, courseId),
        })),
    }),
    search_course_units: tool({
      description:
        "Find the units in one of the teacher's courses that are most relevant to a topic, with their text.",
      inputSchema: z.object({
        courseId: z.string().uuid(),
        query: z.string().max(200),
      }),
      execute: ({ courseId, query }) =>
        safe(() => context.searchCourseUnits(actor, courseId, query, 4)),
    }),
    get_exam_outline: tool({
      description:
        "Read one of the teacher's exams: sections and questions with marks.",
      inputSchema: z.object({ examId: z.string().uuid() }),
      execute: ({ examId }) =>
        safe(async () => ({
          outline: await context.examDigest(actor, examId),
        })),
    }),
    ...(edits
      ? {
          edit_content: tool({
            description:
              "Change one of the teacher's courses or exams, or a draft made in this chat, as they ask (edit, add, remove or reorder items and sections). Starts an edit that proposes changes for the teacher to review; nothing is saved until they apply it. Find saved content ids with search_my_content; drafts from this chat are listed in your instructions.",
            inputSchema: z.object({
              target: z
                .enum(['draft', 'course', 'exam'])
                .describe('draft = a draft generated in this chat.'),
              id: z.string().uuid(),
              instruction: z
                .string()
                .max(1000)
                .describe("The teacher's requested changes, stated precisely."),
            }),
            execute: ({ target, id, instruction }) =>
              safe(() =>
                edits.service.start(actor, {
                  target: { type: target, id },
                  instruction,
                  conversationId: edits.conversationId,
                }),
              ),
          }),
        }
      : {}),
  };
}
