'use client';
import React from 'react';
import { sanitizeRichText } from '@/lib/sanitize';

interface ProblemStatementProps {
    title: string;
    difficulty: string;
    topic: string;
    description: string;
    task?: string;
    exampleInput?: string;
    exampleOutput?: string;
    onPrevious?: () => void;
    onNext?: () => void;
    onToggleReview?: () => void;
    isMarkedForReview?: boolean;
    onToggleBookmark?: () => void;
    isBookmarked?: boolean;
    hideHeader?: boolean;
    hideBookmark?: boolean;
    fontSize?: number;
    isExamMode?: boolean;
    marksObtained?: number;
    questionTotalMarks?: number;
}

export default function ProblemStatement({
    title,
    difficulty,
    topic,
    description,
    task,
    exampleInput,
    exampleOutput,
    onPrevious,
    onNext,
    onToggleReview,
    isMarkedForReview = false,
    onToggleBookmark,
    isBookmarked = false,
    hideHeader = false,
    hideBookmark = false,
    fontSize,
    isExamMode = false,
    marksObtained,
    questionTotalMarks,
}: ProblemStatementProps) {
    return (
        <div className="flex h-full min-h-0 flex-col bg-white relative" data-element-id="starter-question-prompt">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
                {/* Header / Navigation */}
                {!hideHeader && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onPrevious}
                                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <path d="m15 18-6-6 6-6" />
                                </svg>
                            </button>
                            <button
                                onClick={onNext}
                                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <path d="m9 18 6-6-6-6" />
                                </svg>
                            </button>
                        </div>

                        {!isExamMode && onToggleReview && (
                            <button
                                onClick={onToggleReview}
                                className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all font-black text-[10px] uppercase tracking-widest sm:px-4
                                ${
                                    isMarkedForReview
                                        ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm shadow-amber-200/50'
                                        : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                                }
                            `}
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill={isMarkedForReview ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                    <line x1="4" y1="22" x2="4" y2="15" />
                                </svg>
                                {isMarkedForReview ? 'Marked for Review' : 'Mark for Review'}
                            </button>
                        )}
                    </div>
                )}

                {/* Problem Title */}
                <div className="px-4 py-3 sm:px-8 sm:py-8">
                    <div className="mb-2 flex items-start justify-between gap-3 sm:gap-4">
                        <h1 className="min-w-0 break-words text-base font-black tracking-tight text-slate-800 sm:text-2xl">
                            {title}
                        </h1>

                        {isExamMode ? (
                            // Exam Mode: Review Flag Button
                            <button
                                data-element-id="starter-mark-review"
                                onClick={onToggleReview}
                                className={`shrink-0 rounded-xl border p-2 transition-all sm:p-2.5 ${
                                    isMarkedForReview
                                        ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm shadow-amber-200/50'
                                        : 'bg-white border-slate-100 text-slate-300 hover:text-slate-500 hover:border-slate-200'
                                }
                            `}
                                title={isMarkedForReview ? 'Unmark for Review' : 'Mark for Review'}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill={isMarkedForReview ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                    <line x1="4" y1="22" x2="4" y2="15" />
                                </svg>
                            </button>
                        ) : hideBookmark ? null : (
                            // Standard Mode: Bookmark Button
                            <button
                                onClick={onToggleBookmark}
                                className={`shrink-0 rounded-xl border p-2 transition-all sm:p-2.5 ${
                                    isBookmarked
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                        : 'bg-white border-slate-100 text-slate-300 hover:text-slate-500 hover:border-slate-200'
                                }
                            `}
                                title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill={isBookmarked ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Marks Badge */}
                    {marksObtained !== undefined && questionTotalMarks !== undefined && (
                        <div className="mb-4">
                            <span
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${
                                    marksObtained === questionTotalMarks
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : marksObtained > 0
                                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                                          : 'bg-rose-50 text-rose-600 border-rose-100'
                                }`}
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                >
                                    <path d="M12 20V10" />
                                    <path d="M18 20V4" />
                                    <path d="M6 20v-4" />
                                </svg>
                                Marks: {marksObtained} / {questionTotalMarks}
                            </span>
                        </div>
                    )}

                    <div className="mb-3 h-1 w-10 rounded-full bg-[var(--brand)] sm:mb-8 sm:w-12"></div>

                    {/* Description */}
                    <div
                        className="space-y-3 leading-relaxed text-slate-600 sm:space-y-6"
                        style={{ fontSize: fontSize ? `${fontSize}px` : '15px' }}
                    >
                        <div
                            className="prose prose-slate max-w-none prose-p:text-inherit prose-headings:text-slate-800 prose-code:text-[var(--brand-dark)] prose-code:bg-[var(--brand-lighter)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-sm prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:border prose-pre:border-slate-700 prose-pre:overflow-x-auto prose-pre:max-w-full [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_pre_code]:before:content-none [&_pre_code]:after:content-none"
                            dangerouslySetInnerHTML={{
                                __html: sanitizeRichText(description),
                            }}
                        ></div>

                        {task && (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 sm:p-6">
                                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 sm:mb-3 sm:text-base">
                                    <span className="h-5 w-1.5 rounded-full bg-[var(--brand)] sm:h-6"></span>
                                    Task
                                </h3>
                                <p className="font-medium">{task}</p>
                            </div>
                        )}

                        {exampleInput && (
                            <div className="space-y-4">
                                <h3 className="text-slate-800 font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-6 bg-slate-200 rounded-full"></span>
                                    Example
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2 min-w-0">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Input
                                        </span>
                                        <div className="w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                                            <pre className="p-4 font-mono text-sm text-slate-700 overflow-x-auto whitespace-pre max-w-full">
                                                {exampleInput}
                                            </pre>
                                        </div>
                                    </div>
                                    {exampleOutput && (
                                        <div className="space-y-2 min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Output
                                            </span>
                                            <div className="w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                                                <pre className="p-4 font-mono text-sm text-[#e67e22] overflow-x-auto whitespace-pre max-w-full">
                                                    {exampleOutput}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Exam Mode Bottom Navigation (Fixed Footer) */}
            {isExamMode && (
                <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-end gap-3 z-10">
                    <button
                        onClick={onPrevious}
                        className="flex-1 px-4 py-2 bg-slate-50 text-slate-500 font-bold rounded-xl text-xs hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center gap-2 sm:flex-none"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Previous
                    </button>
                    <button
                        onClick={onNext}
                        className="flex-1 px-6 py-2 bg-[var(--brand)] text-white font-bold rounded-xl text-xs hover:bg-[var(--brand-dark)] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[var(--brand-light)] sm:flex-none"
                    >
                        Next
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path d="m9 18 6-6-6-6" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
