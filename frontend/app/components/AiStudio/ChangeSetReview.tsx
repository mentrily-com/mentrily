'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    ArrowRightLeft,
    ChevronDown,
    ExternalLink,
    FolderPlus,
    FolderX,
    Loader2,
    Minus,
    PenLine,
    Plus,
    Type,
    Undo2,
} from 'lucide-react';
import { AiService, type EditApplyResult } from '@/services/api/AiService';
import { QuestionDetail } from '@/app/components/AiShared/DraftReview';
import type { ChangeSet, EditChange } from '@/lib/ai/types';

const ICON: Record<EditChange['kind'], React.ComponentType<{ size?: number; className?: string }>> = {
    edit_item: PenLine,
    add_item: Plus,
    remove_item: Minus,
    move_item: ArrowRightLeft,
    add_section: FolderPlus,
    remove_section: FolderX,
    rename_section: Type,
    update_details: Type,
};

function ChangeDetail({ change }: { change: EditChange }) {
    const [showBefore, setShowBefore] = useState(false);
    switch (change.kind) {
        case 'edit_item':
            return (
                <div className="space-y-2">
                    <QuestionDetail q={showBefore ? change.before : change.after} />
                    <button
                        type="button"
                        onClick={() => setShowBefore((v) => !v)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800"
                    >
                        {showBefore ? 'Show the new version' : 'Show the current version'}
                    </button>
                </div>
            );
        case 'add_item':
            return <QuestionDetail q={change.after} />;
        case 'remove_item':
            return <p className="text-sm text-slate-500 line-through">{change.before.title}</p>;
        case 'add_section':
            return (
                <ul className="space-y-1 text-sm text-slate-700">
                    {change.items.map((item) => (
                        <li key={item.id}>{item.title}</li>
                    ))}
                </ul>
            );
        case 'remove_section':
            return (
                <ul className="space-y-1 text-sm text-slate-500 line-through">
                    {change.before.items.map((item) => (
                        <li key={item.id}>{item.title}</li>
                    ))}
                </ul>
            );
        case 'rename_section':
            return (
                <p className="text-sm text-slate-600">
                    <span className="line-through">{change.before}</span> → {change.after}
                </p>
            );
        case 'update_details':
            return (
                <div className="space-y-1 text-sm text-slate-600">
                    <p>
                        <span className="font-medium text-slate-800">Title:</span> {change.after.title}
                    </p>
                    <p>
                        <span className="font-medium text-slate-800">Description:</span> {change.after.description}
                    </p>
                </div>
            );
        case 'move_item':
            return null;
    }
}

/** Review, apply and undo AI-proposed changes to a saved course or exam. */
export default function ChangeSetReview({
    jobId,
    changeset,
    onChanged,
    onError,
}: {
    jobId: string;
    changeset: ChangeSet;
    onChanged: () => void;
    onError: (err: unknown) => void;
}) {
    const { target, changes } = changeset;
    const applied = Boolean(changeset.applied && !changeset.undone);
    const noun = target.kind === 'exam' ? 'exam' : 'course';
    const [selected, setSelected] = useState<Set<string>>(() => new Set(changes.map((c) => c.id)));
    const [open, setOpen] = useState<string | null>(null);
    const [busy, setBusy] = useState<'apply' | 'undo' | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [outcome, setOutcome] = useState<EditApplyResult | null>(null);

    const appliedIds = useMemo(() => new Set(changeset.applied?.changeIds ?? []), [changeset.applied]);
    const builderHref = `/dashboard/creator/${target.kind === 'exam' ? 'exams' : 'courses'}/${target.id}/edit`;

    const run = async (kind: 'apply' | 'undo') => {
        setBusy(kind);
        setConfirming(false);
        try {
            const res =
                kind === 'apply' ? await AiService.applyEdit(jobId, [...selected]) : await AiService.undoEdit(jobId);
            setOutcome(res);
            onChanged();
        } catch (err) {
            onError(err);
        } finally {
            setBusy(null);
        }
    };

    const onApply = () => {
        if (target.live && !confirming) {
            setConfirming(true);
            return;
        }
        void run('apply');
    };

    if (!changes.length) {
        return (
            <div className="space-y-2 px-5 py-5">
                <p className="text-sm text-slate-700">{changeset.summary}</p>
                <p className="text-xs text-slate-500">
                    Nothing was changed. Try describing the change more specifically in the chat.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <p className="text-sm leading-6 text-slate-700">{changeset.summary}</p>

                {applied ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Applied {appliedIds.size} change{appliedIds.size === 1 ? '' : 's'} to your {noun}.
                    </div>
                ) : changeset.undone ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        These changes were undone. You can apply them again.
                    </div>
                ) : target.live ? (
                    <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <p>
                            This {noun} is live. Learners will see applied changes right away
                            {target.kind === 'exam'
                                ? '.'
                                : ", and removing items also removes learners' progress on them."}{' '}
                            You can undo afterwards.
                        </p>
                    </div>
                ) : null}

                {outcome && outcome.skipped.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-medium">
                            {outcome.skipped.length} change{outcome.skipped.length === 1 ? ' was' : 's were'} skipped:
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs">
                            {outcome.skipped.map((s) => (
                                <li key={s.id}>
                                    {s.summary}: {s.reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                    {changes.map((change) => {
                        const Icon = ICON[change.kind];
                        const isOpen = open === change.id;
                        const expandable = change.kind !== 'move_item';
                        return (
                            <li key={change.id}>
                                <div className="flex items-center gap-3 px-3 py-2.5">
                                    {applied ? (
                                        <span className="w-4 shrink-0" />
                                    ) : (
                                        <input
                                            type="checkbox"
                                            checked={selected.has(change.id)}
                                            onChange={(e) => {
                                                const next = new Set(selected);
                                                if (e.target.checked) next.add(change.id);
                                                else next.delete(change.id);
                                                setSelected(next);
                                            }}
                                            className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                                            aria-label={`Include: ${change.summary}`}
                                        />
                                    )}
                                    <Icon size={14} className="shrink-0 text-slate-400" />
                                    <button
                                        type="button"
                                        disabled={!expandable}
                                        onClick={() => setOpen(isOpen ? null : change.id)}
                                        aria-expanded={expandable ? isOpen : undefined}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
                                    >
                                        <span
                                            className={`min-w-0 flex-1 text-sm ${
                                                applied && !appliedIds.has(change.id)
                                                    ? 'text-slate-400'
                                                    : 'text-slate-800'
                                            }`}
                                        >
                                            {change.summary}
                                        </span>
                                        {expandable && (
                                            <ChevronDown
                                                size={15}
                                                className={`shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}
                                            />
                                        )}
                                    </button>
                                </div>
                                {isOpen && (
                                    <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                                        <ChangeDetail change={change} />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <footer className="border-t border-slate-100 px-5 py-4">
                {applied ? (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void run('undo')}
                            disabled={busy !== null}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                        >
                            {busy === 'undo' ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />}
                            Undo
                        </button>
                        <Link
                            href={builderHref}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]"
                        >
                            Open in builder <ExternalLink size={14} />
                        </Link>
                    </div>
                ) : confirming ? (
                    <div className="space-y-2">
                        <p className="text-sm text-slate-700">Learners will see these changes right away.</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void run('apply')}
                                className="flex-1 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]"
                            >
                                Apply now
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onApply}
                        disabled={busy !== null || selected.size === 0}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-50"
                    >
                        {busy === 'apply' && <Loader2 size={15} className="animate-spin" />}
                        Apply {selected.size} change{selected.size === 1 ? '' : 's'}
                    </button>
                )}
            </footer>
        </>
    );
}
