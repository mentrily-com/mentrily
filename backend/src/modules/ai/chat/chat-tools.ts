import { tool } from 'ai';
import { z } from 'zod';
import type { AiActor } from '../engine/ai-types';
import type { ContentContextService } from '../context/content-context.service';

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
 * Read-only tools over the caller's own content. The actor is bound here on
 * the server; the model can only choose ids, never whose data it reads.
 * Nothing in this set writes — saving drafts is always a user click.
 */
export function buildChatTools(actor: AiActor, context: ContentContextService) {
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
  };
}
