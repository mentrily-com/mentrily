'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronsUpDown, Check, Loader2, Plus, GraduationCap, Presentation } from 'lucide-react';
import { AuthService, WorkspaceMembership } from '@/services/api/AuthService';
import { useSession } from '@/hooks/useSession';
import { buildOrgUrl, getRootDomain, getCurrentSubdomain } from '@/lib/domain';

const ROLE_LABELS: Record<string, string> = {
    STUDENT: 'Learner',
    TEACHER: 'Instructor',
    ADMIN: 'Org Admin',
    SUPER_ADMIN: 'Super Admin',
};

// Sentinel orgId for the synthetic Learner entry — it maps to
// AuthService.switchToLearner() (an org-less Student persona) rather than a
// real org switch.
const LEARNER_SENTINEL = '__learner__';
// Sentinel for a creator whose home role is TEACHER/ADMIN but who has no
// OrgMembership row (accounts from before signup provisioned a personal
// org). Maps to AuthService.switchToHome() so they can get back from the
// learner persona to their flat creator home.
const CREATOR_HOME_SENTINEL = '__creator_home__';

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
    const queryClient = useQueryClient();
    const { refetch } = useSession();
    const [open, setOpen] = useState(false);
    const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
    const [switchingMembershipId, setSwitchingMembershipId] = useState<string | null>(null);
    const [becomingCreator, setBecomingCreator] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    // Which org subdomain (if any) this tab is on. Resolved in an effect so
    // SSR and the first client paint agree (both render the apex view).
    const [currentSubdomain, setCurrentSubdomain] = useState<string | null>(null);
    useEffect(() => {
        setCurrentSubdomain(getCurrentSubdomain());
    }, []);

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

    // Prefix of an org's full subdomain host ("tester.mentrily.com" → "tester").
    const orgSubPrefix = (membership: WorkspaceMembership): string | null =>
        membership.orgDomain ? membership.orgDomain.split('.')[0] || null : null;
    // On an org subdomain, only that org's workspaces are reachable
    // (enforceTenantAccess 403s everything else) — the switcher must not
    // offer workspaces the host can't serve.
    const tenantMembership = currentSubdomain
        ? memberships.find((m) => orgSubPrefix(m) === currentSubdomain)
        : undefined;
    const onTenantSubdomain = Boolean(currentSubdomain);

    const hasCreatorPersona = memberships.some(
        (membership) =>
            membership.role === 'TEACHER' || membership.role === 'ADMIN' || membership.role === 'SUPER_ADMIN',
    );
    // Home persona is the flat account role, independent of whichever org is
    // currently active (homeRole/homeOrgId come straight from /auth/me).
    const homeRole: string | undefined = sessionUser?.homeRole ?? sessionUser?.role;
    const canBecomeCreator = !onTenantSubdomain && homeRole === 'STUDENT' && !hasCreatorPersona;

    // Every account can act as a learner. If the user has no Student membership
    // of their own (a signup-creator who was never a learner, or an org-less
    // learner whose home isn't an OrgMembership row), inject a synthetic
    // "My Learning" entry that flips them into an org-less Student persona.
    const hasStudentMembership = memberships.some((membership) => membership.role === 'STUDENT');
    const needsLearnerEntry = !hasStudentMembership;
    // Legacy signup-creators (role TEACHER, zero membership rows) still need a
    // way back out of the learner persona — give their flat creator home a
    // synthetic entry wired to switch-home.
    const isCreatorHome = homeRole === 'TEACHER' || homeRole === 'ADMIN' || homeRole === 'SUPER_ADMIN';
    const needsCreatorHomeEntry = (isCreatorHome && !hasCreatorPersona) || homeRole === 'SUPER_ADMIN';
    const expandedMemberships = memberships.flatMap((m) => {
        if (m.role === 'TEACHER' || m.role === 'ADMIN' || m.role === 'SUPER_ADMIN') {
            if (m.orgKind !== 'PERSONAL') {
                return [m, { ...m, role: 'STUDENT' as const, isLearnerPreview: true }];
            }
            return [m];
        }
        return [m];
    });

    const displayMemberships: WorkspaceMembership[] = onTenantSubdomain
        ? // On an org subdomain: only this org's workspaces (its creator row
          // plus the learner-preview expansion) — no sentinels, no other
          // orgs. The whole subdomain reads as this org's own product.
          expandedMemberships.filter((m) => orgSubPrefix(m) === currentSubdomain)
        : [
              ...(needsLearnerEntry
                  ? [
                        {
                            orgId: LEARNER_SENTINEL,
                            orgName: 'My Learning',
                            orgSlug: null,
                            role: 'STUDENT' as const,
                            isHome: !isCreatorHome,
                        },
                    ]
                  : []),
              ...(needsCreatorHomeEntry
                  ? [
                        {
                            orgId: CREATOR_HOME_SENTINEL,
                            orgName: homeRole === 'SUPER_ADMIN' ? 'Super Admin' : 'My Workspace',
                            orgSlug: null,
                            role: (homeRole === 'SUPER_ADMIN'
                                ? 'SUPER_ADMIN'
                                : homeRole === 'ADMIN'
                                  ? 'ADMIN'
                                  : 'TEACHER') as 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER',
                            isHome: true,
                        },
                    ]
                  : []),
              ...expandedMemberships,
          ];

    // In learner mode the resolved role is STUDENT and there's no active org.
    // However, if they are in a learner preview, they HAVE an active org but role is STUDENT.
    const isLearnerActive = String(sessionUser?.role || '').toUpperCase() === 'STUDENT';
    const isLearnerPreviewActive = isLearnerActive && !!sessionUser?.orgId;
    const isGlobalLearnerActive = isLearnerActive && !sessionUser?.orgId;

    const activeMembership =
        displayMemberships.find((membership) => {
            if (membership.orgId === LEARNER_SENTINEL) return isGlobalLearnerActive;
            if (membership.orgId === CREATOR_HOME_SENTINEL) {
                return !isLearnerActive && !sessionUser?.orgId;
            }
            if ((membership as any).isLearnerPreview) {
                return isLearnerPreviewActive && membership.orgId === sessionUser?.orgId;
            }
            return !isLearnerActive && membership.orgId === sessionUser?.orgId;
        }) || displayMemberships[0];

    const landOnDashboard = async (membership?: WorkspaceMembership) => {
        // The memberships list changes on become-creator (new TEACHER row) and
        // must not be served stale (30s staleTime) — otherwise the creator
        // dashboard keeps showing "Become a Creator" until the cache expires.
        await queryClient.invalidateQueries({ queryKey: ['workspace-memberships'] });
        setOpen(false);

        let targetUrl = '/dashboard';
        const domainPrefix = membership ? orgSubPrefix(membership) : null;
        if (membership && domainPrefix) {
            targetUrl = buildOrgUrl(domainPrefix, '/dashboard') || '/dashboard';
        } else if (membership) {
            const root = getRootDomain();
            targetUrl = root === 'localhost' ? 'http://localhost:3000/dashboard' : `https://${root}/dashboard`;
        }

        // If the target is on the same host, use client-side routing for a seamless
        // transition without a white flash. We invalidate the session query so
        // the new layout instantly receives the updated persona.
        let isSameHost = false;
        try {
            if (targetUrl.startsWith('http')) {
                const target = new URL(targetUrl);
                if (target.host === window.location.host) {
                    isSameHost = true;
                }
            } else {
                isSameHost = true;
            }
        } catch (e) {
            // fallback
        }

        if (!isSameHost) {
            window.location.href = targetUrl;
        } else {
            // Remove the stale session data IMMEDIATELY. If we just invalidate,
            // React Query keeps serving the old role (e.g. TEACHER) while fetching.
            // When the new layout mounts, useRoleGuard sees the stale TEACHER role
            // on the Learner dashboard and prematurely kicks the user back!
            queryClient.resetQueries({ queryKey: ['session'] });
            const isStudent = membership?.role === 'STUDENT' || (membership as any)?.isLearnerPreview;
            const destination = isStudent ? '/dashboard/learner' : '/dashboard/creator';
            router.push(destination);
        }
    };

    const handleSwitch = async (membership: WorkspaceMembership) => {
        const isAlreadyActive =
            membership.orgId === activeMembership?.orgId && membership.role === activeMembership?.role;
        if (isAlreadyActive || switchingMembershipId) {
            setOpen(false);
            return;
        }

        const membershipId = `${membership.orgId}-${membership.role}`;
        setSwitchingMembershipId(membershipId);
        setError(null);

        // A STRICT org's workspace only activates on its own subdomain — the
        // backend rejects switch-org from any other host. Navigate there
        // instead; arrival on the subdomain forces the org resolution.
        const strictPrefix = orgSubPrefix(membership);
        if (membership.orgKind === 'STRICT' && strictPrefix && strictPrefix !== currentSubdomain) {
            const orgUrl = buildOrgUrl(strictPrefix, '/dashboard');
            if (orgUrl) {
                window.location.href = orgUrl;
                return;
            }
        }

        try {
            const switchPromise = (async () => {
                if (membership.orgId === LEARNER_SENTINEL) {
                    await AuthService.switchToLearner();
                } else if (membership.orgId === CREATOR_HOME_SENTINEL) {
                    await AuthService.switchToHome();
                } else if ((membership as any).isLearnerPreview) {
                    await AuthService.switchOrg(membership.orgId, { asLearner: true });
                } else {
                    await AuthService.switchOrg(membership.orgId);
                }
            })();

            switchPromise.catch((err) => {
                console.error('[WorkspaceSwitcher] background switch failed', err);
                setError(err instanceof Error ? err.message : 'Failed to switch workspace');
                setSwitchingMembershipId(null);
            });

            // Navigate instantly while the API requests happen in the background!
            landOnDashboard(membership);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to switch workspace');
            setSwitchingMembershipId(null);
        }
    };

    const handleBecomeCreator = async () => {
        if (becomingCreator) return;

        setBecomingCreator(true);
        setError(null);

        try {
            const persona = await AuthService.becomeCreator();
            await AuthService.switchOrg(persona.orgId);
            const root = getRootDomain();
            const targetUrl = root === 'localhost' ? 'http://localhost:3000/dashboard' : `https://${root}/dashboard`;
            // Hard navigate to force a full remount of dashboard/page.tsx.
            window.location.href = targetUrl;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to set up your creator workspace');
        } finally {
            setBecomingCreator(false);
        }
    };

    if (displayMemberships.length <= 1 && !canBecomeCreator) {
        return null;
    }

    if (displayMemberships.length <= 1 && canBecomeCreator) {
        return (
            <div className="relative" title={error || 'Become a Creator'}>
                <button
                    onClick={handleBecomeCreator}
                    disabled={becomingCreator}
                    aria-label={becomingCreator ? 'Setting up creator workspace' : 'Become a Creator'}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--brand-light)] hover:bg-[var(--brand-light)]/70 disabled:opacity-60 rounded-xl border border-[var(--brand-light)] transition-colors text-[var(--brand)]"
                >
                    {becomingCreator ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
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
                disabled={Boolean(switchingMembershipId)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 rounded-xl border border-slate-200/80 transition-colors max-w-[180px]"
                title="Switch workspace"
            >
                <div className="w-6 h-6 rounded-lg bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                    {switchingMembershipId ? <Loader2 size={13} className="animate-spin" /> : <Building2 size={13} />}
                </div>
                <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[11px] font-black text-slate-800 truncate">
                        {switchingMembershipId ? 'Switching…' : activeMembership?.orgName || 'Workspace'}
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
                    {Object.values(
                        displayMemberships.reduce(
                            (acc, m) => {
                                if (!acc[m.orgId]) acc[m.orgId] = [];
                                acc[m.orgId].push(m);
                                return acc;
                            },
                            {} as Record<string, WorkspaceMembership[]>,
                        ),
                    ).map((group) => {
                        const org = group[0];
                        const isLearnerEntry = org.orgId === LEARNER_SENTINEL;
                        const isCreatorHomeEntry = org.orgId === CREATOR_HOME_SENTINEL;
                        const hasMultipleRoles = group.length > 1;
                        const isExpanded = expandedOrgId === org.orgId;

                        const renderIcon = (role?: string, membershipId?: string) => {
                            if (membershipId && switchingMembershipId === membershipId)
                                return <Loader2 size={14} className="animate-spin" />;
                            if (!membershipId && switchingMembershipId && switchingMembershipId.startsWith(org.orgId))
                                return <Loader2 size={14} className="animate-spin" />;
                            if (isLearnerEntry || role === 'STUDENT') return <GraduationCap size={14} />;
                            if (isCreatorHomeEntry) return <Presentation size={14} />;
                            return <Building2 size={14} />;
                        };

                        if (hasMultipleRoles) {
                            return (
                                <div key={org.orgId}>
                                    <button
                                        onClick={() => setExpandedOrgId(isExpanded ? null : org.orgId)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                                            {renderIcon()}
                                        </div>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[13px] font-bold text-slate-700 truncate">
                                                {org.orgName}
                                            </span>
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                {group.length} Roles
                                            </span>
                                        </span>
                                        <ChevronsUpDown size={13} className="text-slate-400 shrink-0" />
                                    </button>

                                    {isExpanded && (
                                        <div className="bg-slate-50/50 py-1">
                                            {group.map((membership) => {
                                                const isActive =
                                                    membership.orgId === activeMembership?.orgId &&
                                                    membership.role === activeMembership?.role;
                                                const membershipId = `${membership.orgId}-${membership.role}`;
                                                return (
                                                    <button
                                                        key={membershipId}
                                                        onClick={() => handleSwitch(membership)}
                                                        disabled={Boolean(switchingMembershipId)}
                                                        className="w-full flex items-center gap-3 pl-12 pr-4 py-2 text-left disabled:opacity-60 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <div className="w-5 h-5 rounded flex items-center justify-center bg-white border border-slate-200 text-slate-500 shrink-0">
                                                            {renderIcon(membership.role, membershipId)}
                                                        </div>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-[11px] font-bold text-slate-600 truncate">
                                                                {ROLE_LABELS[membership.role] || membership.role}
                                                            </span>
                                                        </span>
                                                        {isActive && (
                                                            <Check size={13} className="text-[var(--brand)] shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        const membership = group[0];
                        const isActive =
                            membership.orgId === activeMembership?.orgId && membership.role === activeMembership?.role;
                        const membershipId = `${membership.orgId}-${membership.role}`;

                        return (
                            <button
                                key={membershipId}
                                onClick={() => handleSwitch(membership)}
                                disabled={Boolean(switchingMembershipId)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left disabled:opacity-60 hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center shrink-0">
                                    {renderIcon(membership.role, membershipId)}
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
                    {error && <p className="px-4 pt-2 text-[11px] font-bold text-rose-500">{error}</p>}
                </div>
            )}
        </div>
    );
}
