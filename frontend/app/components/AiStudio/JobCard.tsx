'use client';

import React from 'react';
import { AlertTriangle, ChevronRight, ClipboardCheck, GraduationCap, ListChecks, Loader2, PenLine } from 'lucide-react';
import { useAiJob } from '@/hooks/useAi';

export interface JobPartData {
    jobId: string;
    kind: 'blueprint' | 'generate' | 'quiz' | 'edit';
    briefKind: 'course' | 'exam';
    title: string;
    estimate?: number;
}

/** Chat card for a generation; follows the chain outline → written draft. */
export default function JobCard({
    data,
    childJobId,
    active,
    onOpen,
}: {
    data: JobPartData;
    childJobId?: string;
    active: boolean;
    onOpen: (jobId: string) => void;
}) {
    const effectiveId = childJobId ?? data.jobId;
    const { data: job } = useAiJob(effectiveId);
    const noun =
        data.kind === 'edit'
            ? 'Editing'
            : data.kind === 'quiz'
              ? 'Quiz'
              : data.briefKind === 'exam'
                ? 'Exam'
                : 'Course';
    const Icon =
        data.kind === 'edit'
            ? PenLine
            : data.kind === 'quiz'
              ? ListChecks
              : data.briefKind === 'exam'
                ? ClipboardCheck
                : GraduationCap;

    let line = 'Starting…';
    let action = 'Open';
    const running = !job || job.status === 'queued' || job.status === 'running';
    const failed = job && (job.status === 'failed' || job.status === 'cancelled');

    if (job) {
        if (running) {
            line = job.progress?.message || 'Working…';
            action = 'View progress';
        } else if (failed) {
            line = job.status === 'cancelled' ? 'Cancelled' : job.error || 'Generation failed';
            action = 'Details';
        } else if (job.result?.type === 'blueprint') {
            const count = job.result.blueprint.sections.reduce((acc, s) => acc + s.questions.length, 0);
            line = `Outline ready: ${job.result.blueprint.sections.length} sections, ${count} items`;
            action = 'Review outline';
        } else if (job.result?.type === 'draft' && job.result.edit) {
            const n = job.result.edit.changes.length;
            line = n ? `New version ready: ${n} change${n === 1 ? '' : 's'}` : 'No changes were needed';
            action = 'Review draft';
        } else if (job.result?.type === 'draft') {
            const { stats } = job.result.draft;
            line = `Draft ready: ${stats.questions} items${stats.verified ? `, ${stats.verified} verified` : ''}${stats.needsReview ? `, ${stats.needsReview} to review` : ''}`;
            action = 'Review draft';
        } else if (job.result?.type === 'changeset') {
            const { changes, applied, undone } = job.result.changeset;
            const n = changes.length;
            line =
                applied && !undone
                    ? `Applied ${applied.changeIds.length} change${applied.changeIds.length === 1 ? '' : 's'}`
                    : n
                      ? `${n} change${n === 1 ? '' : 's'} ready to review`
                      : 'No changes were needed';
            action = applied && !undone ? 'View' : 'Review changes';
        }
    }

    return (
        <button
            type="button"
            onClick={() => onOpen(effectiveId)}
            className={`group mt-3 flex w-full max-w-md items-center gap-3 rounded-2xl border bg-white p-3 text-left transition hover:border-[var(--color-border-brand)] ${
                active ? 'border-[var(--brand)] ring-4 ring-[var(--brand)]/10' : 'border-slate-200'
            }`}
        >
            <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${failed ? 'bg-rose-50 text-rose-600' : 'bg-[var(--color-brand-light)] text-[var(--brand-dark)]'}`}
            >
                {failed ? <AlertTriangle size={18} /> : <Icon size={18} />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">
                    {noun}: {data.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                    {running && <Loader2 size={12} className="shrink-0 animate-spin text-[var(--brand)]" />}
                    {line}
                </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-[var(--brand-dark)]">
                <span className="hidden sm:inline">{action}</span>
                <ChevronRight size={15} className="transition group-hover:translate-x-0.5" />
            </span>
        </button>
    );
}
