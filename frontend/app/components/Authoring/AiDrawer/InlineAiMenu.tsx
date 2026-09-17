'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import AppModal from '@/app/components/Common/AppModal';
import { useToast } from '@/app/components/Common/Toast';
import { useRefreshAiUsage } from '@/hooks/useAi';
import { AiService } from '@/services/api/AiService';
import { plainTextFromHtml } from '@/lib/ai/text';
import { REVIEW_STATUS } from '@/lib/ai/questionTypes';
import type { AiKind, GeneratedQuestion, QuestionOp } from '@/lib/ai/types';
import { useAiErrorGate } from '@/app/components/AiShared/useAiErrorGate';
import type { Question } from '../types';

const OPS: { op: QuestionOp; label: string; description: string; types?: Question['type'][] }[] = [
    { op: 'improve', label: 'Improve wording', description: 'Clearer, better formatted, same difficulty' },
    { op: 'harder', label: 'Make harder', description: 'Tests the same concept at a higher level' },
    { op: 'easier', label: 'Make easier', description: 'Tests the same concept at a lower level' },
    { op: 'distractors', label: 'Better wrong answers', description: 'More plausible distractors', types: ['MCQ', 'MultiSelect'] },
    { op: 'testcases', label: 'Rewrite test cases', description: 'Covers edge cases, checked in the code runner', types: ['Coding'] },
    { op: 'solution', label: 'Write the solution', description: 'A solution that passes every test', types: ['Coding'] },
    { op: 'regenerate', label: 'Rewrite from scratch', description: 'A fresh question on the same concept' },
];

const AI_TYPES = new Set<Question['type']>(['MCQ', 'MultiSelect', 'Coding', 'Web', 'Reading', 'Notebook']);

function Summary({ q }: { q: Question }) {
    const text = useMemo(
        () =>
            plainTextFromHtml(
                q.type === 'Reading'
                    ? (q.readingConfig?.contentBlocks ?? []).map((b) => b.content).join(' ')
                    : q.problemStatement,
            ).slice(0, 700),
        [q],
    );
    return (
        <div className="space-y-2 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{q.title}</p>
            <p className="whitespace-pre-line leading-6">{text || 'No text'}</p>
            {q.options && (
                <ul className="space-y-1">
                    {q.options.map((o) => (
                        <li key={o.id} className={`rounded-md px-2 py-1 text-xs ${o.isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50'}`}>
                            {o.isCorrect ? 'Correct: ' : ''}
                            {o.text}
                        </li>
                    ))}
                </ul>
            )}
            {q.codingConfig && (
                <p className="text-xs text-slate-500">
                    {q.codingConfig.testCases.length} test cases ({q.codingConfig.testCases.filter((t) => !t.isPublic).length} hidden),{' '}
                    {q.marks} pts
                </p>
            )}
            <p className="text-xs text-slate-400">
                {q.difficulty}, {q.marks} {q.marks === 1 ? 'pt' : 'pts'}
            </p>
        </div>
    );
}

/** AI actions for the question being edited. Changes are previewed before they apply. */
export default function InlineAiMenu({
    question,
    kind,
    onApply,
}: {
    question: Question;
    kind: AiKind;
    onApply: (updates: Partial<Question>) => void;
}) {
    const [open, setOpen] = useState(false);
    const [running, setRunning] = useState<QuestionOp | null>(null);
    const [suggestion, setSuggestion] = useState<{ op: QuestionOp; question: GeneratedQuestion; credits: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const { success } = useToast();
    const refreshUsage = useRefreshAiUsage();
    const { handleError, modal } = useAiErrorGate();

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!AI_TYPES.has(question.type)) return null;
    if (kind === 'exam' && question.type === 'Reading') return null;
    const ops = OPS.filter((o) => !o.types || o.types.includes(question.type));

    const run = async (op: QuestionOp) => {
        setOpen(false);
        setRunning(op);
        try {
            const res = await AiService.questionOp({ op, kind, question });
            setSuggestion({ op, question: res.question, credits: res.creditsUsed });
            void refreshUsage();
        } catch (err) {
            handleError(err);
        } finally {
            setRunning(null);
        }
    };

    const accept = () => {
        if (!suggestion) return;
        const { aiMeta: _meta, id: _id, ...rest } = suggestion.question;
        onApply(rest);
        setSuggestion(null);
        success('Review it, then save when you are ready.', 'Question updated');
    };

    const status = suggestion ? REVIEW_STATUS[suggestion.question.aiMeta.status] : null;

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                disabled={Boolean(running)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label="AI actions for this question"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-border-brand)] bg-[var(--color-brand-light)] px-4 text-xs font-semibold text-[var(--brand-dark)] transition hover:border-[var(--brand)] disabled:opacity-70"
            >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {running ? 'Working…' : 'AI'}
            </button>
            {open && (
                <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    {ops.map((o) => (
                        <button
                            key={o.op}
                            type="button"
                            role="menuitem"
                            onClick={() => run(o.op)}
                            className="block w-full px-3.5 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                            <span className="block text-sm font-medium text-slate-900">{o.label}</span>
                            <span className="block text-xs text-slate-500">{o.description}</span>
                        </button>
                    ))}
                </div>
            )}

            <AppModal
                isOpen={Boolean(suggestion)}
                onClose={() => setSuggestion(null)}
                size="lg"
                title="Review the AI change"
                subtitle={suggestion ? `${OPS.find((o) => o.op === suggestion.op)?.label}, ${suggestion.credits} credit${suggestion.credits === 1 ? '' : 's'} used` : undefined}
                footer={
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setSuggestion(null)}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Discard
                        </button>
                        <button
                            type="button"
                            onClick={accept}
                            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]"
                        >
                            Apply change
                        </button>
                    </div>
                }
            >
                {suggestion && (
                    <div className="space-y-4">
                        {status && suggestion.question.aiMeta.status !== 'ok' && (
                            <p className={`rounded-lg px-3 py-2 text-xs ${status.className}`}>
                                {status.label}: {suggestion.question.aiMeta.issues.join('; ') || status.hint}
                            </p>
                        )}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500">Current</p>
                                <div className="rounded-xl border border-slate-200 p-3">
                                    <Summary q={question} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-[var(--brand-dark)]">Suggested</p>
                                <div className="rounded-xl border border-[var(--color-border-brand)] bg-[var(--color-brand-light)]/40 p-3">
                                    <Summary q={suggestion.question} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </AppModal>
            {modal}
        </div>
    );
}
