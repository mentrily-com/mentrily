import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../services/prisma/prisma.service';
import { TeacherService } from '../../teacher/teacher.service';
import { TeacherCoursesService } from '../../teacher/teacher-courses.service';
import { TeacherExamsService } from '../../teacher/teacher-exams.service';
import { collectQuestionTypesFromExamContent } from '../../teacher/teacher.util';
import type { AiActor } from '../engine/ai-types';
import { AiPlanContext, AiPlanService } from '../credits/ai-plan.service';
import { AiJobsService } from '../jobs/ai-jobs.service';
import type { ChargeFn } from '../generation/generation.service';
import { GenerationService } from '../generation/generation.service';
import { CodingVerifierService } from '../quality/coding-verifier.service';
import { plainText } from '../quality/sanitize';
import type { BuilderQuestion, GeneratedQuestion } from '../quality/normalize';
import {
  COURSE_TYPES,
  EXAM_TYPES,
  QuestionType,
  TYPE_FEATURE,
  type BlueprintQuestion,
} from '../schemas/generation.schemas';
import type { EditOperation } from '../schemas/edit.schemas';
import type {
  AiDraft,
  AiJobInput,
  AiJobProgress,
  AiJobResult,
  ChangeSet,
  EditChange,
  EditTargetRef,
} from '../jobs/ai-job.types';
import {
  EditableContent,
  EditableSection,
  applyChange,
  invertChange,
} from './edit-apply';

const startSchema = z.object({
  target: z.object({
    type: z.enum(['draft', 'course', 'exam']),
    id: z.string().uuid(),
  }),
  instruction: z.string().trim().min(3).max(1000),
  conversationId: z.string().uuid().optional(),
});

const applySchema = z.object({
  changeIds: z.array(z.string().max(100)).max(100).optional(),
});

const savedSchema = z.object({
  kind: z.enum(['course', 'exam']),
  id: z.string().uuid(),
});

const MAX_OPERATIONS = 20;
const FLAT_SECTION_ID = '__questions__';
const ok = { status: 'ok' as const, issues: [] as string[] };

/** New coding items use the languages the content already uses. */
function codingLanguagesOf(
  content: EditableContent,
): ('python' | 'javascript')[] {
  const used = new Set<string>();
  for (const section of content.sections) {
    for (const item of section.items) {
      for (const lang of Object.keys(item.codingConfig?.templates ?? {})) {
        used.add(lang);
      }
    }
  }
  const languages = (['python', 'javascript'] as const).filter((lang) =>
    used.has(lang),
  );
  return languages.length ? languages : ['python'];
}

interface LoadedTarget {
  ref: EditTargetRef;
  kind: 'course' | 'exam';
  title: string;
  live: boolean;
  content: EditableContent;
  /** Draft targets: the draft as generated (kept for review metadata). */
  draft?: AiDraft;
  /** Exam targets stored as a flat question list rather than sections. */
  flat?: boolean;
  slug?: string;
  orgId?: string | null;
}

type SessionUser = { id: string; orgId: string | null; role: string };

