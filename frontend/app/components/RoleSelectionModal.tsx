'use client';

import { useState } from 'react';
import posthog from 'posthog-js';
import {
    GraduationCap,
    Presentation,
    Check,
    ArrowRight,
    Loader2,
    Sparkles,
} from 'lucide-react';

type Role = 'STUDENT';

interface RoleSelectionModalProps {
    onSelectRole: (role: Role) => Promise<void>;
    onSelectCreator: () => Promise<void>;
}

export default function RoleSelectionModal({ onSelectRole, onSelectCreator }: RoleSelectionModalProps) {
    const [selectedRole, setSelectedRole] = useState<Role | 'CREATOR' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSelect = async (role: Role) => {
        if (selectedRole && selectedRole !== role) return;
        setError(null);
        setSelectedRole(role);
        posthog.capture('role_selected', { role });

        try {
            await onSelectRole(role);
        } catch (err: unknown) {
            setSelectedRole(null);
            const message = err instanceof Error ? err.message : 'Failed to save role. Please try again.';
            setError(message);
        }
    };

    const handleSelectCreator = async () => {
        if (selectedRole && selectedRole !== 'CREATOR') return;
        setError(null);
        setSelectedRole('CREATOR');
        posthog.capture('role_selected', { role: 'CREATOR' });

        try {
            await onSelectCreator();
        } catch (err: unknown) {
            setSelectedRole(null);
            const message = err instanceof Error ? err.message : 'Failed to set creator role. Please try again.';
            setError(message);
        }
    };

    const busy = selectedRole !== null;

    return (
        <div className="fixed inset-0 z-[2100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-[680px] bg-white rounded-[28px] p-6 shadow-2xl border border-slate-100 sm:p-10 animate-in fade-in zoom-in-95 duration-300 max-h-[calc(100dvh-32px)] overflow-y-auto">
                {/* Header */}
                <div className="text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-light)]/40 text-[var(--brand)] text-[10px] font-black uppercase tracking-widest">
                        <Sparkles size={12} strokeWidth={2.5} />
                        Welcome to Mentrily
                    </span>
                    <h2 className="mt-4 text-2xl font-black text-slate-900 tracking-tight leading-tight sm:text-[28px]">
                        How will you use Mentrily?
                    </h2>
                    <p className="mt-2 text-sm font-medium text-slate-500 max-w-md mx-auto">
                        Pick the workspace that fits you. You can add the other role later — nothing here is permanent.
                    </p>
                </div>

                {/* Cards */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <RoleCard
                        icon={<GraduationCap size={22} strokeWidth={2.25} />}
                        title="Learner"
                        description="Enroll in courses, take exams, and grow your skills."
                        badge="Student"
                        features={[
                            'Enroll in courses & modules',
                            'Take exams and track scores',
                            'Earn shareable certificates',
                        ]}
                        selected={selectedRole === 'STUDENT'}
                        disabled={busy && selectedRole !== 'STUDENT'}
                        onClick={() => handleSelect('STUDENT')}
                    />

                    <RoleCard
                        icon={<Presentation size={22} strokeWidth={2.25} />}
                        title="Creator"
                        description="Build and run your own courses and assessments."
                        badge="Teacher"
                        features={[
                            'Author courses & assessments',
                            'Invite and manage learners',
                            'Starts free — upgrade anytime',
                        ]}
                        selected={selectedRole === 'CREATOR'}
                        disabled={busy && selectedRole !== 'CREATOR'}
                        onClick={handleSelectCreator}
                    />
                </div>

                {error && (
                    <p className="mt-5 text-xs font-bold text-rose-500 text-center" role="alert">
                        {error}
                    </p>
                )}

                <p className="mt-5 text-[11px] font-bold text-slate-400 text-center">
                    A role is required to continue — this step can’t be skipped.
                </p>
            </div>
        </div>
    );
}

function RoleCard({
    icon,
    title,
    description,
    badge,
    features,
    selected,
    disabled,
    onClick,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    badge: string;
    features: string[];
    selected: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={selected}
            className={`group relative flex flex-col rounded-[22px] border-2 p-6 text-left transition-all duration-200 disabled:cursor-not-allowed ${
                selected
                    ? 'border-[var(--brand)] bg-[var(--brand-light)]/25 shadow-lg shadow-[var(--brand)]/10'
                    : disabled
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-200 hover:border-[var(--brand)] hover:bg-[var(--brand-light)]/15 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60'
            }`}
        >
            {/* Selected check */}
            {selected && (
                <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center">
                    <Loader2 size={13} className="animate-spin" />
                </span>
            )}

            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center group-hover:scale-105 transition-transform">
                {icon}
            </div>

            <h3 className="mt-4 text-lg font-black text-slate-900 tracking-tight">{title}</h3>
            <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">{description}</p>

            <ul className="mt-4 space-y-2">
                {features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-[12px] font-semibold text-slate-600">
                        <Check size={14} strokeWidth={3} className="mt-0.5 flex-shrink-0 text-[var(--brand)]" />
                        <span>{feat}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest group-hover:bg-[var(--brand-light)]/40 group-hover:text-[var(--brand)] transition-colors">
                    {badge}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-[var(--brand)] uppercase tracking-widest opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                    Choose
                    <ArrowRight size={13} strokeWidth={3} />
                </span>
            </div>
        </button>
    );
}
