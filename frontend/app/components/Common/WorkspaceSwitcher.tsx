'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronsUpDown, Check, Loader2, Plus } from 'lucide-react';
import { AuthService, WorkspaceMembership } from '@/services/api/AuthService';
import { useSession } from '@/hooks/useSession';

const ROLE_LABELS: Record<string, string> = {
    STUDENT: 'Learner',
    TEACHER: 'Instructor',
    ADMIN: 'Org Admin',
    SUPER_ADMIN: 'Super Admin',
};

/**
 * Lists every dashboard persona a user holds (Learner in org A, Instructor
 * on their own personal org, etc.) and lets them switch between them.
 * Switching never changes any persona's underlying role/org — it only
 * re-points which membership subsequent requests resolve against (see
 * MembershipService on the backend). A single-persona account still sees
 * the "Become a Creator" self-serve entry point if it hasn't claimed
 * a Creator persona yet.
 */
export default function WorkspaceSwitcher({ sessionUser }: { sessionUser?: any }) {
    const router = useRouter();
    const { refetch } = useSession();
    const [open, setOpen] = useState(false);
    const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
    const [becomingCreator, setBecomingCreator] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    const { data: memberships = [] } = useQuery({
        queryKey: ['workspace-memberships', sessionUser?.id],
        queryFn: () => AuthService.listMemberships(),
        enabled: Boolean(sessionUser?.id),
        staleTime: 30_000,
    });

    useEffect(() => {
        function close(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const hasCreatorPersona = memberships.some(
        (membership) => membership.role === 'TEACHER' || membership.role === 'ADMIN',
    );
    const canBecomeCreator = sessionUser?.role === 'STUDENT' && !hasCreatorPersona;

    const activeMembership =
        memberships.find((membership) => membership.orgId === sessionUser?.orgId) || memberships[0];

    const landOnDashboard = async () => {
        await refetch();
        setOpen(false);
        // Role can differ per persona — route through the same
        // role-resolving redirect the app already uses after login rather
        // than assuming the current page still applies.
        router.push('/dashboard');
    };

    const handleSwitch = async (membership: WorkspaceMembership) => {
        if (membership.orgId === activeMembership?.orgId || switchingOrgId) {
            setOpen(false);
            return;
        }

        setSwitchingOrgId(membership.orgId);
        setError(null);

        try {
            await AuthService.switchOrg(membership.orgId);
            await landOnDashboard();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to switch workspace');
        } finally {
            setSwitchingOrgId(null);
        }
    };

    const handleBecomeCreator = async () => {
        if (becomingCreator) return;

        setBecomingCreator(true);
        setError(null);

        try {
            const persona = await AuthService.becomeCreator();
            await AuthService.switchOrg(persona.orgId);
            await landOnDashboard();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to set up your creator workspace');
        } finally {
            setBecomingCreator(false);
        }
    };

    if (memberships.length <= 1 && !canBecomeCreator) {
        return null;
    }

    if (memberships.length <= 1 && canBecomeCreator) {
        return (
            <div className="relative" title={error || 'Become a Creator'}>
                <button
                    onClick={handleBecomeCreator}
                    disabled={becomingCreator}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--brand-light)] hover:bg-[var(--brand-light)]/70 disabled:opacity-60 rounded-xl border border-[var(--brand-light)] transition-colors text-[var(--brand)]"
                >
                    {becomingCreator ? (
                        <Loader2 size={13} className="animate-spin" />
                    ) : (
                        <Plus size={13} />
                    )}
                    <span className="hidden sm:block text-[11px] font-black">
                        {becomingCreator ? 'Setting up…' : 'Become a Creator'}
                    </span>
                </button>
                {error && (
                    <p className="absolute right-0 top-full mt-1 w-48 text-[10px] font-bold text-rose-500 text-right">
                        {error}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setOpen((value) => !value)}
                disabled={Boolean(switchingOrgId)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 rounded-xl border border-slate-200/80 transition-colors max-w-[180px]"
                title="Switch workspace"
            >
                <div className="w-6 h-6 rounded-lg bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                    {switchingOrgId ? (
                        <Loader2 size={13} className="animate-spin" />
                    ) : (
                        <Building2 size={13} />
                    )}
                </div>
                <span className="hidden sm:block text-left leading-tight min-w-0">
                    <span className="block text-[11px] font-black text-slate-800 truncate">
                        {switchingOrgId
                            ? 'Switching…'
                            : activeMembership?.orgName || 'Workspace'}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                        {ROLE_LABELS[activeMembership?.role || ''] || 'Workspace'}
                    </span>
                </span>
                <ChevronsUpDown size={13} className="text-slate-400 shrink-0 hidden sm:block" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200/60 py-2 z-50">
                    <p className="px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Your workspaces
                    </p>
                    {memberships.map((membership) => {
                        const isActive = membership.orgId === activeMembership?.orgId;
                        const isSwitchingThis = switchingOrgId === membership.orgId;
                        return (
                            <button
                                key={membership.orgId}
                                onClick={() => handleSwitch(membership)}
                                disabled={Boolean(switchingOrgId)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left disabled:opacity-60 hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                                    {isSwitchingThis ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Building2 size={14} />
                                    )}
                                </div>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-bold text-slate-700 truncate">
                                        {membership.orgName}
                                    </span>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                        {ROLE_LABELS[membership.role] || membership.role}
                                        {membership.isHome ? ' · Home' : ''}
                                    </span>
                                </span>
                                {isActive && <Check size={15} className="text-[var(--brand)] shrink-0" />}
                            </button>
                        );
                    })}
                    {canBecomeCreator && (
                        <>
                            <div className="h-px bg-slate-100 my-1.5 mx-2" />
                            <button
                                onClick={handleBecomeCreator}
                                disabled={becomingCreator}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left disabled:opacity-60 hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                                    {becomingCreator ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Plus size={14} />
                                    )}
                                </div>
                                <span className="text-[13px] font-bold text-[var(--brand)]">
                                    {becomingCreator ? 'Setting up…' : 'Become a Creator'}
                                </span>
                            </button>
                        </>
                    )}
                    {error && (
                        <p className="px-4 pt-2 text-[11px] font-bold text-rose-500">{error}</p>
                    )}
                </div>
            )}
        </div>
    );
}
