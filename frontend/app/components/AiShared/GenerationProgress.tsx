'use client';

import React from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { creditsLabel } from '@/lib/ai/credits';
import { AI_TYPES, REVIEW_STATUS } from '@/lib/ai/questionTypes';
import type { AiGenerationType, AiJob } from '@/lib/ai/types';

/**
 * Live view of a running generation: one row per section, a rail that fills
 * as sections finish, and each finished section's items listed as they land.
 */
export default function GenerationProgress({ job, onCancel }: { job: AiJob; onCancel?: () => void }) {
    const progress = job.progress;
    const sections = progress?.sections ?? [];
    const total = Math.max(1, progress?.total || sections.length || 1);
    const done = sections.filter((s) => s.status === 'done' || s.status === 'failed').length;
    const pct =
        job.status === 'completed'
            ? 100
            : progress?.stage === 'summary'
              ? 96
              : sections.length
                ? Math.max(6, Math.round((done / total) * 90))
                : 6;
    const active = job.status === 'queued' || job.status === 'running';

    return (
        <div className="space-y-5" aria-live="polite">
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                        {active && <Loader2 size={15} className="animate-spin text-[var(--brand)]" />}
                        {progress?.message || (job.status === 'queued' ? 'Waiting to start…' : 'Working…')}
                    </p>
                    {active && onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                            Cancel
                        </button>
                    )}
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className="text-xs tabular-nums text-slate-400">
                    {creditsLabel(progress?.creditsUsed ?? job.creditsUsed)} used so far
                </p>
            </div>

            {sections.length > 0 && (
                <ol className="space-y-3">
                    {sections.map((section, i) => (
                        <li key={section.id} className="relative pl-7">
                            <span
                                className={`absolute left-0 top-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold tabular-nums ${
                                    section.status === 'done'
                                        ? 'bg-[var(--brand)] text-white'
                                        : section.status === 'failed'
                                          ? 'bg-rose-100 text-rose-600'
                                          : section.status === 'running'
                                            ? 'bg-[var(--color-brand-light)] text-[var(--brand-dark)] ring-2 ring-[var(--brand)]/30'
                                            : 'bg-slate-100 text-slate-400'
                                }`}
                            >
                                {section.status === 'done' ? (
                                    <Check size={11} strokeWidth={3} />
                                ) : section.status === 'failed' ? (
                                    <AlertTriangle size={11} />
                                ) : (
                                    i + 1
                                )}
                            </span>
                            {i < sections.length - 1 && (
                                <span className="absolute left-[9px] top-6 h-[calc(100%-12px)] w-px bg-slate-200" aria-hidden />
                            )}
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-sm font-medium text-slate-900">{section.title}</p>
                                <span className="shrink-0 text-xs tabular-nums text-slate-400">
                                    {section.status === 'running'
                                        ? 'Writing…'
                                        : section.status === 'failed'
                                          ? 'Failed'
                                          : `${section.questionCount} items`}
                                </span>
                            </div>
                            {section.status === 'running' && (
                                <div className="mt-2 space-y-1.5" aria-hidden>
                                    {Array.from({ length: Math.min(section.questionCount, 3) }).map((_, k) => (
                                        <div
                                            key={k}
                                            className="h-3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none"
                                            style={{ width: `${88 - k * 17}%` }}
                                        />
                                    ))}
                                </div>
                            )}
                            {section.error && <p className="mt-1 text-xs text-rose-600">{section.error}</p>}
                            {section.preview && (
                                <ul className="mt-1.5 space-y-1">
                                    {section.preview.map((q, k) => {
                                        const info = AI_TYPES[q.type as AiGenerationType];
                                        const Icon = info?.icon;
                                        const status = REVIEW_STATUS[q.status] ?? REVIEW_STATUS.ok;
                                        return (
                                            <li key={k} className="flex items-center gap-2 text-xs text-slate-600">
                                                {Icon && <Icon size={12} className="shrink-0 text-slate-400" />}
                                                <span className="min-w-0 flex-1 truncate">{q.title}</span>
                                                {q.status !== 'ok' && (
                                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${status.className}`}>
                                                        {status.label}
                                                    </span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
