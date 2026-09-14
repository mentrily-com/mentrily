import type { Course, Question, Section } from '@/app/components/Authoring/types';
import type { AiDraft, GeneratedQuestion } from './types';

const rand = () => Math.random().toString(36).slice(2, 10);

function toQuestion(q: GeneratedQuestion): Question {
    const { aiMeta: _meta, ...question } = q;
    const id = `q-ai-${rand()}`;
    return {
        ...question,
        id,
        options: question.options?.map((o, i) => ({ ...o, id: `opt-${id}-${i}` })),
    };
}

/**
 * Builder sections from the items a teacher kept. `sequentialIds` gives the
 * first section the builders' default `sec-1` id for a brand-new course/exam.
 */
export function draftToSections(draft: AiDraft, selected?: Set<string>, sequentialIds = false): Section[] {
    return draft.sections
        .map((section, i) => ({
            id: sequentialIds ? `sec-${i + 1}` : `sec-ai-${rand()}`,
            title: section.title,
            questions: section.questions.filter((q) => !selected || selected.has(q.id)).map(toQuestion),
        }))
        .filter((section) => section.questions.length > 0);
}

export function draftToCourse(draft: AiDraft, selected?: Set<string>): Course {
    return {
        title: draft.title,
        shortDescription: draft.description.slice(0, 300),
        longDescription: draft.summary || draft.description,
        difficulty: 'Intermediate',
        tags: [],
        isVisible: false,
        status: 'Draft',
        sections: draftToSections(draft, selected, true),
        tests: [],
    };
}

export function draftToExam(draft: AiDraft, selected?: Set<string>): Partial<Course> {
    const sections = draftToSections(draft, selected, true);
    const totalMarks = sections.reduce((acc, s) => acc + s.questions.reduce((a, q) => a + (q.marks || 0), 0), 0);
    return {
        title: draft.title,
        shortDescription: draft.description.slice(0, 300),
        longDescription: draft.description,
        difficulty: 'Intermediate',
        tags: [],
        isVisible: false,
        sections,
        totalMarks,
        duration: Math.min(180, Math.max(15, Math.round(totalMarks * 1.5 / 5) * 5)),
    };
}

export const BUILDER_DRAFT_KEY = {
    course: 'course_builder_draft_new',
    exam: 'exam_builder_draft_new',
} as const;

export const BUILDER_NEW_PATH = {
    course: '/dashboard/creator/courses/create',
    exam: '/dashboard/creator/exams/new',
} as const;

/** True when the builder already holds an unsaved new draft that would be replaced. */
export function hasUnsavedBuilderDraft(kind: 'course' | 'exam'): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const raw = localStorage.getItem(BUILDER_DRAFT_KEY[kind]);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { title?: string; sections?: { questions?: unknown[] }[] };
        return Boolean(parsed?.title?.trim() || parsed?.sections?.some((s) => (s.questions?.length ?? 0) > 0));
    } catch {
        return false;
    }
}

/** Hands a draft to the builder through its existing local draft-restore. */
export function stageDraftForBuilder(draft: AiDraft, selected?: Set<string>): string {
    const payload = draft.kind === 'exam' ? draftToExam(draft, selected) : draftToCourse(draft, selected);
    localStorage.setItem(BUILDER_DRAFT_KEY[draft.kind], JSON.stringify(payload));
    return BUILDER_NEW_PATH[draft.kind];
}
