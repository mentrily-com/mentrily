'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useAiJob, useAiUsage, useRefreshAiUsage } from '@/hooks/useAi';
import { AiService } from '@/services/api/AiService';
import { DEFAULT_TYPES } from '@/lib/ai/questionTypes';
import { creditsLabel, estimateOutlineCredits, estimateWriteCredits } from '@/lib/ai/credits';
import { fitToQuestionLimit } from '@/lib/ai/limits';
import { draftToSections } from '@/lib/ai/draft';
import type { AiBrief, AiKind, AiQuality, AiReference, Blueprint } from '@/lib/ai/types';
import BriefFields from '@/app/components/AiShared/BriefFields';
import BlueprintEditor from '@/app/components/AiShared/BlueprintEditor';
import GenerationProgress from '@/app/components/AiShared/GenerationProgress';
import DraftReview from '@/app/components/AiShared/DraftReview';
import UsageMeter from '@/app/components/AiShared/UsageMeter';
import { useAiErrorGate } from '@/app/components/AiShared/useAiErrorGate';
import type { Section } from '../types';
import type { AiImportTypeInfo, NormalizeStats } from '../aiImport';
import JsonImportPanel from './JsonImportPanel';

type Step = 'brief' | 'outline' | 'write' | 'review';
const STEPS: { id: Step; label: string }[] = [
    { id: 'brief', label: 'Brief' },
    { id: 'outline', label: 'Outline' },
    { id: 'write', label: 'Write' },
    { id: 'review', label: 'Review' },
];

interface DrawerState {
    step: Step;
    brief: AiBrief;
    references: AiReference[];
    quality: AiQuality;
    outlineJobId: string | null;
    blueprint: Blueprint | null;
    writeJobId: string | null;
}

const initialState = (kind: AiKind, references: AiReference[] = []): DrawerState => ({
    step: 'brief',
    brief: {
        kind,
        topic: '',
        audience: '',
        sections: kind === 'exam' ? 2 : 3,
        questionsPerSection: kind === 'exam' ? 5 : 4,
        types: DEFAULT_TYPES[kind],
        difficulty: 'Mixed',
        language: 'English',
        codingLanguages: ['python'],
    },
    references,
    quality: 'standard',
    outlineJobId: null,
    blueprint: null,
    writeJobId: null,
});

export interface AiDrawerProps {
    kind: AiKind;
    /** Stable per builder instance, so a running job resumes on reopen. */
    storageKey: string;
    availableTypes: AiImportTypeInfo[];
    defaultReferences?: AiReference[];
    onClose: () => void;
    onInsert: (sections: Section[], stats: NormalizeStats) => void;
}

