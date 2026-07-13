'use client';

import Link from 'next/link';

type ChecklistStep = {
    id: string;
    title: string;
    href: string;
    completed: boolean;
};

interface OnboardingChecklistProps {
    steps: ChecklistStep[];
    completedCount: number;
    totalSteps: number;
    onDismiss?: () => void;
    showDismiss?: boolean;
}

export default function OnboardingChecklist({
    steps,
    completedCount,
    totalSteps,
    onDismiss,
    showDismiss,
}: OnboardingChecklistProps) {
    const percent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    return (
        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] mb-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(26,86,219,0.1),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_34%)]" />
            <div className="relative">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <h3 className="text-base font-black text-slate-950">Launch Checklist</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                        Finish the key setup steps once so the workspace is ready for your team.
                    </p>
                </div>
                {showDismiss && onDismiss && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-slate-950 text-white"
                    >
                        Dismiss
                    </button>
                )}
            </div>

            <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Progress</span>
                    <span className="text-[11px] font-black text-slate-600">
                        {completedCount}/{totalSteps}
                    </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand),#0ea5e9)] transition-all"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            <ul className="space-y-2.5">
                {steps.map((step) => (
                    <li key={step.id}>
                        <Link
                            href={step.href}
                            className="flex items-center gap-2.5 rounded-2xl border border-transparent p-3 hover:border-slate-200 hover:bg-white/80 transition-colors"
                        >
                            <span
                                className={`text-sm font-black ${step.completed ? 'text-emerald-600' : 'text-slate-400'}`}
                            >
                                {step.completed ? '✓' : '○'}
                            </span>
                            <span
                                className={`text-sm font-semibold ${step.completed ? 'text-slate-700' : 'text-slate-600'}`}
                            >
                                {step.title}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
            </div>
        </section>
    );
}