@Injectable()
export class ContentEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: AiPlanService,
    private readonly jobs: AiJobsService,
    private readonly generation: GenerationService,
    private readonly verifier: CodingVerifierService,
    private readonly teacher: TeacherService,
    private readonly teacherCourses: TeacherCoursesService,
    private readonly teacherExams: TeacherExamsService,
  ) {}

  private user(actor: AiActor): SessionUser {
    return { id: actor.userId, orgId: actor.orgId, role: actor.role };
  }

  private allowedTypes(
    ctx: AiPlanContext,
    kind: 'course' | 'exam',
  ): QuestionType[] {
    return (kind === 'exam' ? EXAM_TYPES : COURSE_TYPES).filter((type) => {
      const feature = TYPE_FEATURE[type];
      return !feature || ctx.unlimited || ctx.features[feature] === true;
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  private async draftJob(actor: AiActor, id: string) {
    const job = await this.prisma.aiJob.findFirst({
      where: { id, userId: actor.userId, status: 'completed' },
      select: { id: true, result: true },
    });
    const result = job?.result as AiJobResult | null | undefined;
    if (!job || result?.type !== 'draft') {
      throw new NotFoundException('That draft could not be found.');
    }
    return { id: job.id, result };
  }

  private async load(
    actor: AiActor,
    ref: EditTargetRef,
  ): Promise<LoadedTarget> {
    if (ref.type === 'draft') {
      const { result } = await this.draftJob(actor, ref.id);
      const draft = result.draft;
      return {
        ref,
        kind: draft.kind,
        title: draft.title,
        live: false,
        draft,
        content: {
          title: draft.title,
          description: draft.description,
          sections: draft.sections.map((s) => ({
            id: s.id,
            title: s.title,
            items: s.questions,
          })),
        },
      };
    }

    const user = this.user(actor);
    if (ref.type === 'course') {
      const course = await this.prisma.course.findUnique({
        where: { id: ref.id },
        include: {
          modules: {
            orderBy: { order: 'asc' },
            include: { units: { orderBy: { order: 'asc' } } },
          },
        },
      });
      if (!course)
        throw new NotFoundException('That course could not be found.');
      await this.teacher.checkAccess(course, user);
      return {
        ref,
        kind: 'course',
        title: course.title,
        live: course.status === 'Published' || course.isVisible === true,
        orgId: course.orgId,
        content: {
          title: course.title,
          description: course.shortDescription ?? '',
          sections: course.modules.map((m) => ({
            id: m.id,
            title: m.title,
            // Unit id wins over any id stored inside the content, so saving
            // keeps every unit (and its learner progress) in place.
            items: m.units.map(
              (u) =>
                ({
                  ...((u.content as Record<string, unknown>) ?? {}),
                  id: u.id,
                  title: u.title,
                  type: u.type,
                }) as unknown as BuilderQuestion,
            ),
          })),
        },
      };
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: ref.id },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        isActive: true,
        orgId: true,
        creatorId: true,
        linkedCourseId: true,
        questions: true,
      },
    });
    if (!exam) throw new NotFoundException('That exam could not be found.');
    await this.teacher.checkAccess(exam, user);
    const raw = Array.isArray(exam.questions)
      ? (exam.questions as unknown[])
      : [];
    const sectioned = raw.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        Array.isArray((s as { questions?: unknown }).questions),
    );
    const sections: EditableSection[] = sectioned
      ? (
          raw as { id?: string; title?: string; questions: BuilderQuestion[] }[]
        ).map((s, i) => ({
          id: String(s.id || `sec-${i + 1}`),
          title: String(s.title || `Section ${i + 1}`),
          items: s.questions,
        }))
      : [
          {
            id: FLAT_SECTION_ID,
            title: 'Questions',
            items: raw as BuilderQuestion[],
          },
        ];
    return {
      ref,
      kind: 'exam',
      title: exam.title,
      live: exam.isActive === true,
      flat: !sectioned,
      slug: exam.slug,
      orgId: exam.orgId,
      content: {
        title: exam.title,
        description: exam.shortDescription ?? '',
        sections,
      },
    };
  }

  // ── Start (chat tool / API) ──────────────────────────────────────────────

  async start(actor: AiActor, body: unknown) {
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_AI_REQUEST',
        message: parsed.error.issues[0]?.message ?? 'Invalid request',
      });
    }
    const { instruction, conversationId } = parsed.data;
    let target: EditTargetRef = parsed.data.target;

    const ctx = await this.plans.resolve(actor);
    this.plans.assertFeature(ctx, 'aiStudio');
    this.plans.assertFeature(ctx, 'aiExams');

    // A draft that has been saved is edited as the saved course or exam.
    let parentJobId: string | undefined;
    if (target.type === 'draft') {
      const { result } = await this.draftJob(actor, target.id);
      if (result.savedAs)
        target = { type: result.savedAs.kind, id: result.savedAs.id };
      else parentJobId = target.id;
    }

    const loaded = await this.load(actor, target);
    const itemCount = loaded.content.sections.reduce(
      (acc, s) => acc + s.items.length,
      0,
    );
    const input: AiJobInput = {
      brief: {
        kind: loaded.kind,
        topic: loaded.title,
        sections: 1,
        questionsPerSection: 1,
        types: this.allowedTypes(ctx, loaded.kind),
        difficulty: 'Mixed',
        language: 'English',
        codingLanguages: codingLanguagesOf(loaded.content),
      },
      references: [],
      tier: this.plans.effectiveTier(ctx, 'standard'),
      verifyCoding: true,
      edit: { target, instruction },
    };
    const { jobId } = await this.jobs.enqueueEditJob(actor, ctx, input, {
      // Planning plus a handful of item edits; unused credits are released.
      estimate: Math.min(60, 16 + Math.ceil(itemCount / 3)),
      conversationId,
      parentJobId,
    });
    return {
      jobId,
      title: loaded.title,
      kind: loaded.kind,
      target: target.type,
      live: loaded.live,
    };
  }

  // ── Run (queue processor) ────────────────────────────────────────────────

  async run(
    actor: AiActor,
    input: AiJobInput,
    progress: AiJobProgress,
    publish: () => Promise<void>,
    charge: ChargeFn,
    signal: AbortSignal,
  ): Promise<AiJobResult> {
    const edit = input.edit;
    if (!edit) throw new BadRequestException('Missing edit details.');
    const loaded = await this.load(actor, edit.target);
    const ctx = await this.plans.resolve(actor);
    const allowed = this.allowedTypes(ctx, loaded.kind);
    const maxItems = this.plans.limit(ctx, 'aiMaxQuestionsPerGeneration');
    const maxNewItems = maxItems < 0 ? 20 : Math.min(20, maxItems);

    progress.stage = 'outline';
    progress.message = `Reading ${loaded.title}…`;
    await publish();

    const plan = await this.generation.planEdit(
      {
        outline: this.outline(loaded.content),
        instruction: edit.instruction,
        allowedTypes: allowed,
        maxNewItems,
        tier: input.tier === 'pro' ? 'pro' : 'standard',
      },
      charge,
      signal,
    );

    const operations = plan.operations.slice(0, MAX_OPERATIONS);
    const changes = await this.buildChanges(
      loaded,
      operations,
      plan,
      input,
      allowed,
      maxNewItems,
      {
        progress,
        publish,
        charge,
        signal,
      },
    );
    const summary = plainText(plan.summary, 600) || 'No changes were needed.';

    if (loaded.ref.type === 'draft' && loaded.draft) {
      return {
        type: 'draft',
        draft: this.applyToDraft(loaded, changes),
        edit: { summary, changes },
      };
    }
    const changeset: ChangeSet = {
      target: {
        ...loaded.ref,
        kind: loaded.kind,
        title: loaded.title,
        live: loaded.live,
      },
      summary,
      changes,
    };
    return { type: 'changeset', changeset };
  }

  private outline(content: EditableContent): string {
    const lines = [
      `Title: ${content.title}`,
      `Description: ${plainText(content.description, 300)}`,
    ];
    for (const section of content.sections) {
      lines.push(`Section [id: ${section.id}] "${section.title}"`);
      section.items.forEach((item) => {
        const excerpt = plainText(
          item.problemStatement ||
            item.readingConfig?.contentBlocks
              ?.map((b) => b.content || '')
              .join(' ') ||
            '',
          140,
        );
        lines.push(
          `  - [id: ${item.id}] ${item.type}, ${item.difficulty}, ${item.marks} pt: "${item.title}"${excerpt ? ` — ${excerpt}` : ''}`,
        );
      });
    }
    return lines.join('\n');
  }

  private withIds(item: GeneratedQuestion): GeneratedQuestion {
    const id = randomUUID();
    return {
      ...item,
      id,
      options: item.options?.map((o, i) => ({ ...o, id: `opt-${id}-${i}` })),
    };
  }

  private async verify(
    question: GeneratedQuestion,
  ): Promise<GeneratedQuestion> {
    if (question.type !== 'Coding' || question.aiMeta.issues.length)
      return question;
    const verification = await this.verifier.verify(question);
    return {
      ...question,
      aiMeta:
        verification.status === 'verified'
          ? { status: 'verified', issues: [] }
          : verification.status === 'unavailable'
            ? { status: 'unverified', issues: ['code runner unavailable'] }
            : { status: 'needs_review', issues: verification.failures },
    };
  }

  private async buildChanges(
    loaded: LoadedTarget,
    operations: EditOperation[],
    plan: { details?: { title?: string; description?: string } },
    input: AiJobInput,
    allowed: QuestionType[],
    maxNewItems: number,
    run: {
      progress: AiJobProgress;
      publish: () => Promise<void>;
      charge: ChargeFn;
      signal: AbortSignal;
    },
  ): Promise<EditChange[]> {
    const { content } = loaded;
    const find = (itemId?: string) => {
      for (const section of content.sections) {
        const index = section.items.findIndex((i) => i.id === itemId);
        if (index !== -1) return { section, index, item: section.items[index] };
      }
      return null;
    };
    const sectionById = (id?: string) =>
      content.sections.find((s) => s.id === id);

    const changes: EditChange[] = [];
    const newSections = new Map<
      string,
      { id: string; title: string; index: number; plans: BlueprintQuestion[] }
    >();
    const addsBySection = new Map<
      string,
      { position?: number; plan: BlueprintQuestion }[]
    >();
    const touched = new Set<string>();
    let newItems = 0;

    const aiSteps = operations.filter(
      (o) => o.op === 'edit_item' || o.op === 'add_item',
    ).length;
    run.progress.stage = 'sections';
    run.progress.total = aiSteps;
    run.progress.completed = 0;
    const step = async (message: string) => {
      run.progress.message = message;
      await run.publish();
    };

    for (const op of operations) {
      if (run.signal.aborted) break;
      switch (op.op) {
        case 'edit_item': {
          const found = find(op.itemId);
          if (!found || touched.has(found.item.id)) break;
          touched.add(found.item.id);
          await step(`Editing "${found.item.title}"…`);
          const edited = await this.generation.runQuestionOp(
            {
              op: 'edit',
              question: found.item,
              instruction:
                plainText(op.instruction || '', 800) ||
                plainText(input.edit?.instruction || '', 800),
              tier: input.tier,
              allowedTypes: [found.item.type],
              signal: run.signal,
            },
            run.charge,
            'item',
          );
          const after = await this.verify({ ...edited, id: found.item.id });
          changes.push({
            id: randomUUID(),
            kind: 'edit_item',
            summary: `Edited "${found.item.title}"`,
            sectionId: found.section.id,
            itemId: found.item.id,
            before: found.item,
            after,
          });
          run.progress.completed += 1;
          break;
        }
        case 'remove_item': {
          const found = find(op.itemId);
          if (!found || touched.has(found.item.id)) break;
          touched.add(found.item.id);
          changes.push({
            id: randomUUID(),
            kind: 'remove_item',
            summary: `Removed "${found.item.title}"`,
            sectionId: found.section.id,
            index: found.index,
            before: found.item,
          });
          break;
        }
        case 'move_item': {
          const found = find(op.itemId);
          const to = sectionById(op.sectionId);
          if (!found || !to || touched.has(found.item.id)) break;
          touched.add(found.item.id);
          changes.push({
            id: randomUUID(),
            kind: 'move_item',
            summary: `Moved "${found.item.title}" to "${to.title}"`,
            itemId: found.item.id,
            from: { sectionId: found.section.id, index: found.index },
            to: { sectionId: to.id, index: op.position ?? to.items.length },
          });
          break;
        }
        case 'rename_section': {
          const section = sectionById(op.sectionId);
          const title = plainText(op.title || '', 160);
          if (!section || !title || title === section.title) break;
          changes.push({
            id: randomUUID(),
            kind: 'rename_section',
            summary: `Renamed "${section.title}" to "${title}"`,
            sectionId: section.id,
            before: section.title,
            after: title,
          });
          break;
        }
        case 'remove_section': {
          const index = content.sections.findIndex(
            (s) => s.id === op.sectionId,
          );
          if (index === -1 || loaded.flat) break;
          const section = content.sections[index];
          changes.push({
            id: randomUUID(),
            kind: 'remove_section',
            summary: `Removed the section "${section.title}"`,
            sectionId: section.id,
            index,
            before: { title: section.title, items: section.items },
          });
          break;
        }
        case 'add_section': {
          const ref = op.newSectionRef?.trim();
          const title = plainText(op.title || '', 160);
          if (!ref || !title || newSections.has(ref) || loaded.flat) break;
          newSections.set(ref, {
            id: randomUUID(),
            title,
            index: op.position ?? content.sections.length,
            plans: [],
          });
          break;
        }
        case 'add_item': {
          if (newItems >= maxNewItems) break;
          const type = allowed.find(
            (t) => t.toLowerCase() === String(op.type || '').toLowerCase(),
          );
          if (!type || !op.title) break;
          const plan = this.generation.normalizeBlueprintQuestion(
            {
              type,
              title: op.title,
              intent: op.intent || op.title,
              difficulty: op.difficulty || 'Medium',
              marks: op.marks ?? (type === 'Coding' ? 10 : 1),
            },
            allowed,
            type,
          );
          const pending = newSections.get(op.sectionId || '');
          if (pending) pending.plans.push(plan);
          else if (sectionById(op.sectionId)) {
            const list = addsBySection.get(op.sectionId as string) ?? [];
            list.push({ position: op.position, plan });
            addsBySection.set(op.sectionId as string, list);
          } else break;
          newItems += 1;
          break;
        }
      }
    }

    const writeSection = async (title: string, plans: BlueprintQuestion[]) => {
      await step(
        `Writing ${plans.length} new item${plans.length === 1 ? '' : 's'} for "${title}"…`,
      );
      const section = await this.generation.generateSection(
        {
          brief: {
            ...input.brief,
            types: [...new Set(plans.map((p) => p.type))],
          },
          title: loaded.content.title,
          description: loaded.content.description,
          section: { id: 'edit', title, summary: title, questions: plans },
          tier: input.tier,
          verifyCoding: input.verifyCoding,
          signal: run.signal,
        },
        run.charge,
      );
      run.progress.completed += plans.length;
      return section.questions.map((q) => this.withIds(q));
    };

    for (const [sectionId, adds] of addsBySection) {
      if (run.signal.aborted) break;
      const section = sectionById(sectionId);
      if (!section) continue;
      const written = await writeSection(
        section.title,
        adds.map((a) => a.plan),
      );
      written.forEach((item, i) => {
        changes.push({
          id: randomUUID(),
          kind: 'add_item',
          summary: `Added "${item.title}" to "${section.title}"`,
          sectionId,
          index: adds[i]?.position ?? section.items.length + i,
          after: item,
        });
      });
    }

    for (const pending of newSections.values()) {
      if (run.signal.aborted) break;
      const items = pending.plans.length
        ? await writeSection(pending.title, pending.plans)
        : [];
      changes.push({
        id: randomUUID(),
        kind: 'add_section',
        summary: `Added the section "${pending.title}"${items.length ? ` with ${items.length} item${items.length === 1 ? '' : 's'}` : ''}`,
        sectionId: pending.id,
        index: pending.index,
        title: pending.title,
        items,
      });
    }

    const title = plainText(plan.details?.title || '', 200);
    const description = plainText(plan.details?.description || '', 1000);
    if (
      (title && title !== content.title) ||
      (description && description !== content.description)
    ) {
      changes.push({
        id: randomUUID(),
        kind: 'update_details',
        summary: 'Updated the title and description',
        before: { title: content.title, description: content.description },
        after: {
          title: title || content.title,
          description: description || content.description,
        },
      });
    }

    return changes;
  }

  private applyToDraft(loaded: LoadedTarget, changes: EditChange[]): AiDraft {
    const draft = loaded.draft as AiDraft;
    const meta = new Map<string, GeneratedQuestion['aiMeta']>();
    draft.sections.forEach((s) =>
      s.questions.forEach((q) => meta.set(q.id, q.aiMeta)),
    );
    for (const change of changes) {
      if (change.kind === 'edit_item' || change.kind === 'add_item')
        meta.set(change.after.id, change.after.aiMeta);
      if (change.kind === 'add_section')
        change.items.forEach((i) => meta.set(i.id, i.aiMeta));
    }

    const content: EditableContent = structuredClone(loaded.content);
    for (const change of changes) applyChange(content, change);

    const sections = content.sections.map((s) => ({
      id: s.id,
      title: s.title,
      questions: s.items.map((q) => ({ ...q, aiMeta: meta.get(q.id) ?? ok })),
    }));
    const questions = sections.flatMap((s) => s.questions);
    return {
      ...draft,
      title: content.title,
      description: content.description,
      sections,
      totalMarks: questions.reduce((acc, q) => acc + (q.marks || 0), 0),
      stats: {
        questions: questions.length,
        verified: questions.filter((q) => q.aiMeta.status === 'verified')
          .length,
        needsReview: questions.filter((q) => q.aiMeta.status === 'needs_review')
          .length,
      },
    };
  }

  // ── Apply / undo ─────────────────────────────────────────────────────────

  private async changesetJob(actor: AiActor, jobId: string) {
    const job = await this.prisma.aiJob.findFirst({
      where: {
        id: jobId,
        userId: actor.userId,
        kind: 'edit',
        status: 'completed',
      },
      select: { id: true, result: true },
    });
    const result = job?.result as AiJobResult | null | undefined;
    if (!job || result?.type !== 'changeset') {
      throw new NotFoundException('Those changes could not be found.');
    }
    return { id: job.id, changeset: result.changeset };
  }

  private async save(
    actor: AiActor,
    loaded: LoadedTarget,
    content: EditableContent,
  ) {
    const user = this.user(actor);
    const sections = content.sections.map((s) => ({
      id: s.id,
      title: s.title,
      questions: s.items,
    }));
    const titleChanged = content.title !== loaded.content.title;
    const descriptionChanged =
      content.description !== loaded.content.description;

    if (loaded.kind === 'course') {
      // The builder's own save path: access, plan limits and question-type
      // rules apply, and units are updated in place by id.
      await this.teacherCourses.updateCourse(loaded.ref.id, user, {
        sections,
        ...(titleChanged ? { title: content.title } : {}),
        ...(descriptionChanged
          ? { shortDescription: content.description }
          : {}),
      });
      return;
    }

    // Exams: write only the questions (and marks/title). updateExam treats
    // missing fields as "clear" (schedule, limits), so it can't take a partial.
    await this.teacher.checkAccess(
      await this.prisma.exam.findUnique({ where: { id: loaded.ref.id } }),
      user,
    );
    const stored = loaded.flat ? (sections[0]?.questions ?? []) : sections;
    await this.teacher.enforceQuestionTypeAccess(
      user,
      collectQuestionTypesFromExamContent(stored),
      loaded.orgId || user.orgId,
    );
    const totalMarks = sections.reduce(
      (acc, s) =>
        acc +
        s.questions.reduce(
          (a, q) => a + (Number(q.marks) || (q.type === 'Coding' ? 10 : 1)),
          0,
        ),
      0,
    );
    await this.prisma.exam.update({
      where: { id: loaded.ref.id },
      data: {
        questions: stored as unknown as Prisma.InputJsonValue,
        totalMarks: totalMarks || undefined,
        ...(titleChanged ? { title: content.title } : {}),
        ...(descriptionChanged
          ? { shortDescription: content.description }
          : {}),
      },
    });
    if (loaded.slug) await this.teacherExams.invalidateExamCaches(loaded.slug);
    await this.teacher.invalidateTeacherExamListCache(user);
  }

  private async applyChanges(
    actor: AiActor,
    changeset: ChangeSet,
    changes: EditChange[],
  ): Promise<{
    applied: string[];
    skipped: { id: string; summary: string; reason: string }[];
  }> {
    const loaded = await this.load(actor, changeset.target);
    const content: EditableContent = structuredClone(loaded.content);
    const applied: string[] = [];
    const skipped: { id: string; summary: string; reason: string }[] = [];
    for (const change of changes) {
      const outcome = applyChange(content, change);
      if (outcome.ok) applied.push(change.id);
      else
        skipped.push({
          id: change.id,
          summary: change.summary,
          reason: outcome.reason,
        });
    }
    if (applied.length) await this.save(actor, loaded, content);
    return { applied, skipped };
  }

  private async updateChangeset(jobId: string, changeset: ChangeSet) {
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        result: {
          type: 'changeset',
          changeset,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async apply(actor: AiActor, jobId: string, body: unknown) {
    const { changeIds } = applySchema.parse(body ?? {});
    const { changeset } = await this.changesetJob(actor, jobId);
    if (changeset.applied && !changeset.undone) {
      throw new ConflictException('These changes have already been applied.');
    }
    const selected = changeIds
      ? changeset.changes.filter((c) => changeIds.includes(c.id))
      : changeset.changes;
    if (!selected.length)
      throw new BadRequestException('Choose at least one change to apply.');

    const result = await this.applyChanges(actor, changeset, selected);
    if (result.applied.length) {
      await this.updateChangeset(jobId, {
        ...changeset,
        applied: { at: new Date().toISOString(), changeIds: result.applied },
        undone: undefined,
      });
    }
    return result;
  }

  async undo(actor: AiActor, jobId: string) {
    const { changeset } = await this.changesetJob(actor, jobId);
    if (!changeset.applied || changeset.undone) {
      throw new ConflictException('There is nothing to undo.');
    }
    const applied = changeset.changes.filter((c) =>
      changeset.applied?.changeIds.includes(c.id),
    );
    const inverse = [...applied].reverse().map(invertChange);
    const result = await this.applyChanges(actor, changeset, inverse);
    if (result.applied.length) {
      await this.updateChangeset(jobId, {
        ...changeset,
        undone: { at: new Date().toISOString() },
      });
    }
    return result;
  }

  /** Links a draft to the course or exam it was saved as, so later edits target that. */
  async markSaved(actor: AiActor, jobId: string, body: unknown) {
    const savedAs = savedSchema.parse(body ?? {});
    const { result } = await this.draftJob(actor, jobId);
    // Only link content the teacher can actually edit.
    await this.load(actor, { type: savedAs.kind, id: savedAs.id });
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        result: { ...result, savedAs } as unknown as Prisma.InputJsonValue,
      },
    });
    return { ok: true };
  }

  /** Compact list of this conversation's drafts, for the chat model's context. */
  async conversationDrafts(
    actor: AiActor,
    conversationId: string,
  ): Promise<string> {
    const jobs = await this.prisma.aiJob.findMany({
      where: { conversationId, userId: actor.userId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, result: true, input: true },
      take: 20,
    });
    const superseded = new Set(
      jobs
        .map((j) => (j.input as { parentJobId?: string } | null)?.parentJobId)
        .filter(Boolean),
    );
    const lines = jobs
      .filter(
        (j) =>
          (j.result as AiJobResult | null)?.type === 'draft' &&
          !superseded.has(j.id),
      )
      .slice(0, 6)
      .map((j) => {
        const result = j.result as unknown as Extract<
          AiJobResult,
          { type: 'draft' }
        >;
        const items = result.draft.sections.reduce(
          (acc, s) => acc + s.questions.length,
          0,
        );
        const saved = result.savedAs
          ? `; saved as ${result.savedAs.kind} ${result.savedAs.id}`
          : '';
        return `- draft ${j.id}: ${result.draft.kind} "${result.draft.title}" (${items} items${saved})`;
      });
    return lines.join('\n');
  }
}