export default function AiDrawer({ kind, storageKey, availableTypes, defaultReferences, onClose, onInsert }: AiDrawerProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    useModalA11y(panelRef, true, onClose);
    const { data: usage } = useAiUsage();
    const refreshUsage = useRefreshAiUsage();
    const { handleError, promptUpgrade, modal } = useAiErrorGate();
    const [tab, setTab] = useState<'generate' | 'import'>('generate');
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const noun = kind === 'exam' ? 'exam' : 'course';

    const [state, setState] = useState<DrawerState>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) return JSON.parse(saved) as DrawerState;
            } catch {
                // Ignore unreadable saved state.
            }
        }
        return initialState(kind, defaultReferences);
    });
    const patch = (next: Partial<DrawerState>) => setState((prev) => ({ ...prev, ...next }));

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch {
            // Storage full or disabled; the drawer still works for this session.
        }
    }, [state, storageKey]);

    const outlineJob = useAiJob(state.outlineJobId);
    const writeJob = useAiJob(state.writeJobId);

    // Adopt a finished outline as the editable blueprint.
    useEffect(() => {
        const job = outlineJob.data;
        if (job?.status === 'completed' && job.result?.type === 'blueprint' && !state.blueprint) {
            patch({ blueprint: job.result.blueprint });
        }
    }, [outlineJob.data, state.blueprint]);

    const draft = writeJob.data?.result?.type === 'draft' ? writeJob.data.result.draft : null;

    // Move to review when writing finishes, preselecting everything.
    useEffect(() => {
        if (draft && state.step === 'write') {
            setSelected(new Set(draft.sections.flatMap((s) => s.questions.map((q) => q.id))));
            patch({ step: 'review' });
        }
    }, [draft, state.step]);

    useEffect(() => {
        if (draft && state.step === 'review' && selected.size === 0) {
            setSelected(new Set(draft.sections.flatMap((s) => s.questions.map((q) => q.id))));
        }
        // Only on first arrival at review.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft]);

    const maxQuestions = usage?.limits.maxQuestionsPerGeneration ?? 40;

    // Once the plan is known, shrink an over-cap brief (e.g. the 3 × 4 default
    // on a 10-item plan) rather than opening on a blocking warning.
    useEffect(() => {
        if (!usage || state.step !== 'brief') return;
        const fitted = fitToQuestionLimit(state.brief, usage.limits.maxQuestionsPerGeneration);
        if (fitted !== state.brief) patch({ brief: fitted });
        // Only when the plan limits load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usage?.limits.maxQuestionsPerGeneration]);

    const canWrite = usage?.features.aiExams ?? false;
    const outlineCost = estimateOutlineCredits(state.brief);
    const writeCost = state.blueprint ? estimateWriteCredits(state.blueprint, state.quality) : 0;
    const briefValid =
        state.brief.topic.trim().length >= 3 &&
        state.brief.types.length > 0 &&
        (maxQuestions < 0 || state.brief.sections * state.brief.questionsPerSection <= maxQuestions);
    const blueprintCount = state.blueprint?.sections.reduce((acc, s) => acc + s.questions.length, 0) ?? 0;

    const startOutline = async () => {
        setBusy(true);
        try {
            const res = await AiService.createJob({
                kind: 'blueprint',
                brief: state.brief,
                references: state.references,
                quality: state.quality,
            });
            patch({ step: 'outline', outlineJobId: res.jobId, blueprint: null, writeJobId: null });
            void refreshUsage();
        } catch (err) {
            handleError(err);
        } finally {
            setBusy(false);
        }
    };

    const startWrite = async () => {
        if (!state.blueprint) return;
        if (!canWrite) {
            promptUpgrade(
                `Writing full ${noun}s with AI is available on the Starter plan and above. Your outline is saved here.`,
                'Available on Starter plan',
            );
            return;
        }
        setBusy(true);
        try {
            const res = await AiService.createJob({
                kind: 'generate',
                brief: state.brief,
                blueprint: state.blueprint,
                references: state.references,
                quality: state.quality,
                parentJobId: state.outlineJobId ?? undefined,
            });
            setSelected(new Set());
            patch({ step: 'write', writeJobId: res.jobId });
            void refreshUsage();
        } catch (err) {
            handleError(err);
        } finally {
            setBusy(false);
        }
    };

    const cancelJob = async (jobId: string | null) => {
        if (!jobId) return;
        try {
            await AiService.cancelJob(jobId);
            await (jobId === state.writeJobId ? writeJob.refetch() : outlineJob.refetch());
        } catch (err) {
            handleError(err);
        }
    };

    const insert = () => {
        if (!draft) return;
        const sections = draftToSections(draft, selected);
        const questions = sections.reduce((acc, s) => acc + s.questions.length, 0);
        onInsert(sections, {
            sectionsImported: sections.length,
            questionsImported: questions,
            questionsSkipped: draft.stats.questions - questions,
            skippedReasons: [],
        });
        // Clear storage synchronously: the builder usually closes the drawer in
        // this same event, so the persist effect never sees the reset state.
        try {
            localStorage.removeItem(storageKey);
        } catch {
            // Storage disabled; nothing persisted anyway.
        }
        setState(initialState(kind, defaultReferences));
        setSelected(new Set());
    };

    const reset = () => {
        setState(initialState(kind, defaultReferences));
        setSelected(new Set());
    };

    const stepIndex = STEPS.findIndex((s) => s.id === state.step);
    const outlineFailed = outlineJob.data && ['failed', 'cancelled'].includes(outlineJob.data.status);
    const writeFailed = writeJob.data && ['failed', 'cancelled'].includes(writeJob.data.status);

    const renderFooter = () => {
        switch (state.step) {
            case 'brief':
                return (
                    <button
                        type="button"
                        onClick={startOutline}
                        disabled={!briefValid || busy}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Generate outline
                        <span className="font-normal text-white/75 tabular-nums">about {creditsLabel(outlineCost)}</span>
                    </button>
                );
            case 'outline':
                return state.blueprint ? (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={startOutline}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            title="Discard this outline and generate a new one"
                        >
                            <RotateCcw size={15} /> Redo
                        </button>
                        <button
                            type="button"
                            onClick={startWrite}
                            disabled={busy || blueprintCount === 0 || (maxQuestions >= 0 && blueprintCount > maxQuestions)}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            Write {noun}
                            <span className="font-normal text-white/75 tabular-nums">about {creditsLabel(writeCost)}</span>
                        </button>
                    </div>
                ) : null;
            case 'review':
                return draft ? (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={reset}
                            className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Start over
                        </button>
                        <button
                            type="button"
                            onClick={insert}
                            disabled={selected.size === 0}
                            className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Insert {selected.size} item{selected.size === 1 ? '' : 's'}
                        </button>
                    </div>
                ) : null;
            default:
                return null;
        }
    };
    const footer = renderFooter();

    // Portal to <body>: builder layouts use transforms, which would otherwise
    // turn this fixed overlay into one clipped to the builder card.
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div className="fixed inset-0 z-[1500] flex justify-end">
            <button
                type="button"
                aria-label="Close AI panel"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]"
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Generate ${noun} content with AI`}
                tabIndex={-1}
                className="relative flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl focus:outline-none sm:rounded-l-3xl"
            >
                <header className="space-y-4 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                                <Sparkles size={18} className="text-[var(--brand)]" />
                                Generate with AI
                            </h2>
                            <div className="mt-1">
                                <UsageMeter compact />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-sm">
                        {(
                            [
                                { id: 'generate', label: 'Generate' },
                                { id: 'import', label: 'Import JSON' },
                            ] as const
                        ).map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                aria-pressed={tab === t.id}
                                className={`flex-1 rounded-lg py-1.5 font-medium transition ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    {tab === 'generate' && (
                        <ol className="flex items-center gap-2 text-xs" aria-label="Progress">
                            {STEPS.map((s, i) => (
                                <li key={s.id} className="flex items-center gap-2">
                                    <span
                                        className={`flex items-center gap-1.5 ${i === stepIndex ? 'font-semibold text-slate-900' : i < stepIndex ? 'text-[var(--brand-dark)]' : 'text-slate-400'}`}
                                        aria-current={i === stepIndex ? 'step' : undefined}
                                    >
                                        <span
                                            className={`grid h-5 w-5 place-items-center rounded-full text-[10px] tabular-nums ${i === stepIndex ? 'bg-slate-900 text-white' : i < stepIndex ? 'bg-[var(--color-brand-light)] text-[var(--brand-dark)]' : 'bg-slate-100 text-slate-400'}`}
                                        >
                                            {i + 1}
                                        </span>
                                        {s.label}
                                    </span>
                                    {i < STEPS.length - 1 && <span className="h-px w-4 bg-slate-200" aria-hidden />}
                                </li>
                            ))}
                        </ol>
                    )}
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {tab === 'import' ? (
                        <JsonImportPanel kind={kind} availableTypes={availableTypes} onImport={onInsert} />
                    ) : state.step === 'brief' ? (
                        <BriefFields
                            brief={state.brief}
                            onChange={(brief) => patch({ brief })}
                            usage={usage}
                            references={state.references}
                            onReferencesChange={(references) => patch({ references })}
                            quality={state.quality}
                            onQualityChange={(quality) => patch({ quality })}
                            onLocked={(message) => promptUpgrade(message)}
                        />
                    ) : state.step === 'outline' ? (
                        state.blueprint ? (
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={() => patch({ step: 'brief' })}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                                >
                                    <ArrowLeft size={13} /> Edit brief
                                </button>
                                <p className="text-sm text-slate-600">
                                    Rename, reorder or change items before the content is written.
                                </p>
                                <BlueprintEditor
                                    blueprint={state.blueprint}
                                    onChange={(blueprint) => patch({ blueprint })}
                                    maxQuestions={maxQuestions}
                                />
                                {!canWrite && (
                                    <p className="rounded-xl bg-[var(--brand-light)] px-3.5 py-3 text-sm text-slate-700">
                                        Writing the full {noun} needs the Starter plan or higher. Your outline stays here while you upgrade.
                                    </p>
                                )}
                            </div>
                        ) : outlineFailed ? (
                            <JobFailed
                                message={outlineJob.data?.error || 'The outline was cancelled.'}
                                onRetry={startOutline}
                                onBack={() => patch({ step: 'brief' })}
                            />
                        ) : outlineJob.data ? (
                            <GenerationProgress job={outlineJob.data} onCancel={() => cancelJob(state.outlineJobId)} />
                        ) : (
                            <Loader2 className="mx-auto mt-10 animate-spin text-slate-300" />
                        )
                    ) : state.step === 'write' ? (
                        writeFailed ? (
                            <JobFailed
                                message={writeJob.data?.error || 'Writing was cancelled.'}
                                onRetry={startWrite}
                                onBack={() => patch({ step: 'outline' })}
                            />
                        ) : writeJob.data ? (
                            <GenerationProgress job={writeJob.data} onCancel={() => cancelJob(state.writeJobId)} />
                        ) : (
                            <Loader2 className="mx-auto mt-10 animate-spin text-slate-300" />
                        )
                    ) : draft ? (
                        <DraftReview draft={draft} selected={selected} onSelectedChange={setSelected} />
                    ) : (
                        <Loader2 className="mx-auto mt-10 animate-spin text-slate-300" />
                    )}
                </div>

                {tab === 'generate' && footer && (
                    <footer className="border-t border-slate-100 px-5 py-4 sm:px-6">{footer}</footer>
                )}
            </div>
            {modal}
        </div>,
        document.body,
    );
}

function JobFailed({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
    return (
        <div className="space-y-4 rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
            <p className="flex items-start gap-2 text-sm text-rose-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {message}
            </p>
            <p className="text-xs text-rose-700/80">Credits are only charged for the work that was completed.</p>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                >
                    Go back
                </button>
                <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
