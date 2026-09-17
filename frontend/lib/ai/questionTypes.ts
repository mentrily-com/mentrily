import { BookOpen, CircleDot, Code2, Globe, ListChecks, NotebookPen, type LucideIcon } from 'lucide-react';
import type { AiGenerationType, AiKind, AiReviewStatus } from './types';

export interface AiTypeInfo {
    type: AiGenerationType;
    label: string;
    short: string;
    icon: LucideIcon;
    /** Plan feature that unlocks this type, mirroring the builders' add menus. */
    feature?: string;
}

export const AI_TYPES: Record<AiGenerationType, AiTypeInfo> = {
    Reading: { type: 'Reading', label: 'Reading lesson', short: 'Reading', icon: BookOpen },
    MCQ: { type: 'MCQ', label: 'Single choice', short: 'MCQ', icon: CircleDot },
    MultiSelect: { type: 'MultiSelect', label: 'Multiple choice', short: 'Multi', icon: ListChecks },
    Coding: { type: 'Coding', label: 'Coding exercise', short: 'Coding', icon: Code2, feature: 'coding' },
    Web: { type: 'Web', label: 'Web project', short: 'Web', icon: Globe, feature: 'webEditor' },
    Notebook: { type: 'Notebook', label: 'Python notebook', short: 'Notebook', icon: NotebookPen, feature: 'pythonNotebook' },
};

export const TYPES_FOR_KIND: Record<AiKind, AiGenerationType[]> = {
    course: ['Reading', 'MCQ', 'MultiSelect', 'Coding', 'Web', 'Notebook'],
    exam: ['MCQ', 'MultiSelect', 'Coding', 'Web', 'Notebook'],
};

export const DEFAULT_TYPES: Record<AiKind, AiGenerationType[]> = {
    course: ['Reading', 'MCQ'],
    exam: ['MCQ', 'MultiSelect'],
};

export const REVIEW_STATUS: Record<AiReviewStatus, { label: string; className: string; hint: string }> = {
    ok: {
        label: 'Ready',
        className: 'bg-slate-100 text-slate-600',
        hint: 'Passed all structure checks.',
    },
    verified: {
        label: 'Verified',
        className: 'bg-emerald-50 text-emerald-700',
        hint: 'The model solution passed every test case in the code runner.',
    },
    unverified: {
        label: 'Not run',
        className: 'bg-slate-100 text-slate-600',
        hint: 'The code runner was unavailable, so the solution was not executed.',
    },
    needs_review: {
        label: 'Needs review',
        className: 'bg-amber-50 text-amber-700',
        hint: 'Check this item before publishing.',
    },
};

export function difficultyOf(value: string | undefined) {
    return value === 'Easy' || value === 'Hard' ? value : 'Medium';
}
