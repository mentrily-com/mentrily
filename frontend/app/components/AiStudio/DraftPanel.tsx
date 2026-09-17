'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ExternalLink, Loader2, Lock, PenLine, Sparkles, X } from 'lucide-react';
import { useAiJob, useAiUsage, useRefreshAiUsage } from '@/hooks/useAi';
import { AiService } from '@/services/api/AiService';
import { TeacherService } from '@/services/api/TeacherService';
import { creditsLabel, estimateWriteCredits } from '@/lib/ai/credits';
import { draftToCourse, draftToExam, hasUnsavedBuilderDraft, stageDraftForBuilder } from '@/lib/ai/draft';
import type { AiJob, Blueprint } from '@/lib/ai/types';
import BlueprintEditor from '@/app/components/AiShared/BlueprintEditor';
import GenerationProgress from '@/app/components/AiShared/GenerationProgress';
import DraftReview from '@/app/components/AiShared/DraftReview';
import ChangeSetReview from './ChangeSetReview';

export default function DraftPanel({
    jobId,
    conversationId,
    onClose,
    onChildJob,
    onError,
    onLocked,
    parentJobId,
    onOpenJob,
}: {
    jobId: string;
    conversationId: string | null;
    onClose: () => void;
    onChildJob: (parentId: string, childId: string) => void;
    onError: (err: unknown) => void;
    onLocked: (message: string, title?: string) => void;
    parentJobId?: string;
    onOpenJob: (jobId: string) => void;
}) {
    const router = useRouter();
    const { data: job, refetch } = useAiJob(jobId);
    const { data: usage } = useAiUsage();
    const refreshUsage = useRefreshAiUsage();
    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<'write' | 'save' | 'open' | null>(null);
    const [saved, setSaved] = useState<{ id: string; kind: 'course' | 'exam' } | null>(null);
    const [confirmReplace, setConfirmReplace] = useState(false);

    useEffect(() => {
        setBlueprint(null);
        setSelected(new Set());
        setSaved(null);
        setConfirmReplace(false);
    }, [jobId]);

    useEffect(() => {
        if (job?.result?.type === 'blueprint' && !blueprint) setBlueprint(job.result.blueprint);
        if (job?.result?.type === 'draft' && selected.size === 0) {
            setSelected(new Set(job.result.draft.sections.flatMap((s) => s.questions.map((q) => q.id))));
        }
        if (job?.result?.type === 'draft' && job.result.savedAs && !saved) setSaved(job.result.savedAs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [job?.result]);

    const draft = job?.result?.type === 'draft' ? job.result.draft : null;
    const edit = job?.result?.type === 'draft' ? job.result.edit : undefined;
    const changeset = job?.result?.type === 'changeset' ? job.result.changeset : null;
    const noun = (job?.brief?.kind ?? draft?.kind ?? 'course') === 'exam' ? 'exam' : 'course';
    const maxQuestions = usage?.limits.maxQuestionsPerGeneration ?? 40;
    const running = !job || job.status === 'queued' || job.status === 'running';

    const write = async () => {
        if (!job?.brief || !blueprint) return;
        if (usage && !usage.features.aiExams) {
            onLocked(
                `Writing full ${noun}s with AI is available on the Starter plan and above. Your outline is kept here.`,
                'Available on Starter plan',
            );
            return;
        }
        setBusy('write');
        try {
            const res = await AiService.createJob({
                kind: 'generate',
                brief: job.brief,
                blueprint,
                references: job.references,
                conversationId: conversationId ?? undefined,
                parentJobId: job.id,
            });
            onChildJob(job.id, res.jobId);
            void refreshUsage();
        } catch (err) {
            onError(err);
        } finally {
            setBusy(null);
        }
    };

    const retry = async (failed: AiJob) => {
        if (!failed.brief) return;
        setBusy('write');
        try {
            const res = await AiService.createJob({
                kind: failed.kind === 'generate' ? 'blueprint' : failed.kind,
                brief: failed.brief,
                references: failed.references,
                conversationId: conversationId ?? undefined,
            });
            onChildJob(failed.id, res.jobId);
        } catch (err) {
            onError(err);
        } finally {
            setBusy(null);
        }
    };

    const saveDraft = async () => {
        if (!draft) return;
        setBusy('save');
        try {
            const res =
                draft.kind === 'exam'
                    ? await TeacherService.createExam(draftToExam(draft, selected))
                    : await TeacherService.createCourse(draftToCourse(draft, selected));
            const savedAs = { id: res.id, kind: draft.kind };
            setSaved(savedAs);
            // Later chat edits go to the saved course or exam instead of this draft.
            void AiService.markDraftSaved(jobId, savedAs).catch(() => undefined);
        } catch (err) {
            onError(err);
        } finally {
            setBusy(null);
        }
    };

    const openInBuilder = (force = false) => {
        if (!draft) return;
        if (!force && hasUnsavedBuilderDraft(draft.kind)) {
            setConfirmReplace(true);
            return;
        }
        setBusy('open');
        router.push(stageDraftForBuilder(draft, selected));
    };

    const title =
        changeset?.target.title ??
        draft?.title ??
        blueprint?.title ??
        job?.brief?.topic ??
        (job?.kind === 'quiz' ? 'Quiz' : job?.kind === 'edit' ? 'Edit' : 'Generation');
    const label = changeset
        ? 'Proposed changes'
        : draft
          ? `${noun === 'exam' ? 'Exam' : 'Course'} draft${edit ? ', new version' : ''}`
          : blueprint
            ? 'Outline'
            : job?.kind === 'edit'
              ? 'Editing'
              : 'Generating';

    return (
        <aside className="flex h-full min-h-0 flex-col bg-white">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                    <p className="text-xs text-slate-500">{label}</p>
                    <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close panel"
                >
                    <X size={18} />
                </button>
            </header>

            {changeset && job ? (
                <ChangeSetReview
                    key={job.id}
                    jobId={job.id}
                    changeset={changeset}
                    onError={onError}
                    onChanged={() => void refetch()}
                />
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    {!job ? (
                        <Loader2 className="mx-auto mt-10 animate-spin text-slate-300" />
                    ) : job.status === 'failed' || job.status === 'cancelled' ? (
                        <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm">
                            <p className="flex items-start gap-2 text-rose-800">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                {job.status === 'cancelled' ? 'This generation was cancelled.' : job.error}
                            </p>
                            <p className="text-xs text-rose-700/80">Credits were only charged for completed work.</p>
                            {job.kind === 'edit' ? (
                                <p className="text-xs text-rose-700/80">
                                    Describe the change again in the chat to retry.
                                </p>
                            ) : job.kind === 'generate' ? (
                                parentJobId && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenJob(parentJobId)}
                                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                                    >
                                        Back to outline
                                    </button>
                                )
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => retry(job)}
                                    disabled={busy !== null}
                                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                                >
                                    Try again
                                </button>
                            )}
                        </div>
                    ) : running ? (
                        <GenerationProgress
                            job={job}
                            onCancel={async () => {
                                await AiService.cancelJob(job.id).catch(onError);
                                void refetch();
                            }}
                        />
                    ) : blueprint && job.result?.type === 'blueprint' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">Adjust the outline, then write the full {noun}.</p>
                            <BlueprintEditor
                                blueprint={blueprint}
                                onChange={setBlueprint}
                                maxQuestions={maxQuestions}
                            />
                        </div>
                    ) : draft ? (
                        <div className="space-y-4">
                            {edit && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                    <p className="flex items-start gap-2">
                                        <PenLine size={14} className="mt-1 shrink-0 text-slate-400" />
                                        <span>
                                            {edit.changes.length
                                                ? edit.summary
                                                : 'No changes were needed. This version matches the previous one.'}
                                        </span>
                                    </p>
                                    {edit.changes.length > 0 && (
                                        <ul className="mt-2 space-y-0.5 pl-6 text-xs text-slate-500">
                                            {edit.changes.slice(0, 8).map((c) => (
                                                <li key={c.id}>{c.summary}</li>
                                            ))}
                                            {edit.changes.length > 8 && <li>and {edit.changes.length - 8} more</li>}
                                        </ul>
                                    )}
                                    {parentJobId && (
                                        <button
                                            type="button"
                                            onClick={() => onOpenJob(parentJobId)}
                                            className="mt-2 pl-6 text-xs font-medium text-slate-600 underline hover:text-slate-900"
                                        >
                                            See the previous version
                                        </button>
                                    )}
                                </div>
                            )}
                            {saved ? (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                    Saved as a draft {saved.kind}.{' '}
                                    <Link
                                        href={`/dashboard/creator/${saved.kind === 'exam' ? 'exams' : 'courses'}/${saved.id}/edit`}
                                        className="inline-flex items-center gap-1 font-semibold underline"
                                    >
                                        Open it <ExternalLink size={12} />
                                    </Link>
                                </div>
                            ) : null}
                            {confirmReplace && (
                                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    <p>
                                        The {noun} builder has an unsaved new {noun}. Opening this draft replaces it.
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmReplace(false)}
                                            className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-medium"
                                        >
                                            Keep it
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openInBuilder(true)}
                                            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white"
                                        >
                                            Replace and open
                                        </button>
                                    </div>
                                </div>
                            )}
                            <DraftReview draft={draft} selected={selected} onSelectedChange={setSelected} />
                        </div>
                    ) : null}
                </div>
            )}

            {job?.status === 'completed' && !changeset && (blueprint || draft) && (
                <footer className="border-t border-slate-100 px-5 py-4">
                    {job.result?.type === 'blueprint' && blueprint ? (
                        <button
                            type="button"
                            onClick={write}
                            disabled={busy !== null}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-50"
                        >
                            {busy === 'write' ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : usage && !usage.features.aiExams ? (
                                <Lock size={15} />
                            ) : (
                                <Sparkles size={16} />
                            )}
                            Write {noun}
                            <span className="font-normal tabular-nums text-white/75">
                                about {creditsLabel(estimateWriteCredits(blueprint))}
                            </span>
                        </button>
                    ) : draft ? (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={saveDraft}
                                disabled={busy !== null || selected.size === 0 || Boolean(saved)}
                                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                                {busy === 'save' ? 'Saving…' : saved ? 'Saved' : 'Save as draft'}
                            </button>
                            <button
                                type="button"
                                onClick={() => openInBuilder()}
                                disabled={busy !== null || selected.size === 0}
                                className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-50"
                            >
                                {busy === 'open' ? 'Opening…' : 'Open in builder'}
                            </button>
                        </div>
                    ) : null}
                </footer>
            )}
        </aside>
    );
}
