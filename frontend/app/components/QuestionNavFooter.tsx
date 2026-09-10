'use client';
import React from 'react';

interface QuestionNavFooterProps {
    onPrevious?: () => void;
    onNext?: () => void;
}

/**
 * Shared bottom question-navigation footer -- the same Previous/Next pair
 * used in exam mode (previously only rendered inside ProblemStatement when
 * `isExamMode` was true), now also used for course questions so both flows
 * share one visual design in one fixed place instead of course questions
 * getting a second, differently-styled top-of-panel arrow pair.
 *
 * Self-guards: renders nothing when neither handler is supplied (e.g. the
 * standalone single-question playground, which has no prev/next concept).
 */
export default function QuestionNavFooter({ onPrevious, onNext }: QuestionNavFooterProps) {
    if (!onPrevious && !onNext) return null;

    return (
        <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-end gap-3 z-10">
            <button
                onClick={onPrevious}
                data-element-id="starter-unit-previous"
                className="flex-1 px-4 py-2 bg-slate-50 text-slate-500 font-bold rounded-xl text-xs hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center gap-2 sm:flex-none"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m15 18-6-6 6-6" />
                </svg>
                Previous
            </button>
            <button
                onClick={onNext}
                data-element-id="starter-unit-next"
                className="flex-1 px-6 py-2 bg-[var(--brand)] text-white font-bold rounded-xl text-xs hover:bg-[var(--brand-dark)] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[var(--brand-light)] sm:flex-none"
            >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m9 18 6-6-6-6" />
                </svg>
            </button>
        </div>
    );
}
