import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../services/prisma/prisma.service';
import type { AiActor } from '../engine/ai-types';
import { plainText } from '../quality/sanitize';

export interface ContentRef {
  kind: 'course' | 'exam';
  id: string;
  title: string;
  updatedAt: string;
  status?: string;
}

const DIGEST_CHAR_BUDGET = 7000;
const UNIT_EXCERPT_CHARS = 280;

/**
 * Read-only, access-checked views of a teacher's own content for AI prompts.
 * Visibility mirrors TeacherCoursesService/TeacherExamsService exactly, and
 * the org always comes from the authenticated actor, never from the model.
 */
@Injectable()
export class ContentContextService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private courseWhere(actor: AiActor): Prisma.CourseWhereInput {
    if (actor.role === 'ADMIN') {
      return {
        OR: [
          ...(actor.orgId ? [{ orgId: actor.orgId }] : []),
          { creatorId: actor.userId, orgId: null },
        ],
      };
    }
    if (actor.role === 'TEACHER') {
      return {
        OR: [
          { creatorId: actor.userId },
          { assignments: { some: { teacherId: actor.userId } } },
        ],
      };
    }
    return { creatorId: actor.userId };
  }

  private examWhere(actor: AiActor): Prisma.ExamWhereInput {
    if (actor.role === 'ADMIN') {
      return {
        OR: [
          ...(actor.orgId ? [{ orgId: actor.orgId }] : []),
          { creatorId: actor.userId, orgId: null },
        ],
      };
    }
    if (actor.role === 'TEACHER') {
      return {
        OR: [
          { creatorId: actor.userId },
          {
            linkedCourse: {
              assignments: { some: { teacherId: actor.userId } },
            },
          },
        ],
      };
    }
    return { creatorId: actor.userId };
  }

  async search(
    actor: AiActor,
    query: string,
    limit = 8,
  ): Promise<ContentRef[]> {
    const q = query.trim().slice(0, 100);
    const titleFilter = q
      ? { title: { contains: q, mode: 'insensitive' as const } }
      : {};
    const [courses, exams] = await Promise.all([
      this.prisma.course.findMany({
        where: { AND: [this.courseWhere(actor), titleFilter] },
        select: { id: true, title: true, updatedAt: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.exam.findMany({
        where: { AND: [this.examWhere(actor), titleFilter] },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
    ]);
    return [
      ...courses.map((c) => ({
        kind: 'course' as const,
        id: c.id,
        title: c.title,
        status: c.status,
        updatedAt: c.updatedAt.toISOString(),
      })),
      ...exams.map((e) => ({
        kind: 'exam' as const,
        id: e.id,
        title: e.title,
        updatedAt: e.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  private async loadCourse(actor: AiActor, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { AND: [{ id: courseId }, this.courseWhere(actor)] },
      select: {
        id: true,
        title: true,
        shortDescription: true,
        longDescription: true,
        courseSummary: true,
        updatedAt: true,
        modules: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            units: {
              orderBy: { order: 'asc' },
              select: { id: true, title: true, type: true, content: true },
            },
          },
        },
      },
    });
    if (!course) {
      throw new NotFoundException('Course not found or not accessible');
    }
    return course;
  }

  /** Compact course outline + per-unit excerpts, capped to a char budget. */
  async courseDigest(actor: AiActor, courseId: string): Promise<string> {
    const course = await this.loadCourse(actor, courseId);
    const cacheKey = `ai:digest:course:${course.id}:${course.updatedAt.getTime()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const lines: string[] = [
      `Course: ${course.title}`,
      plainText(course.shortDescription || course.longDescription, 600),
    ];
    for (const [mIdx, mod] of course.modules.entries()) {
      lines.push(`\nSection ${mIdx + 1}: ${mod.title}`);
      for (const unit of mod.units) {
        const excerpt = plainText(unitText(unit.content), UNIT_EXCERPT_CHARS);
        lines.push(
          `- [${unit.type}] ${unit.title}${excerpt ? `: ${excerpt}` : ''}`,
        );
      }
    }
    const digest = lines
      .filter(Boolean)
      .join('\n')
      .slice(0, DIGEST_CHAR_BUDGET);
    await this.redis.set(cacheKey, digest, 'EX', 3600);
    return digest;
  }

  /** Keyword-ranked unit excerpts from one course, for focused grounding. */
  async searchCourseUnits(
    actor: AiActor,
    courseId: string,
    query: string,
    limit = 4,
  ): Promise<{ unitId: string; title: string; text: string }[]> {
    const course = await this.loadCourse(actor, courseId);
    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);
    const scored = course.modules.flatMap((mod) =>
      mod.units.map((unit) => {
        const text = plainText(unitText(unit.content), 4000);
        const haystack = `${unit.title} ${text}`.toLowerCase();
        const score = terms.reduce(
          (acc, term) => acc + (haystack.split(term).length - 1),
          0,
        );
        return { unitId: unit.id, title: unit.title, text, score };
      }),
    );
    return scored
      .filter((u) => u.score > 0 || !terms.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ unitId, title, text }) => ({
        unitId,
        title,
        text: text.slice(0, 1500),
      }));
  }

  async unitContent(
    actor: AiActor,
    unitId: string,
  ): Promise<{ title: string; type: string; text: string }> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        title: true,
        type: true,
        content: true,
        module: { select: { courseId: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const allowed = await this.prisma.course.count({
      where: { AND: [{ id: unit.module.courseId }, this.courseWhere(actor)] },
    });
    if (!allowed) throw new ForbiddenException('Unit not accessible');
    return {
      title: unit.title,
      type: unit.type,
      text: plainText(unitText(unit.content), 4000),
    };
  }

  async examDigest(actor: AiActor, examId: string): Promise<string> {
    const exam = await this.prisma.exam.findFirst({
      where: { AND: [{ id: examId }, this.examWhere(actor)] },
      select: {
        title: true,
        shortDescription: true,
        duration: true,
        totalMarks: true,
        questions: true,
      },
    });
    if (!exam) throw new NotFoundException('Exam not found or not accessible');
    const lines = [
      `Exam: ${exam.title} (${exam.duration} min, ${exam.totalMarks ?? '?'} marks)`,
      plainText(exam.shortDescription, 400),
    ];
    const sections = Array.isArray(exam.questions) ? exam.questions : [];
    for (const [idx, section] of sections.entries()) {
      const s = section as { title?: string; questions?: unknown[] };
      lines.push(`\nSection ${idx + 1}: ${s.title ?? ''}`);
      for (const question of s.questions ?? []) {
        const q = question as {
          type?: string;
          title?: string;
          marks?: number;
          problemStatement?: string;
        };
        lines.push(
          `- [${q.type}] ${q.title} (${q.marks ?? '?'} marks): ${plainText(q.problemStatement, 200)}`,
        );
      }
    }
    return lines.filter(Boolean).join('\n').slice(0, DIGEST_CHAR_BUDGET);
  }

  async referenceText(
    actor: AiActor,
    refs: { kind: 'course' | 'exam'; id: string }[],
  ): Promise<string> {
    const parts = await Promise.all(
      refs.map((ref) =>
        ref.kind === 'course'
          ? this.courseDigest(actor, ref.id)
          : this.examDigest(actor, ref.id),
      ),
    );
    return parts.join('\n\n---\n\n');
  }
}

/** Pulls human-readable text out of a Unit.content JSON blob. */
function unitText(content: Prisma.JsonValue): string {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return '';
  }
  const c = content as Record<string, unknown>;
  const parts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) parts.push(value);
  };
  push(c.problemStatement);
  push(c.description);
  const reading = c.readingConfig as { contentBlocks?: unknown[] } | undefined;
  for (const block of reading?.contentBlocks ?? []) {
    push((block as { content?: unknown })?.content);
  }
  const blocks = c.contentBlocks as unknown[] | undefined;
  for (const block of Array.isArray(blocks) ? blocks : []) {
    push((block as { content?: unknown })?.content);
  }
  return parts.join(' ');
}
