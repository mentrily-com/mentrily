'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ClipboardList, Lock, Plus, Search, X } from 'lucide-react';
import { AiService } from '@/services/api/AiService';
import { useDebounce } from '@/hooks/useDebounce';
import type { AiReference } from '@/lib/ai/types';

interface ReferencePickerProps {
    value: AiReference[];
    onChange: (next: AiReference[]) => void;
    max: number;
    onLockedClick?: () => void;
    defaultOpen?: boolean;
    placement?: 'top' | 'bottom';
}

/** Lets a teacher ground AI output in their own courses and exams. */
export default function ReferencePicker({ value, onChange, max, onLockedClick, defaultOpen = false, placement = 'bottom' }: ReferencePickerProps) {
    const [open, setOpen] = useState(defaultOpen && max !== 0);
    const [query, setQuery] = useState('');
    const debounced = useDebounce(query, 250);
    const wrapRef = useRef<HTMLDivElement>(null);
    const listId = useId();
    const locked = max === 0;
    const atLimit = max >= 0 && value.length >= max;

    const { data: results = [], isFetching } = useQuery({
        queryKey: ['ai-content', debounced],
        queryFn: () => AiService.searchContent(debounced),
        enabled: open,
        staleTime: 30_000,
    });

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const add = (ref: AiReference) => {
        if (value.some((v) => v.id === ref.id) || atLimit) return;
        onChange([...value, ref]);
        setOpen(false);
        setQuery('');
    };

    return (
        <div ref={wrapRef} className="relative">
            <div className="flex flex-wrap items-center gap-2">
                {value.map((ref) => (
                    <span
                        key={ref.id}
                        className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border border-[var(--color-border-brand)] bg-[var(--color-brand-light)] py-1 pl-2 pr-1 text-xs font-medium text-[var(--brand-dark)]"
                    >
                        {ref.kind === 'course' ? <BookOpen size={12} /> : <ClipboardList size={12} />}
                        <span className="truncate">{ref.title ?? 'Untitled'}</span>
                        <button
                            type="button"
                            onClick={() => onChange(value.filter((v) => v.id !== ref.id))}
                            className="rounded p-0.5 hover:bg-white/70"
                            aria-label={`Remove ${ref.title ?? 'reference'}`}
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
                {locked ? (
                    <button
                        type="button"
                        onClick={onLockedClick}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-400"
                    >
                        <Lock size={12} /> Use your courses as reference
                    </button>
                ) : (
                    !atLimit && (
                        <button
                            type="button"
                            onClick={() => setOpen((o) => !o)}
                            aria-expanded={open}
                            aria-controls={listId}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                        >
                            <Plus size={12} /> Add reference
                        </button>
                    )
                )}
            </div>

            {open && (
                <div
                    id={listId}
                    className={`absolute left-0 z-30 w-full min-w-[260px] max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
                >
                    <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                        <Search size={14} className="text-slate-400" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search your courses and exams"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                            aria-label="Search your courses and exams"
                        />
                    </label>
                    <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
                        {results.length === 0 && (
                            <li className="px-3 py-3 text-xs text-slate-500">
                                {isFetching ? 'Searching…' : 'No courses or exams match.'}
                            </li>
                        )}
                        {results.map((item) => {
                            const taken = value.some((v) => v.id === item.id);
                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        disabled={taken}
                                        onClick={() => add({ kind: item.kind, id: item.id, title: item.title })}
                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        {item.kind === 'course' ? (
                                            <BookOpen size={14} className="shrink-0 text-slate-400" />
                                        ) : (
                                            <ClipboardList size={14} className="shrink-0 text-slate-400" />
                                        )}
                                        <span className="truncate text-slate-700">{item.title}</span>
                                        <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                                            {item.kind === 'course' ? 'Course' : 'Exam'}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {max > 0 && (
                        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
                            Up to {max} reference{max === 1 ? '' : 's'} on your plan
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
