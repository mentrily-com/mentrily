'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { useSession } from '@/hooks/useSession';
import { BrandLockup } from '@/components/brand/BrandLockup';
import ImpersonationBanner from '@/app/components/Common/ImpersonationBanner';
import PaymentFailedBanner from '@/app/components/Common/PaymentFailedBanner';
import WorkspaceSwitcher from '@/app/components/Common/WorkspaceSwitcher';
// import CrispWidget from '@/app/components/CrispWidget';
import { LogOut, User, Settings, ChevronDown, Compass, Menu } from 'lucide-react';

type NavbarRole = 'student' | 'teacher' | 'admin' | 'super-admin';

interface DashboardTopbarProps {
    userRole?: NavbarRole;
    collapsed?: boolean;
    onMobileMenuClick?: () => void;
}

export default function DashboardTopbar({ userRole, collapsed = false, onMobileMenuClick }: DashboardTopbarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user: clerkUser } = useUser();
    const { isLoaded } = useAuth();
    const clerk = useClerk();
    const { data: sessionUser } = useSession();
    const { organization: orgContext } = useOrganization();

    const [profileOpen, setProfileOpen] = useState(false);
    const [storedRole] = useState<NavbarRole | null>(() => {
        if (typeof window === 'undefined') return null;
        const savedRole = localStorage.getItem('user-role');
        return savedRole === 'student' ||
            savedRole === 'teacher' ||
            savedRole === 'admin' ||
            savedRole === 'super-admin'
            ? savedRole
            : null;
    });
    const profileRef = useRef<HTMLDivElement | null>(null);

    const role = useMemo<NavbarRole>(() => {
        const backendRole = String(sessionUser?.role || '').toUpperCase();
        const derivedRole =
            backendRole === 'SUPER_ADMIN'
                ? 'super-admin'
                : backendRole === 'ADMIN'
                  ? 'admin'
                  : backendRole === 'TEACHER'
                    ? 'teacher'
                    : backendRole === 'LEARNER' || backendRole === 'STUDENT'
                      ? 'student'
                      : null;

        if (userRole) return userRole;
        if (pathname?.startsWith('/dashboard/super-admin')) return 'super-admin';
        if (pathname?.startsWith('/dashboard/creator')) {
            if (derivedRole === 'admin' || derivedRole === 'teacher') return derivedRole;
            return 'teacher';
        }
        if (pathname?.startsWith('/dashboard/learner')) return 'student';
        if (pathname?.startsWith('/playground')) {
            if (derivedRole) return derivedRole;
            if (storedRole) return storedRole;
            return 'teacher';
        }
        return 'student';
    }, [userRole, pathname, sessionUser?.role, storedRole]);

    const isTeacher = role === 'teacher';
    const isAdmin = role === 'admin';
    const isSuperAdmin = role === 'super-admin';
    const isPlaygroundRoute = Boolean(pathname?.startsWith('/playground'));
    const backendRole = String(sessionUser?.role || '').toUpperCase();
    const isCreatorSessionPending =
        Boolean(pathname?.startsWith('/dashboard/creator')) && backendRole !== 'ADMIN' && backendRole !== 'TEACHER';

    const mustChangePassword = (sessionUser as Record<string, unknown> | null)?.mustChangePassword === true;

    const planStatus = String((sessionUser as Record<string, unknown> | null)?.planStatus || '').toUpperCase();
    const showPaymentFailedBanner = pathname?.startsWith('/dashboard') && planStatus === 'PAST_DUE';

    const userName = ((sessionUser as Record<string, unknown> | null)?.name as string) || clerkUser?.fullName || 'User';
    const userEmail =
        ((sessionUser as Record<string, unknown> | null)?.email as string) ||
        clerkUser?.primaryEmailAddress?.emailAddress ||
        '';
    const userInitial = userName.charAt(0).toUpperCase();
    const avatarUrl =
        clerkUser?.imageUrl || ((sessionUser as Record<string, unknown> | null)?.profilePicture as string | undefined);

    const normalizedPlan = String((sessionUser as Record<string, unknown> | null)?.plan || '').toUpperCase();
    const isEnterprisePlan = normalizedPlan === 'ENTERPRISE';

    const contextTitle = useMemo(() => {
        if (pathname?.startsWith('/dashboard/creator/courses/create')) return 'Create Course';
        if (pathname?.startsWith('/dashboard/creator/exams/new')) return 'Create Exam';
        if (pathname?.startsWith('/dashboard/creator/courses')) return 'Courses';
        if (pathname?.startsWith('/dashboard/creator/exams')) return 'Exams';
        if (pathname?.startsWith('/dashboard/creator/users')) return 'Users';
        if (pathname?.startsWith('/dashboard/creator/analytics')) return 'Analytics';
        if (pathname?.startsWith('/playground/web')) return 'Web Playground';
        if (pathname?.startsWith('/playground/pynb')) return 'Notebook Playground';
        if (pathname?.startsWith('/playground')) return 'Code Playground';
        if (pathname?.startsWith('/dashboard/creator')) return 'Studio';
        if (pathname?.startsWith('/dashboard/learner')) return 'Learning Hub';
        if (pathname?.startsWith('/dashboard/super-admin')) return 'Super Admin';
        return 'Dashboard';
    }, [pathname]);

    const getRoleLabel = () => {
        if (isCreatorSessionPending) return 'Loading';
        if (isSuperAdmin) return 'Super Admin';
        if (isAdmin) return 'Organization Admin';
        if (isTeacher) return 'Instructor';
        return 'Learner';
    };

    const profilePath = isSuperAdmin
        ? '/dashboard/super-admin/profile'
        : isAdmin || isTeacher
          ? '/dashboard/creator/profile'
          : '/dashboard/learner/profile';
    const workspaceHomePath = isSuperAdmin
        ? '/dashboard/super-admin'
        : isAdmin || isTeacher
          ? '/dashboard/creator'
          : '/dashboard/learner';

    // Close profile dropdown on outside click
    useEffect(() => {
        function close(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    // Password change redirect
    useEffect(() => {
        if (!pathname || !isLoaded || !sessionUser) return;
        if (mustChangePassword && !pathname.includes('/profile')) {
            if (isTeacher || isAdmin) {
                router.replace('/dashboard/creator/profile');
            } else {
                router.replace(profilePath);
            }
        }
    }, [pathname, router, isLoaded, sessionUser, mustChangePassword, isTeacher, isAdmin, profilePath]);

    // Persist role
    useEffect(() => {
        if (typeof window !== 'undefined' && !isCreatorSessionPending) {
            const current = localStorage.getItem('user-role');
            if (current !== role) {
                localStorage.setItem('user-role', role);
            }
        }
    }, [role, isCreatorSessionPending]);

    const handleSignOut = async () => {
        setProfileOpen(false);
        try {
            await clerk.signOut({ redirectUrl: '/login' });
        } catch {
            router.replace('/login');
        }
    };

    return (
        <>
            {/* {(isTeacher || isAdmin) && !isCreatorSessionPending && <CrispWidget role={isAdmin ? 'ADMIN' : 'TEACHER'} />} */}
            <ImpersonationBanner />
            {showPaymentFailedBanner && <PaymentFailedBanner />}

            <header
                className="fixed top-0 right-0 left-0 lg:left-[var(--sidebar-current-width)] z-[998] border-b bg-white/95 backdrop-blur flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 transition-[left] duration-250 ease-in-out"
                style={{
                    height: 'var(--topbar-height)',
                    borderColor: 'var(--color-border-subtle)',
                    boxShadow: 'var(--shadow-xs)',
                }}
            >
                {/* ── Left: Mobile menu + brand (mobile) | Page area (desktop) ── */}
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    {/* Mobile hamburger */}
                    <div className="lg:hidden flex min-w-0 items-center gap-2">
                        <button
                            onClick={onMobileMenuClick}
                            className="p-1.5 -ml-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            aria-label="Open mobile menu"
                            aria-expanded={!collapsed}
                        >
                            <Menu size={20} />
                        </button>
                        <div
                            className="flex min-w-0 items-center gap-2 cursor-pointer"
                            onClick={() => router.push('/dashboard')}
                        >
                            <BrandLockup
                                orgName={orgContext?.name}
                                orgLogo={orgContext?.logo}
                                defaultLogoClassName="h-7 max-w-[140px]"
                                iconClassName="h-8 w-8 rounded-lg"
                                textClassName="text-sm font-bold sm:text-base"
                                priority
                            />
                        </div>
                    </div>

                    <div
                        className="hidden md:flex items-center gap-2 rounded-lg px-2.5 py-1"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        <Compass size={13} style={{ color: 'var(--color-text-muted)' }} />
                        <span
                            className="text-[11px] font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            {contextTitle}
                        </span>
                    </div>

                    {/* Password warning */}
                    {mustChangePassword && (
                        <div
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{
                                backgroundColor: 'var(--color-bg-red-tint)',
                                color: 'var(--color-text-danger)',
                                border: '1px solid #FECACA',
                            }}
                        >
                            Password Change Required
                        </div>
                    )}
                </div>

                {/* ── Right: Actions ── */}
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    {/* Super admin exit button */}
                    {isSuperAdmin && pathname?.includes('/organizations/') && (
                        <button
                            onClick={() => router.push('/dashboard/super-admin/organizations')}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                            style={{
                                backgroundColor: 'var(--color-bg-amber-tint)',
                                color: '#92400E',
                                border: '1px solid #FDE68A',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF3C7')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-amber-tint)')}
                        >
                            Exit View
                        </button>
                    )}

                    {isPlaygroundRoute && (
                        <button
                            onClick={() => router.push(workspaceHomePath)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                            style={{
                                backgroundColor: 'var(--color-bg-amber-tint)',
                                color: '#92400E',
                                border: '1px solid #FDE68A',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF3C7')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-amber-tint)')}
                        >
                            Exit Playground
                        </button>
                    )}

                    {/* Workspace switcher — lets a multi-persona user (e.g. a
                        learner who became a creator) hop back to their other
                        dashboard. Self-hides when there's only one workspace. */}
                    {!isPlaygroundRoute && <WorkspaceSwitcher sessionUser={sessionUser} />}

                    {/* Divider */}
                    <div
                        className="hidden h-6 w-px sm:block"
                        style={{ backgroundColor: 'var(--color-border-subtle)' }}
                    />

                    {/* Profile dropdown */}
                    <div ref={profileRef} className="relative flex items-center gap-2.5">
                        {/* Name + role (desktop only) */}
                        <div className="hidden sm:block text-right">
                            <p
                                className="text-sm font-semibold leading-none"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                {userName}
                            </p>
                            <p
                                className="text-[10px] font-medium uppercase tracking-wider mt-0.5"
                                style={{ color: 'var(--brand, #008D98)' }}
                            >
                                {getRoleLabel()}
                            </p>
                        </div>

                        {/* Avatar */}
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm overflow-hidden cursor-pointer shrink-0"
                            style={{ backgroundColor: 'var(--brand, #008D98)' }}
                            aria-label="Profile menu"
                            aria-haspopup="true"
                            aria-expanded={profileOpen}
                        >
                            {avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                            ) : (
                                userInitial
                            )}
                        </button>

                        {/* Chevron */}
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            className="hidden sm:flex w-5 h-5 items-center justify-center cursor-pointer"
                            style={{ color: 'var(--color-text-muted)' }}
                            aria-label="Toggle profile menu"
                            aria-haspopup="true"
                            aria-expanded={profileOpen}
                        >
                            <ChevronDown
                                size={14}
                                className={`transition-transform duration-150 ${profileOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {/* Dropdown */}
                        {profileOpen && (
                            <div
                                className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-64 rounded-xl bg-white border overflow-hidden animate-fade-in z-50"
                                style={{
                                    borderColor: 'var(--color-border-subtle)',
                                    boxShadow: 'var(--shadow-lg)',
                                }}
                            >
                                {/* User info */}
                                <div
                                    className="px-4 py-3 border-b flex items-center gap-3"
                                    style={{ borderColor: 'var(--color-border-subtle)' }}
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold overflow-hidden shrink-0"
                                        style={{ backgroundColor: 'var(--brand, #008D98)' }}
                                    >
                                        {avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={avatarUrl}
                                                alt={userName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            userInitial
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p
                                            className="text-sm font-semibold truncate"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            {userName}
                                        </p>
                                        {userEmail && (
                                            <p
                                                className="text-[11px] truncate mt-0.5"
                                                style={{ color: 'var(--color-text-muted)' }}
                                            >
                                                {userEmail}
                                            </p>
                                        )}
                                        <span
                                            className="inline-flex mt-1 px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
                                            style={{
                                                backgroundColor: 'var(--color-bg-blue-tint)',
                                                color: 'var(--brand, #008D98)',
                                            }}
                                        >
                                            {getRoleLabel()}
                                        </span>
                                    </div>
                                </div>

                                {/* Menu items */}
                                <div className="py-1.5">
                                    <button
                                        onClick={() => {
                                            setProfileOpen(false);
                                            router.push(profilePath);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                            e.currentTarget.style.color = 'var(--color-text-primary)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                                        }}
                                    >
                                        <User size={16} />
                                        Profile
                                    </button>

                                    {(isAdmin || (isTeacher && isEnterprisePlan)) && (
                                        <button
                                            onClick={() => {
                                                setProfileOpen(false);
                                                router.push('/dashboard/creator/settings');
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                                e.currentTarget.style.color = 'var(--color-text-primary)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                                            }}
                                        >
                                            <Settings size={16} />
                                            Settings
                                        </button>
                                    )}
                                </div>

                                {/* Sign out */}
                                <div className="border-t py-1.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                                        style={{ color: 'var(--color-text-danger)' }}
                                        onMouseEnter={(e) =>
                                            (e.currentTarget.style.backgroundColor = 'var(--color-bg-red-tint)')
                                        }
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                        <LogOut size={16} />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}
