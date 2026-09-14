'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { sanitizeRichText } from '@/lib/sanitize';
import { AI_TYPES, REVIEW_STATUS } from '@/lib/ai/questionTypes';
import type { AiDraft, AiGenerationType, GeneratedQuestion } from '@/lib/ai/types';

function QuestionDetail({ q }: { q: GeneratedQuestion }) {
    const statement = useMemo(() => sanitizeRichText(q.problemStatement || ''), [q.problemStatement]);
    return (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {q.type !== 'Reading' && statement && (
                <div
                    className="prose prose-sm max-w-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:before:content-none prose-code:after:content-none"
                    dangerouslySetInnerHTML={{ __html: statement }}
                />
            )}
            {q.options && (
                <ul className="space-y-1">
                    {q.options.map((o) => (
                        <li
                            key={o.id}
                            className={`flex items-start gap-2 rounded-md px-2 py-1 ${o.isCorrect ? 'bg-emerald-50 text-emerald-800' : ''}`}
                        >
                            <span className="mt-0.5 shrink-0">{o.isCorrect ? <Check size={13} /> : <span className="inline-block h-[13px] w-[13px] rounded-full border border-slate-300" />}</span>
                            <span>{o.text}</span>
                        </li>
                    ))}
                </ul>
            )}
            {q.codingConfig && (
                <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                        Languages: {Object.keys(q.codingConfig.templates).join(', ')}
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="text-slate-500">
                                <tr>
                                    <th className="py-1 pr-3 font-medium">Input</th>
                                    <th className="py-1 pr-3 font-medium">Expected output</th>
                                    <th className="py-1 pr-3 font-medium">Visibility</th>
                                    <th className="py-1 font-medium">Pts</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono text-slate-700">
                                {q.codingConfig.testCases.map((t, i) => (
                                    <tr key={i} className="border-t border-slate-200 align-top">
                                        <td className="whitespace-pre py-1 pr-3">{t.input || '(none)'}</td>
                                        <td className="whitespace-pre py-1 pr-3">{t.output}</td>
                                        <td className="py-1 pr-3 font-sans">{t.isPublic ? 'Public' : 'Hidden'}</td>
                                        <td className="py-1 tabular-nums">{t.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {q.readingConfig && (
                <div className="space-y-2">
                    {q.readingConfig.contentBlocks.map((b) =>
                        b.type === 'code-runner' ? (
                            <pre key={b.id} className="overflow-x-auto rounded-md bg-slate-900 p-2.5 text-xs text-slate-100">
                                {b.runnerConfig?.initialCode}
                            </pre>
                        ) : (
                            <div
                                key={b.id}
                                className="prose prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none"
                                dangerouslySetInnerHTML={{ __html: sanitizeRichText(b.content) }}
                            />
                        ),
                    )}
                </div>
            )}
            {q.webConfig && (
                <pre className="max-h-40 overflow-auto rounded-md bg-slate-900 p-2.5 text-xs text-slate-100">{q.webConfig.html}</pre>
            )}
            {q.notebookConfig && (
                <pre className="max-h-40 overflow-auto rounded-md bg-slate-900 p-2.5 text-xs text-slate-100">
                    {q.notebookConfig.initialCode}
                </pre>
            )}
        </div>
    );
}

export default function DraftReview({
    draft,
    selected,
    onSelectedChange,
}: {
    draft: AiDraft;
    selected: Set<string>;
    onSelectedChange: (next: Set<string>) => void;
}) {
    const [open, setOpen] = useState<string | null>(null);
    const allIds = draft.sections.flatMap((s) => s.questions.map((q) => q.id));
    const allSelected = allIds.every((id) => selected.has(id));

    const toggle = (ids: string[], on: boolean) => {
        const next = new Set(selected);
        ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
        onSelectedChange(next);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600">
                <span className="tabular-nums">
                    {draft.stats.questions} items, {draft.totalMarks} {draft.totalMarks === 1 ? 'pt' : 'pts'}
                    {draft.stats.verified > 0 && <>, <span className="text-emerald-700">{draft.stats.verified} verified</span></>}
                    {draft.stats.needsReview > 0 && <>, <span className="text-amber-700">{draft.stats.needsReview} to review</span></>}
                </span>
                <button
                    type="button"
                    onClick={() => toggle(allIds, !allSelected)}
                    className="font-medium text-[var(--brand)] hover:underline"
                >
                    {allSelected ? 'Clear selection' : 'Select all'}
                </button>
            </div>

            {draft.sections.map((section) => {
                const ids = section.questions.map((q) => q.id);
                const sectionOn = ids.every((id) => selected.has(id));
                return (
                    <section key={section.id} className="space-y-1.5">
                        <label className="flex cursor-pointer items-center gap-2.5 px-1 py-1">
                            <input
                                type="checkbox"
                                checked={sectionOn}
                                onChange={(e) => toggle(ids, e.target.checked)}
                                className="h-4 w-4 accent-[var(--brand)]"
                            />
                            <span className="text-sm font-semibold text-slate-900">{section.title}</span>
                        </label>
                        <ul className="space-y-1.5">
                            {section.questions.map((q) => {
                                const info = AI_TYPES[q.type as AiGenerationType];
                                const Icon = info?.icon;
                                const status = REVIEW_STATUS[q.aiMeta.status];
                                const isOpen = open === q.id;
                                return (
                                    <li key={q.id} className="rounded-xl border border-slate-200 bg-white">
                                        <div className="flex items-center gap-2.5 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(q.id)}
                                                onChange={(e) => toggle([q.id], e.target.checked)}
                                                className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                                                aria-label={`Include ${q.title}`}
                                            />
                                            {Icon && <Icon size={14} className="shrink-0 text-slate-400" aria-hidden />}
                                            <button
                                                type="button"
                                                onClick={() => setOpen(isOpen ? null : q.id)}
                                                aria-expanded={isOpen}
                                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                            >
                                                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{q.title}</span>
                                                <span
                                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${status.className}`}
                                                    title={q.aiMeta.issues.length ? q.aiMeta.issues.join('\n') : status.hint}
                                                >
                                                    {status.label}
                                                </span>
                                                <span className="shrink-0 text-xs tabular-nums text-slate-400">{q.marks} {q.marks === 1 ? 'pt' : 'pts'}</span>
                                                {isOpen ? (
                                                    <EyeOff size={14} className="shrink-0 text-slate-400" />
                                                ) : (
                                                    <Eye size={14} className="shrink-0 text-slate-400" />
                                                )}
                                            </button>
                                        </div>
                                        {isOpen && (
                                            <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2">
                                                {q.aiMeta.issues.length > 0 && (
                                                    <ul className="space-y-0.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                        {q.aiMeta.issues.map((issue, i) => (
                                                            <li key={i} className="flex gap-1.5">
                                                                <ChevronRight size={12} className="mt-0.5 shrink-0" />
                                                                {issue}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                <QuestionDetail q={q} />
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}
