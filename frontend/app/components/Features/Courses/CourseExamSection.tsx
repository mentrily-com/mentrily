'use client';

import React from 'react';

export default function CourseExamSection({
    linkedExam,
    examUnlockThreshold,
    examPassThreshold,
    maxAttempts,
    attemptBufferMins,
    onChangeThreshold,
    onBuildExam,
    onUnlink,
}: {
    linkedExam?: {
        id: string;
        title: string;
        slug: string;
        duration?: number;
        totalMarks?: number;
        questionCount?: number;
        passingPercentage?: number;
        maxAttempts?: number;
        attemptBufferMins?: number;
    } | null;
    examUnlockThreshold?: number;
    examPassThreshold?: number;
    maxAttempts?: number;
    attemptBufferMins?: number;
    onChangeThreshold: (
        field: 'examUnlockThreshold' | 'examPassThreshold' | 'maxAttempts' | 'attemptBufferMins',
        value: number,
    ) => void;
    onBuildExam: () => void;
    onUnlink: () => void;
}) {
    return (
        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Linked Exam</p>
                {linkedExam ? (
                    <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                        Linked
                    </span>
                ) : null}
            </div>

            {linkedExam ? (
                <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                                Linked course exam
                            </p>
                            <h4 className="mt-1 text-base font-black text-slate-900">{linkedExam.title}</h4>
                            <p className="mt-1 text-[11px] font-bold text-slate-500">/exam/{linkedExam.slug}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onBuildExam}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
                        >
                            Edit Exam
                        </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-white/80 p-3">
                        <Stat label="Questions" value={linkedExam.questionCount ?? '-'} />
                        <Stat label="Duration" value={`${linkedExam.duration ?? '-'}m`} />
                        <Stat label="Marks" value={linkedExam.totalMarks ?? '-'} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <ThresholdInput
                            label="Unlock at"
                            value={examUnlockThreshold ?? 100}
                            onChange={(value) => onChangeThreshold('examUnlockThreshold', value)}
                        />
                        <ThresholdInput
                            label="Passing %"
                            value={examPassThreshold ?? 70}
                            onChange={(value) => onChangeThreshold('examPassThreshold', value)}
                        />
                        <ThresholdInput
                            label="Max Attempts"
                            value={maxAttempts ?? linkedExam.maxAttempts ?? 1}
                            onChange={(value) => onChangeThreshold('maxAttempts', Math.max(1, value))}
                            suffix=""
                            max={20}
                        />
                        <ThresholdInput
                            label="Buffer (mins)"
                            value={attemptBufferMins ?? linkedExam.attemptBufferMins ?? 0}
                            onChange={(value) => onChangeThreshold('attemptBufferMins', Math.max(0, value))}
                            suffix="m"
                            max={1440}
                        />
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={onUnlink}
                            className="w-full rounded-xl bg-rose-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600"
                        >
                            Unlink
                        </button>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center bg-slate-50">
                    <p className="text-xs font-bold text-slate-500">No exam linked yet</p>
                    <button
                        type="button"
                        onClick={onBuildExam}
                        className="mt-3 px-3 py-2 rounded-xl bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest"
                    >
                        Build Exam
                    </button>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
        </div>
    );
}

function ThresholdInput({
    label,
    value,
    onChange,
    suffix = '%',
    max = 100,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    suffix?: string;
    max?: number;
}) {
    return (
        <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</span>
            <div className="relative">
                <input
                    type="number"
                    min={0}
                    max={max}
                    value={value}
                    onChange={(event) => onChange(Math.max(0, Math.min(max, Number(event.target.value || 0))))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-black text-slate-700"
                />
                {suffix ? (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {suffix}
                    </span>
                ) : null}
            </div>
        </label>
    );
}
