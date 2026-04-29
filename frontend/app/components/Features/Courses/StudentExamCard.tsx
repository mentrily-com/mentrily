'use client';

import Link from 'next/link';
import { useState } from 'react';

type LinkedExamStatus = {
    id: string;
    slug: string;
    title: string;
    duration: number | null;
    totalMarks: number | null;
    isActive?: boolean;
    isUnlocked: boolean;
    requiredPercent: number;
    passingPercentage?: number;
    lastAttempt?: {
        status: string;
        score: number | null;
        attemptNumber: number;
        endedAt: string | null;
    } | null;
    passed?: boolean | null;
    attemptsUsed?: number;
    attemptsRemaining?: number;
    nextAttemptAvailableAt?: string | null;
};

export default function StudentExamCard({
    exam,
    progressPercent,
    courseSlug,
    variant = 'card',
}: {
    exam: LinkedExamStatus | null;
    progressPercent: number;
    courseSlug?: string;
    variant?: 'card' | 'compact';
}) {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    if (!exam) return null;

    const finalAttemptStatuses = new Set(['COMPLETED', 'TERMINATED']);
    const hasFinalAttempt = Boolean(
        exam.lastAttempt?.status && finalAttemptStatuses.has(String(exam.lastAttempt.status).toUpperCase()),
    );
    const score = hasFinalAttempt && typeof exam.lastAttempt?.score === 'number' ? Math.round(exam.lastAttempt.score) : null;
    const passingPercentage = Number(exam.passingPercentage ?? 70);
    const durationLabel = typeof exam.duration === 'number' && exam.duration > 0 ? `${exam.duration} min` : null;
    const marksLabel = typeof exam.totalMarks === 'number' && exam.totalMarks > 0 ? `${exam.totalMarks} marks` : null;
    const metaLabel = [durationLabel, marksLabel].filter(Boolean).join(' · ') || 'Course exam';
    const passed = hasFinalAttempt ? exam.passed : null;
    const hasAttempt = hasFinalAttempt;
    const statusLabel = passed === true
        ? 'Passed'
        : passed === false
          ? 'Failed'
          : exam.isUnlocked
            ? hasAttempt
                ? 'In Progress'
                : 'Not Attempted'
            : 'Locked';
    const returnTo = courseSlug ? `/dashboard/learner/module/${courseSlug}` : '/dashboard/learner';
    const examHref = `/exam/${exam.slug}?returnTo=${encodeURIComponent(returnTo)}`;
    const isRetakeDelayed =
        passed === false &&
        exam.nextAttemptAvailableAt &&
        new Date(exam.nextAttemptAvailableAt).getTime() > Date.now();
    const isOutOfAttempts = passed === false && Number(exam.attemptsRemaining || 0) <= 0;
    const canAttempt = Boolean(exam.isActive && exam.isUnlocked && passed !== true && !isOutOfAttempts && !isRetakeDelayed);
    const statusTone =
        passed === true
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : passed === false
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : exam.isUnlocked
                ? 'bg-sky-100 text-sky-700 border-sky-200'
                : 'bg-amber-100 text-amber-700 border-amber-200';
    const detailText = !exam.isActive
        ? 'Not published yet'
        : !exam.isUnlocked
          ? `Unlock at ${exam.requiredPercent}% mastery`
          : passed === true
            ? `${score !== null ? `${score}% score · ` : ''}Pass mark ${passingPercentage}%`
            : isOutOfAttempts
              ? `${score !== null ? `${score}% score · ` : ''}No attempts left`
              : isRetakeDelayed
                ? `Retake ${new Date(exam.nextAttemptAvailableAt as string).toLocaleString()}`
                : passed === false
                  ? `${score !== null ? `${score}% score · ` : ''}Retake available`
                  : 'Ready when you are';
    const progressGap = Math.max(0, Number(exam.requiredPercent || 0) - Number(progressPercent || 0));
    const detailsModal = isDetailsOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Exam</p>
                        <h2 className="mt-1 text-xl font-black text-slate-900">{exam.title}</h2>
                        <p className="mt-1 text-xs font-bold text-slate-500">{metaLabel}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsDetailsOpen(false)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-50"
                    >
                        Close
                    </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <DetailBox label="Status" value={statusLabel} />
                    <DetailBox label="Pass Mark" value={`${passingPercentage}%`} />
                    <DetailBox label="Your Progress" value={`${progressPercent}%`} />
                    <DetailBox label="Required" value={`${exam.requiredPercent}%`} />
                    <DetailBox label="Attempts Used" value={String(exam.attemptsUsed ?? 0)} />
                    <DetailBox label="Attempts Left" value={String(exam.attemptsRemaining ?? '-')} />
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span>Unlock Progress</span>
                        <span>{progressPercent}% / {exam.requiredPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                            className={`h-full rounded-full transition-all ${exam.isUnlocked ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                        />
                    </div>
                    <p className="mt-3 text-xs font-bold text-slate-600">
                        {exam.isUnlocked
                            ? detailText
                            : `Complete ${progressGap}% more course progress to unlock this exam.`}
                    </p>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    {!exam.isUnlocked && (
                        <button
                            type="button"
                            disabled
                            className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500"
                        >
                            Locked
                        </button>
                    )}
                    {canAttempt && (
                        <Link
                            href={examHref}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-center text-xs font-black uppercase tracking-widest text-white transition hover:bg-[var(--brand)]"
                        >
                            {passed === false ? 'Retake Exam' : 'Start Exam'}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    if (variant === 'compact') {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setIsDetailsOpen(true)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-white sm:w-auto sm:min-w-[280px] sm:max-w-[420px]"
                >
                    <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <p className="truncate text-[11px] font-black text-slate-800">{exam.title}</p>
                            <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${statusTone}`}>
                                {statusLabel}
                            </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">
                            {metaLabel} · {detailText}
                        </p>
                    </div>
                    {canAttempt && (
                        <span
                            className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white transition-colors hover:bg-[var(--brand)]"
                        >
                            {passed === false ? 'Retake' : 'Start'}
                        </span>
                    )}
                    </div>
                </button>
                {detailsModal}
            </>
        );
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Exam</p>
                    <h3 className="mt-1 text-lg font-black text-slate-800">{exam.title}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                        {metaLabel}
                    </p>
                </div>
                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${statusTone}`}>
                    {statusLabel}
                </span>
            </div>

            {!exam.isActive ? (
                <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xs font-bold text-slate-700">
                        This linked exam is not published yet.
                    </p>
                </div>
            ) : !exam.isUnlocked ? (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-bold text-amber-700">
                        Complete at least {exam.requiredPercent}% of this course to unlock the exam.
                    </p>
                    <p className="mt-1 text-[11px] text-amber-700/90 font-bold">Current progress: {progressPercent}%</p>
                </div>
            ) : passed === true ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-bold text-emerald-700">Passed{score !== null ? ` - ${score}%` : ''}</p>
                    <p className="mt-1 text-[11px] font-bold text-emerald-700/85">
                        Pass at {passingPercentage}%. No more attempts are needed.
                    </p>
                </div>
            ) : isOutOfAttempts ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-bold text-rose-700">Failed{score !== null ? ` - ${score}%` : ''}</p>
                    <p className="mt-1 text-[11px] font-bold text-rose-700/85">
                        Pass at {passingPercentage}%. No attempts left.
                    </p>
                </div>
            ) : isRetakeDelayed ? (
                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3">
                    <p className="text-xs font-bold text-rose-700">Failed{score !== null ? ` - ${score}%` : ''}</p>
                    <p className="text-xs font-bold text-sky-700">
                        Retake available at {new Date(exam.nextAttemptAvailableAt as string).toLocaleString()}
                    </p>
                </div>
            ) : (
                <div className="mt-4">
                    {passed === false && (
                        <p className="mb-2 text-xs font-bold text-rose-700">
                            Failed{score !== null ? ` - ${score}%` : ''} / Pass at {passingPercentage}%
                        </p>
                    )}
                    <Link
                        href={examHref}
                        className="inline-flex items-center px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-black uppercase tracking-widest"
                    >
                        {passed === false ? 'Retake Exam' : 'Start Exam'}
                    </Link>
                </div>
            )}
            <button
                type="button"
                onClick={() => setIsDetailsOpen(true)}
                className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-700"
            >
                View Exam Details
            </button>
            {detailsModal}
        </div>
    );
}

function DetailBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
        </div>
    );
}
