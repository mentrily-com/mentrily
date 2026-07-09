'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { AuthService, WorkspaceMembership } from '@/services/api/AuthService';
import { useSession } from '@/hooks/useSession';

const ROLE_LABELS: Record<string, string> = {
    STUDENT: 'Learner',
    TEACHER: 'Instructor',
    ADMIN: 'Org Admin',
    SUPER_ADMIN: 'Super Admin',
};

/**
 * Only renders once someone actually belongs to more than one org — a
 * single-workspace account sees nothing new. Switching never changes the
 * account's home org/role; it only re-points which org subsequent requests
 * resolve against (see MembershipService on the backend).
 */
export default function WorkspaceSwitcher({ sessionUser }: { sessionUser?: any }) {
    const router = useRouter();
    const { refetch } = useSession();
    const [open, setOpen] = useState(false);
    const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
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

    if (memberships.length <= 1) {
        return null;
    }

    const activeMembership =
        memberships.find((membership) => membership.orgId === sessionUser?.orgId) || memberships[0];

    const handleSwitch = async (membership: WorkspaceMembership) => {
        if (membership.orgId === activeMembership?.orgId || switchingOrgId) {
            setOpen(false);
            return;
        }

        setSwitchingOrgId(membership.orgId);
        setError(null);

        try {
            await AuthService.switchOrg(membership.orgId);
            await refetch();
            setOpen(false);
            // Role can differ per org — route through the same
            // role-resolving redirect the app already uses after login
            // rather than assuming the current page still applies.
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to switch workspace');
        } finally {
            setSwitchingOrgId(null);
        }
    };

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
                    {error && (
                        <p className="px-4 pt-2 text-[11px] font-bold text-rose-500">{error}</p>
                    )}
                </div>
            )}
        </div>
    );
}
