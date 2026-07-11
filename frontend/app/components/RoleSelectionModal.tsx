'use client';

import { useState } from 'react';
import posthog from 'posthog-js';
import { ArrowRight, Loader2 } from 'lucide-react';

type Role = 'STUDENT';

interface RoleSelectionModalProps {
    onSelectRole: (role: Role) => Promise<void>;
    onSelectCreator: () => Promise<void>;
}

/**
 * First product moment after signup: pick which side of the classroom you're
 * on. Two full-height "doors" anchored by a single verb each — the choice is
 * the layout. Either choice is additive: the workspace switcher lets any
 * account hold both personas later.
 */
export default function RoleSelectionModal({ onSelectRole, onSelectCreator }: RoleSelectionModalProps) {
    const [selectedRole, setSelectedRole] = useState<Role | 'CREATOR' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const busy = selectedRole !== null;

    const choose = async (choice: Role | 'CREATOR') => {
        if (busy) return;
        setError(null);
        setSelectedRole(choice);
        posthog.capture('role_selected', { role: choice });

        try {
            if (choice === 'CREATOR') {
                await onSelectCreator();
            } else {
                await onSelectRole(choice);
            }
        } catch (err: unknown) {
            setSelectedRole(null);
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 z-[2100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="role-selection-title"
                className="w-full max-w-[640px] bg-white rounded-[28px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 max-h-[calc(100dvh-32px)] overflow-y-auto"
            >
                {/* Header */}
                <div className="px-6 pt-9 pb-7 text-center sm:px-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand)]">
                        Welcome to Mentrily
                    </p>
                    <h2
                        id="role-selection-title"
                        className="mt-3 text-[26px] font-black text-slate-900 tracking-tight leading-tight sm:text-3xl"
                    >
                        Pick your side of the classroom
                    </h2>
                    <p className="mt-2 text-[13px] font-medium text-slate-500">
                        You can add the other side to your account whenever you like.
                    </p>
                </div>

                {/* The two doors */}
                <div className="grid grid-cols-1 border-t border-slate-100 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
                    <Door
                        kicker="For students"
                        verb="Learn."
                        body="Take courses and exams, track your scores, and earn certificates you can share."
                        action="Start learning"
                        selected={selectedRole === 'STUDENT'}
                        busy={busy}
                        onClick={() => choose('STUDENT')}
                    />
                    <Door
                        kicker="For educators"
                        verb="Teach."
                        body="Build courses and assessments, invite learners, and run it all from one dashboard. Free to start."
                        action="Start teaching"
                        selected={selectedRole === 'CREATOR'}
                        busy={busy}
                        onClick={() => choose('CREATOR')}
                    />
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center sm:px-10">
                    {error && (
                        <p className="mb-2 text-xs font-bold text-rose-500" role="alert">
                            {error}
                        </p>
                    )}
                    <p className="text-[11px] font-semibold text-slate-400">
                        A role is required to continue. Learners can become creators later — and creators can always learn.
                    </p>
                </div>
            </div>
        </div>
    );
}

function Door({
    kicker,
    verb,
    body,
    action,
    selected,
    busy,
    onClick,
}: {
    kicker: string;
    verb: string;
    body: string;
    action: string;
    selected: boolean;
    busy: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            aria-pressed={selected}
            className={`group flex flex-col p-7 pb-6 text-left transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)] sm:p-8 sm:pb-7 ${
                selected
                    ? 'bg-[var(--brand-light)]/50'
                    : busy
                      ? 'opacity-50'
                      : 'hover:bg-[var(--brand-light)]/30 cursor-pointer'
            }`}
        >
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-[var(--brand)] transition-colors">
                {kicker}
            </span>

            <span className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-[40px] sm:leading-none">
                {verb}
            </span>

            <span className="mt-3 text-[13px] leading-relaxed text-slate-500 flex-1">
                {body}
            </span>

            <span
                className={`mt-6 inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest transition-colors ${
                    selected ? 'text-[var(--brand-dark)]' : 'text-[var(--brand)]'
                }`}
            >
                {selected ? (
                    <>
                        Setting up
                        <Loader2 size={14} strokeWidth={3} className="animate-spin" />
                    </>
                ) : (
                    <>
                        {action}
                        <ArrowRight
                            size={14}
                            strokeWidth={3}
                            className="transition-transform duration-200 group-hover:translate-x-1"
                        />
                    </>
                )}
            </span>
        </button>
    );
}
