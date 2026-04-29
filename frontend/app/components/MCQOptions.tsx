'use client';
import React, { useState } from 'react';

interface MCQOption {
    id: string;
    text: string;
}

interface MCQOptionsProps {
    options: MCQOption[];
    multiSelect?: boolean;
    maxSelections?: number;
    correctIds?: string[];
    onSubmit: (selectedIds: string[]) => void;
    onChange?: (selectedIds: string[]) => void;
    onReset: () => void;
    selectedIds?: string[];
    readOnly?: boolean;
    fontSize?: number;
}

export default function MCQOptions({
    options,
    multiSelect = false,
    maxSelections,
    correctIds,
    onSubmit,
    onChange,
    onReset,
    selectedIds: externalSelectedIds,
    readOnly = false,
    fontSize,
}: MCQOptionsProps) {
    const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);

    // Ensure selectedIds is always an array
    const rawSelectedIds = externalSelectedIds !== undefined ? externalSelectedIds : internalSelectedIds;
    const selectedIds = Array.isArray(rawSelectedIds) ? rawSelectedIds : rawSelectedIds ? [rawSelectedIds] : [];
    const normalizedCorrectIds = Array.isArray(correctIds) ? correctIds : [];

    const isInteractionDisabled = readOnly;

    const toggleOption = (id: string) => {
        if (isInteractionDisabled) return;

        let newSelected: string[] = [];
        if (multiSelect) {
            if (selectedIds.includes(id)) {
                newSelected = selectedIds.filter((p) => p !== id);
            } else {
                // Check limit
                if (maxSelections && selectedIds.length >= maxSelections) {
                    // Optional: Show toast or shake effect? For now just prevent.
                    return;
                }
                newSelected = [...selectedIds, id];
            }
        } else {
            newSelected = [id];
        }

        setInternalSelectedIds(newSelected);
        if (onChange) onChange(newSelected);
    };

    const handleSubmit = () => {
        if (selectedIds.length === 0) return;
        onSubmit(selectedIds);
    };

    const handleReset = () => {
        if (readOnly) return;
        setInternalSelectedIds([]);
        onReset();
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-4 sm:p-8 no-scrollbar">
                <div className="max-w-3xl mx-auto space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">
                        {readOnly
                            ? 'Submitted Answer'
                            : multiSelect
                              ? 'Select all correct answers'
                              : 'Select the best answer'}
                    </h3>

                    {options.map((option) => {
                        const isSelected = selectedIds.includes(option.id);
                        const isCorrect = normalizedCorrectIds.includes(option.id);
                        return (
                            <button
                                key={option.id}
                                onClick={() => toggleOption(option.id)}
                                disabled={isInteractionDisabled}
                                className={`w-full text-left p-4 sm:p-6 rounded-2xl border-2 transition-all group relative overflow-hidden ${
                                    isSelected
                                        ? 'border-[var(--brand)] bg-[var(--brand-lighter)] ring-1 ring-[var(--brand)]'
                                        : readOnly && isCorrect
                                          ? 'border-emerald-300 bg-emerald-50'
                                          : 'border-slate-100' +
                                            (!isInteractionDisabled ? ' hover:border-slate-200 hover:bg-slate-50' : '')
                                } ${isInteractionDisabled && !isSelected && !isCorrect ? 'opacity-50 grayscale-[0.5]' : ''}`}
                            >
                                <div className="flex items-start gap-3 sm:gap-4 z-10 relative">
                                    <div
                                        className={`w-6 h-6 rounded-${multiSelect ? 'md' : 'full'} border-2 flex items-center justify-center shrink-0 transition-colors ${
                                            isSelected
                                                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                                : 'border-slate-200 text-transparent' +
                                                  (!isInteractionDisabled ? ' group-hover:border-slate-300' : '')
                                        }`}
                                    >
                                        {multiSelect ? (
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        ) : (
                                            <div
                                                className={`w-2.5 h-2.5 rounded-full bg-white ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                                            />
                                        )}
                                    </div>
                                    <span
                                        className={`min-w-0 flex-1 break-words font-medium leading-relaxed ${isSelected ? 'text-[var(--brand-dark)]' : 'text-slate-600'}`}
                                        style={{ fontSize: fontSize ? `${fontSize}px` : undefined }}
                                    >
                                        {option.text}
                                    </span>
                                    {readOnly && isCorrect && (
                                        <span className="ml-auto shrink-0 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
                                            Correct
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Actions Bar - Hide if Read Only */}
            {!readOnly && (
                <div className="shrink-0 border-t border-slate-100 bg-white p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 z-20 w-full">
                    <button
                        onClick={handleReset}
                        className="flex-1 px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center justify-center gap-2 sm:flex-none"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                            <path d="M8 16H3v5" />
                        </svg>
                        Reset
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={selectedIds.length === 0}
                        className={`px-8 py-2.5 rounded-xl font-black transition-all flex items-center gap-2 ${
                            selectedIds.length === 0
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-[var(--brand)] text-white hover:brightness-105 active:scale-95'
                        } flex-1 justify-center sm:flex-none`}
                    >
                        Submit Answer
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                        >
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
