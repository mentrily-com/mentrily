'use client';
import React, { useState } from 'react';

export interface Attempt {
    id: string;
    createdAt?: string | Date;
    timestamp?: string;
    status: string;
    score?: number;
    testCases?: string;
    content?: any;
    answer?: any;
}

interface AttemptsViewProps {
    attempts?: Attempt[];
    hideFilter?: boolean;
    onSelect?: (attempt: Attempt) => void;
    selectedAttemptId?: string;
    questionType?: 'MCQ' | 'MultiSelect' | 'Coding' | 'Web' | 'Reading' | 'Notebook';
}

export default function AttemptsView({
    attempts = [],
    hideFilter = false,
    onSelect,
    selectedAttemptId,
    questionType,
}: AttemptsViewProps) {
    const [filter, setFilter] = useState<'all' | 'failed' | 'success' | 'error'>('all');

    const getDisplayStatus = (attempt: Attempt) => {
        const status = attempt.status;
        const score = attempt.score ?? 0;

        if (questionType === 'MCQ' || questionType === 'MultiSelect') {
            return score === 100 ? 'success' : 'failed';
        }
        if (questionType === 'Coding') {
            if (score === 100) return 'success';
            if (score > 0) return 'failed';
            return 'error';
        }
        if (questionType === 'Web' || questionType === 'Notebook' || status === 'COMPLETED') {
            return 'success';
        }
        return status.toLowerCase() as any;
    };

    const getStatusText = (attempt: Attempt) => {
        const displayStatus = getDisplayStatus(attempt);
        if (questionType === 'Web' || questionType === 'Notebook' || questionType === 'Reading') {
            return 'Completed';
        }
        if (displayStatus === 'success') return 'Success';
        if (displayStatus === 'failed') return 'Failed';
        if (displayStatus === 'error') return 'Error';
        return attempt.status;
    };

    const formatTimestamp = (attempt: Attempt) => {
        const date = attempt.createdAt
            ? new Date(attempt.createdAt)
            : attempt.timestamp
              ? new Date(attempt.timestamp)
              : new Error();
        if (date instanceof Error) return 'Unknown Date';
        return date
            .toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            })
            .replace(',', ' |');
    };

    const sortedAttempts = [...attempts].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    });

    const filteredAttempts = sortedAttempts
        .map((a) => ({ ...a, displayStatus: getDisplayStatus(a) }))
        .filter((a) => filter === 'all' || a.displayStatus === filter);

    const counts = {
        all: attempts.length,
        failed: attempts.filter((a) => getDisplayStatus(a) === 'failed').length,
        success: attempts.filter((a) => getDisplayStatus(a) === 'success').length,
        error: attempts.filter((a) => getDisplayStatus(a) === 'error').length,
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Dropdown Filter Header */}
            {!hideFilter && (
                <div className="px-4 py-4 sm:px-8 sm:py-5 border-b border-slate-50 bg-slate-50/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                        Filter Attempts
                    </span>
                    <div className="relative inline-block w-full group sm:w-56">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-bold text-slate-700 cursor-pointer outline-none hover:border-[var(--brand)] hover:shadow-sm transition-all focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-lighter)]"
                        >
                            <option value="all">ALL ({counts.all})</option>
                            <option value="failed">Failed ({counts.failed})</option>
                            <option value="success">Successful ({counts.success})</option>
                            <option value="error">Error ({counts.error})</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 transition-transform group-hover:text-[var(--brand)]">
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </div>
                    </div>
                </div>
            )}

            {/* Table Header */}
            <div className="hidden px-8 py-4 border-b border-slate-100 text-[11px] font-black uppercase tracking-widest text-slate-400 sm:flex">
                <div className="flex-[2]">Attempts</div>
                <div className="flex-1 text-center">Test cases</div>
                <div className="flex-1 text-right">Status</div>
            </div>

            {/* Attempts List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredAttempts.map((attempt) => {
                    const displayStatus = (attempt as any).displayStatus;
                    const statusText = getStatusText(attempt);
                    const attemptNumber = attempts.length - sortedAttempts.indexOf(attempt);

                    return (
                        <div
                            key={attempt.id}
                            onClick={() => onSelect?.(attempt)}
                            className={`
                                flex flex-col gap-3 px-4 py-4 border-b border-slate-50 transition-all group cursor-pointer sm:flex-row sm:px-8
                                ${selectedAttemptId === attempt.id ? 'bg-indigo-50/50 border-indigo-100' : 'hover:bg-slate-50'}
                            `}
                        >
                            <div className="flex-[2] flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded min-w-[30px] text-center">
                                        #{attemptNumber}
                                    </span>
                                    <span className="min-w-0 break-words text-[13px] font-medium text-slate-600">
                                        {formatTimestamp(attempt)}
                                    </span>
                                </div>
                                {selectedAttemptId === attempt.id && (
                                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 w-fit px-1.5 py-0.5 rounded-md border border-indigo-100 sm:ml-10">
                                        Viewing Now
                                    </span>
                                )}
                            </div>
                            <div
                                className={`flex-1 text-left text-[13px] font-bold sm:text-center ${displayStatus === 'success' ? 'text-emerald-500' : 'text-rose-400'}`}
                            >
                                <span className="mr-2 text-[10px] font-black uppercase tracking-widest text-slate-300 sm:hidden">
                                    Test cases
                                </span>
                                {attempt.testCases ||
                                    (attempt.score !== undefined
                                        ? `${attempt.score === 100 ? '1 / 1' : '0 / 1'}`
                                        : '-')}
                            </div>
                            <div
                                className={`flex-1 text-left text-[13px] font-bold capitalize sm:text-right ${
                                    displayStatus === 'success'
                                        ? 'text-emerald-500'
                                        : displayStatus === 'failed'
                                          ? 'text-rose-500'
                                          : 'text-orange-500'
                                }`}
                            >
                                <span className="mr-2 text-[10px] font-black uppercase tracking-widest text-slate-300 sm:hidden">
                                    Status
                                </span>
                                {statusText}
                            </div>
                        </div>
                    );
                })}
                {filteredAttempts.length === 0 && (
                    <div className="p-12 text-center text-slate-400 text-sm font-medium">0 attempts found</div>
                )}
            </div>
        </div>
    );
}
