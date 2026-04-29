'use client';

import { useState } from 'react';
import posthog from 'posthog-js';

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

    const learnerDisabled = selectedRole === 'CREATOR';
    const creatorDisabled = selectedRole === 'STUDENT';

    return (
        <div className="fixed inset-0 z-[2100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-[620px] bg-white rounded-[28px] p-10 shadow-2xl border border-slate-100 text-center">
                <h2 className="text-[28px] font-black text-slate-900 tracking-tight leading-tight">
                    Welcome! How will you use Mentrily?
                </h2>
                <p className="mt-3 text-sm font-medium text-slate-500">
                    Choose your role to get started. You can always contact an admin to change it later.
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <RoleCard
                        icon="🎓"
                        title="Learner"
                        description="Access courses, complete exercises, and track your learning progress."
                        badge="Student"
                        loading={selectedRole === 'STUDENT'}
                        disabled={learnerDisabled}
                        onClick={() => handleSelect('STUDENT')}
                    />

                    <button
                        type="button"
                        onClick={handleSelectCreator}
                        disabled={creatorDisabled}
                        className={`group rounded-[20px] border-2 p-6 text-left transition-all ${
                            creatorDisabled ? 'opacity-70 cursor-not-allowed' : ''
                        } ${
                            selectedRole === 'CREATOR'
                                ? 'border-[var(--brand)] bg-[var(--brand-light)]/20'
                                : 'border-slate-200 hover:border-[var(--brand)] hover:bg-[var(--brand-light)]/20'
                        }`}
                    >
                        <div className="text-3xl">🏫</div>
                        <h3 className="mt-3 text-lg font-black text-slate-900">Creator</h3>
                        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                            Personal teacher account on Free. Create courses and assessments now, then upgrade later for team features.
                        </p>

                        <div className="mt-4 flex items-center justify-between">
                            <span className="inline-flex px-3 py-1 rounded-full bg-[var(--brand-light)]/30 text-[var(--brand)] text-[11px] font-black uppercase tracking-widest">
                                Teacher
                            </span>

                            {selectedRole === 'CREATOR' && (
                                <span className="inline-flex items-center gap-2 text-[11px] font-black text-[var(--brand)] uppercase tracking-widest">
                                    <span className="w-3 h-3 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin" />
                                    Saving...
                                </span>
                            )}
                        </div>
                    </button>
                </div>

                {error && (
                    <p className="mt-5 text-xs font-bold text-rose-500" role="alert">
                        {error}
                    </p>
                )}

                <p className="mt-4 text-[11px] font-bold text-slate-400">
                    This modal cannot be dismissed — a role is required to continue.
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
    loading,
    disabled,
    onClick,
}: {
    icon: string;
    title: string;
    description: string;
    badge: string;
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="group rounded-[20px] border-2 border-slate-200 p-6 text-left transition-all hover:border-[var(--brand)] hover:bg-[var(--brand-light)]/20 disabled:opacity-70 disabled:cursor-not-allowed"
        >
            <div className="text-3xl">{icon}</div>
            <h3 className="mt-3 text-lg font-black text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>

            <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-widest">
                    {badge}
                </span>

                {loading && (
                    <span className="inline-flex items-center gap-2 text-[11px] font-black text-[var(--brand)] uppercase tracking-widest">
                        <span className="w-3 h-3 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin" />
                        Saving...
                    </span>
                )}
            </div>
        </button>
    );
}
