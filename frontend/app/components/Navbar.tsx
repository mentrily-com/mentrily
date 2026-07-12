'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import ImpersonationBanner from './Common/ImpersonationBanner';
import PaymentFailedBanner from './Common/PaymentFailedBanner';
import { useOrganization } from '../context/OrganizationContext';
import {
    Lock,
    Megaphone,
    X,
    FileText,
    ImageIcon,
    File as FileIcon,
    Download,
    CreditCard,
    LifeBuoy,
} from 'lucide-react';
import { StudentService } from '@/services/api/StudentService';
import DOMPurify from 'isomorphic-dompurify';
import { useSession } from '@/hooks/useSession';
import CrispWidget from './CrispWidget';
import { BrandLockup } from '@/components/brand/BrandLockup';
import WorkspaceSwitcher from './Common/WorkspaceSwitcher';

export interface ExamConfig {
    rollNumber?: string;
    userName?: string;
    profilePicture?: string;
    onRefresh?: () => void;
    leftContent?: React.ReactNode;
    centerContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    hideBrandSuffix?: boolean;
    hideBrandName?: boolean;
}

interface NavbarProps {
    basePath?: string;
    userRole?: 'student' | 'teacher' | 'admin' | 'super-admin';
    examConfig?: ExamConfig;
}

type NavbarRole = 'student' | 'teacher' | 'admin' | 'super-admin';

function normalizeStoredRole(value: string | null): NavbarRole | null {
    if (value === 'student' || value === 'teacher' || value === 'admin' || value === 'super-admin') {
        return value;
    }
    return null;
}

function mapBackendRole(role: string | undefined): NavbarRole | null {
    if (!role) {
        return null;
    }

    const normalized = role.toUpperCase();
    if (normalized === 'STUDENT') return 'student';
    if (normalized === 'TEACHER') return 'teacher';
    if (normalized === 'ADMIN') return 'admin';
    if (normalized === 'SUPER_ADMIN') return 'super-admin';
    return null;
}

function getDashboardRouteForRole(role: NavbarRole) {
    if (role === 'student') return '/dashboard/learner';
    if (role === 'teacher' || role === 'admin') return '/dashboard/creator';
    return '/dashboard/super-admin';
}

export default function Navbar({ basePath, userRole: roleOverride, examConfig }: NavbarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user: clerkUser } = useUser();
    const { isSignedIn, isLoaded } = useAuth();
    const { data: sessionUser } = useSession();

    const { organization: orgContext } = useOrganization();

    const role = useMemo<NavbarRole>(() => {
        if (roleOverride) {
            return roleOverride;
        }

        if (pathname?.startsWith('/dashboard/super-admin')) {
            return 'super-admin';
        }
        if (pathname?.startsWith('/dashboard/admin')) {
            return 'admin';
        }
        if (pathname?.startsWith('/dashboard/studio')) {
            return 'teacher';
        }
        if (pathname?.startsWith('/dashboard/creator')) {
            return sessionUser?.role === 'ADMIN' ? 'admin' : 'teacher';
        }
        if (pathname?.startsWith('/dashboard/learner')) {
            return 'student';
        }

        const mappedBackendRole = mapBackendRole(sessionUser?.role);
        if (mappedBackendRole) {
            return mappedBackendRole;
        }

        if (typeof window !== 'undefined') {
            const cachedRole = normalizeStoredRole(window.localStorage.getItem('user-role'));
            if (cachedRole) {
                return cachedRole;
            }
        }

        return 'student';
    }, [roleOverride, pathname, sessionUser?.role]);

    useEffect(() => {
        const isDashboardRoute = pathname?.startsWith('/dashboard');
        if (!isDashboardRoute || !isLoaded || !isSignedIn || !sessionUser) {
            return;
        }

        if (sessionUser?.mustChangePassword && !pathname?.includes('/profile')) {
            if (sessionUser.role === 'TEACHER' || sessionUser.role === 'ADMIN') {
                router.replace('/dashboard/creator/profile');
            } else if (sessionUser.role === 'SUPER_ADMIN') {
                router.replace('/dashboard/super-admin/profile');
            } else {
                router.replace('/dashboard/learner/profile');
            }
        }
    }, [pathname, router, isLoaded, isSignedIn, sessionUser]);

    useEffect(() => {
        const currentStoredRole = normalizeStoredRole(localStorage.getItem('user-role'));
        if (currentStoredRole !== role) {
            localStorage.setItem('user-role', role);
        }
    }, [role]);

    const isTeacher = useMemo(() => role === 'teacher', [role]);
    const isAdmin = useMemo(() => role === 'admin', [role]);
    const isSuperAdmin = useMemo(() => role === 'super-admin', [role]);
    const dashboardRoute = useMemo(() => getDashboardRouteForRole(role), [role]);
    const isEnterprisePlan = useMemo(
        () => String(sessionUser?.plan || '').toUpperCase() === 'ENTERPRISE',
        [sessionUser?.plan],
    );
    const canManageTeacherBilling = useMemo(
        () => (isTeacher && sessionUser?.features?.teacherSelfBilling !== false) || isAdmin,
        [isAdmin, isTeacher, sessionUser?.features?.teacherSelfBilling],
    );

    const isDashboard = useMemo(
        () => pathname === dashboardRoute || pathname === '/dashboard/creator',
        [dashboardRoute, pathname],
    );
    const isAnalytics = useMemo(() => pathname?.includes('/analytics'), [pathname]);
    const isExams = useMemo(() => pathname?.includes('/exams'), [pathname]);
    const isStudents = useMemo(() => pathname?.includes('/students'), [pathname]);
    const isUsers = useMemo(() => pathname?.includes('/users'), [pathname]);
    const isSettings = useMemo(() => pathname?.includes('/settings'), [pathname]);
    const isBilling = useMemo(() => pathname?.includes('/billing'), [pathname]);
    const isOrgs = useMemo(() => pathname?.includes('/organizations'), [pathname]);
    const isContentSection = useMemo(
        () =>
            pathname === '/dashboard/creator' ||
            pathname?.includes('/dashboard/creator/courses') ||
            pathname?.includes('/dashboard/creator/exams') ||
            pathname?.includes('/dashboard/creator/certificates'),
        [pathname],
    );

    const mustChangePassword = useMemo(
        () => sessionUser?.mustChangePassword === true,
        [sessionUser?.mustChangePassword],
    );
    const planStatus = useMemo(() => String(sessionUser?.planStatus || '').toUpperCase(), [sessionUser?.planStatus]);
    const showPaymentFailedBanner = useMemo(
        () => pathname?.startsWith('/dashboard') && planStatus === 'PAST_DUE',
        [pathname, planStatus],
    );

    return (
        <div className="w-full flex flex-col sticky top-0 z-[1000]">
            {(isTeacher || isAdmin) && <CrispWidget role={isAdmin ? 'ADMIN' : 'TEACHER'} />}
            <ImpersonationBanner />
            {showPaymentFailedBanner && <PaymentFailedBanner />}
            <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="w-full px-4 py-2.5 lg:px-6 sm:py-3 flex items-center justify-between">
                    {/* Left - Brand & Primary Nav */}
                    <div className="flex items-center gap-8 z-10">
                        <div
                            onClick={() => !examConfig && router.push(dashboardRoute)}
                            className={`flex items-center gap-2.5 ${examConfig ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                            {!examConfig?.hideBrandName && (
                                <BrandLockup
                                    orgName={orgContext?.name}
                                    orgLogo={orgContext?.logo}
                                    defaultLogoClassName="h-8 max-w-[160px]"
                                    iconClassName="h-9 w-9"
                                    textClassName="hidden text-xl font-black tracking-tighter sm:inline-block"
                                    priority
                                />
                            )}
                            {examConfig?.leftContent}
                        </div>

                        {!examConfig && !mustChangePassword && (
                            <nav className="hidden md:flex items-center gap-1 ml-4 bg-slate-50 p-1 rounded-xl">
                                <NavItem
                                    active={isDashboard}
                                    onClick={() => router.push(basePath || dashboardRoute)}
                                    icon={
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <rect x="3" y="3" width="7" height="7" />
                                            <rect x="14" y="3" width="7" height="7" />
                                            <rect x="14" y="14" width="7" height="7" />
                                            <rect x="3" y="14" width="7" height="7" />
                                        </svg>
                                    }
                                    label="Dashboard"
                                />
                                {isTeacher && (
                                    <>
                                        <ContentDropdown
                                            active={isContentSection}
                                            label="Content"
                                            items={[
                                                {
                                                    label: 'My Courses',
                                                    path: '/dashboard/creator',
                                                    active:
                                                        pathname === '/dashboard/creator' ||
                                                        pathname?.includes('/dashboard/creator/courses'),
                                                },
                                                {
                                                    label: 'My Exams',
                                                    path: '/dashboard/creator/exams',
                                                    active: pathname?.includes('/dashboard/creator/exams'),
                                                },
                                                {
                                                    label: 'Certificates',
                                                    path: '/dashboard/creator/certificates',
                                                    active: pathname?.includes('/dashboard/creator/certificates'),
                                                },
                                            ]}
                                        />
                                        <NavItem
                                            active={isUsers || isStudents}
                                            onClick={() => router.push('/dashboard/creator/users')}
                                            icon={
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                </svg>
                                            }
                                            label="Users"
                                        />
                                        <NavItem
                                            active={isAnalytics}
                                            onClick={() => router.push('/dashboard/creator/analytics')}
                                            icon={
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                                                    <path d="M22 12A10 10 0 0 0 12 2v10z" />
                                                </svg>
                                            }
                                            label="Analytics"
                                            badge="Pro"
                                        />
                                        {canManageTeacherBilling && (
                                            <NavItem
                                                active={isBilling}
                                                onClick={() => router.push('/dashboard/creator/billing')}
                                                icon={
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <rect x="2" y="5" width="20" height="14" rx="2" />
                                                        <line x1="2" y1="10" x2="22" y2="10" />
                                                    </svg>
                                                }
                                                label="Billing"
                                            />
                                        )}
                                        {isEnterprisePlan && (
                                            <NavItem
                                                active={isSettings}
                                                onClick={() => router.push('/dashboard/creator/settings')}
                                                icon={
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <circle cx="12" cy="12" r="3" />
                                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                                    </svg>
                                                }
                                                label="Settings"
                                                badge="Enterprise"
                                            />
                                        )}
                                    </>
                                )}

                                {isAdmin && (
                                    <>
                                        <NavItem
                                            active={isUsers}
                                            disabled={sessionUser?.features?.canManageUsers === false}
                                            onClick={() => router.push('/dashboard/creator/users')}
                                            icon={
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                </svg>
                                            }
                                            label="Users"
                                        />
                                        <ContentDropdown
                                            active={isContentSection}
                                            label="Content"
                                            items={[
                                                {
                                                    label: 'Courses',
                                                    path: '/dashboard/creator',
                                                    active:
                                                        pathname === '/dashboard/creator' ||
                                                        pathname?.includes('/dashboard/creator/courses'),
                                                },
                                                {
                                                    label: 'Exams',
                                                    path: '/dashboard/creator/exams',
                                                    active: pathname?.includes('/dashboard/creator/exams'),
                                                },
                                                {
                                                    label: 'Certificates',
                                                    path: '/dashboard/creator/certificates',
                                                    active: pathname?.includes('/dashboard/creator/certificates'),
                                                },
                                            ]}
                                        />
                                        <NavItem
                                            active={isAnalytics}
                                            onClick={() => router.push('/dashboard/creator/analytics')}
                                            icon={
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                                                    <path d="M22 12A10 10 0 0 0 12 2v10z" />
                                                </svg>
                                            }
                                            label="Analytics"
                                            badge="Pro"
                                        />
                                        {isEnterprisePlan && (
                                            <NavItem
                                                active={isSettings}
                                                onClick={() => router.push('/dashboard/creator/settings')}
                                                icon={
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <circle cx="12" cy="12" r="3" />
                                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                                    </svg>
                                                }
                                                label="Settings"
                                                badge="Enterprise"
                                            />
                                        )}
                                        <NavItem
                                            active={isBilling}
                                            onClick={() => router.push('/dashboard/creator/billing')}
                                            icon={
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <rect x="2" y="5" width="20" height="14" rx="2" />
                                                    <line x1="2" y1="10" x2="22" y2="10" />
                                                </svg>
                                            }
                                            label="Billing"
                                        />
                                    </>
                                )}

                                {isSuperAdmin && (
                                    <>
                                        <NavItem
                                            active={isOrgs}
                                            onClick={() => router.push('/dashboard/super-admin/organizations')}
                                            icon={
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                                    <polyline points="9 22 9 12 15 12 15 22" />
                                                </svg>
                                            }
                                            label="Organizations"
                                        />
                                        <NavItem
                                            active={isUsers}
                                            onClick={() => router.push('/dashboard/super-admin/users')}
                                            icon={
                                                <svg
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                </svg>
                                            }
                                            label="Global Users"
                                        />
                                    </>
                                )}

                                {role === 'student' && (
                                    <NavItem
                                        active={isAnalytics}
                                        onClick={() => router.push('/dashboard/learner/analytics')}
                                        icon={
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                                                <path d="M22 12A10 10 0 0 0 12 2v10z" />
                                            </svg>
                                        }
                                        label="Analytics"
                                    />
                                )}
                            </nav>
                        )}

                        {mustChangePassword && (
                            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl animate-pulse">
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#e11d48"
                                    strokeWidth="2.5"
                                >
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <span className="text-xs font-black text-rose-600 uppercase tracking-widest">
                                    Password Change Required
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Center Content - Absolute Center for Exam Mode */}
                    {examConfig ? (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                            {examConfig.centerContent}
                        </div>
                    ) : (
                        <div className="flex items-center gap-8">
                            {/* Center Content Placeholder for dashboard if needed */}
                        </div>
                    )}

                    {/* Right - User Actions */}
                    <div className="flex items-center gap-5">
                        {!examConfig && !mustChangePassword && role === 'student' && (
                            <AnnouncementBell enabled={Boolean(isLoaded && isSignedIn && sessionUser?.id)} />
                        )}

                        {!examConfig && !mustChangePassword && (
                            <div className="relative group/playground">
                                <button
                                    data-element-id="playground-btn"
                                    className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-light)] text-[var(--brand)] font-bold text-sm transition-all hover:bg-[var(--brand)] hover:text-white active:scale-95 cursor-default"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="16 18 22 12 16 6" />
                                        <polyline points="8 6 2 12 8 18" />
                                    </svg>
                                    Playground
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        className="ml-1 group-hover/playground:rotate-180 transition-transform"
                                    >
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </button>

                                {/* Playground Dropdown */}
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200/60 py-2 z-50 opacity-0 invisible group-hover/playground:opacity-100 group-hover/playground:visible transition-all duration-200 translate-y-2 group-hover/playground:translate-y-0">
                                    <button
                                        onClick={() => router.push('/playground')}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-[var(--brand)] transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center">
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                            >
                                                <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />
                                            </svg>
                                        </div>
                                        Coding
                                    </button>
                                    <button
                                        onClick={() => router.push('/playground/web')}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-[var(--brand)] transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                            >
                                                <path d="M12 2l8.85 3.13L19 18l-7 4-7-4-1.85-12.87z" />
                                                <path d="M12 6.5l4 1.5-1 7-3 1.5-3-1.5-1-7z" />
                                            </svg>
                                        </div>
                                        HTML5
                                    </button>
                                    <button
                                        onClick={() => router.push('/playground/pynb')}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-[var(--brand)] transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                            >
                                                <path d="M4 17l6-6-6-6M12 19h8" />
                                            </svg>
                                        </div>
                                        Notebook
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="h-8 w-[1px] bg-slate-100 mx-1"></div>

                        <div className="flex items-center gap-2">
                            {basePath?.includes('/dashboard/super-admin') && (
                                <button
                                    onClick={() => router.push('/dashboard/super-admin/organizations')}
                                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-colors mr-2 shadow-sm border border-amber-200"
                                >
                                    Exit View
                                </button>
                            )}
                            {examConfig?.rightContent}
                            {!isTeacher && !isAdmin && !isSuperAdmin && !examConfig && !mustChangePassword && (
                                <AppsMenu isTeacher={isTeacher} />
                            )}
                            {!examConfig && <WorkspaceSwitcher sessionUser={sessionUser} />}
                            <ProfileMenu
                                isTeacher={isTeacher}
                                isAdmin={isAdmin}
                                isSuperAdmin={isSuperAdmin}
                                examConfig={examConfig}
                                sessionUser={sessionUser}
                                clerkUser={clerkUser}
                            />
                        </div>
                    </div>
                </div>
            </header>
        </div>
    );
}

const NavItem = React.memo(function NavItem({
    active,
    onClick,
    icon,
    label,
    disabled,
    badge,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    badge?: string;
}) {
    return (
        <button
            onClick={!disabled ? onClick : undefined}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 
        ${active ? 'bg-white text-[var(--brand)] shadow-sm' : 'text-slate-400 hover:text-slate-600'}
        ${disabled ? 'opacity-40 cursor-not-allowed grayscale-[0.5]' : 'cursor-pointer'}
      `}
        >
            {React.isValidElement(icon) &&
                React.cloneElement(icon as React.ReactElement<any>, {
                    className: active ? 'stroke-[var(--brand)]' : 'stroke-slate-400',
                })}
            <span className={active ? 'text-slate-900' : ''}>{label}</span>
            {badge && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                    {badge}
                </span>
            )}
            {disabled && <Lock size={12} className="ml-1 text-slate-400" />}
        </button>
    );
});

const ContentDropdown = React.memo(function ContentDropdown({
    active,
    label,
    items,
}: {
    active: boolean;
    label: string;
    items: Array<{ label: string; path: string; active?: boolean }>;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function closeOnOutsideClick(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                data-element-id="nav-content-dropdown"
                onClick={() => setOpen((prev) => !prev)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                    active ? 'bg-white text-[var(--brand)] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={active ? 'stroke-[var(--brand)]' : 'stroke-slate-400'}
                >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M12 11h4" />
                    <path d="M12 15h4" />
                    <path d="M12 7h4" />
                    <path d="M8 12h.01" />
                    <path d="M8 16h.01" />
                    <path d="M8 8h.01" />
                </svg>
                <span className={active ? 'text-slate-900' : ''}>{label}</span>
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={`transition-transform ${open ? 'rotate-180' : ''}`}
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 top-full mt-2 min-w-[180px] bg-white rounded-xl shadow-xl ring-1 ring-slate-200 z-50 py-1">
                    {items.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            onClick={() => setOpen(false)}
                            className={`block w-full text-left px-4 py-2 text-sm font-semibold transition-colors ${
                                item.active
                                    ? 'text-[var(--brand)] bg-[var(--brand-light)]'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
});

const AppsMenu = React.memo(function AppsMenu({ isTeacher }: { isTeacher: boolean }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function close(e: any) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const apps = isTeacher
        ? [
              {
                  label: 'My Exams',
                  icon: (
                      <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                      >
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                          <path d="M12 11h4" />
                          <path d="M12 15h4" />
                          <path d="M12 7h4" />
                          <path d="M8 12h.01" />
                          <path d="M8 16h.01" />
                          <path d="M8 8h.01" />
                      </svg>
                  ),
                  path: '/dashboard/creator/exams',
              },
              {
                  label: 'Users',
                  icon: (
                      <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                      >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                  ),
                  path: '/dashboard/creator/users',
              },
          ]
        : [
              {
                  label: 'Assessments',
                  icon: (
                      <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                      >
                          <path d="M12 11h4" />
                          <path d="M12 15h4" />
                          <path d="M12 7h4" />
                          <path d="M8 12h.01" />
                          <path d="M8 16h.01" />
                          <path d="M8 8h.01" />
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                  ),
                  path: '/dashboard/learner/test',
              },
              {
                  label: 'Bookmarks',
                  icon: (
                      <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                      >
                          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                      </svg>
                  ),
                  path: '/dashboard/learner/bookmarks',
              },
              {
                  label: 'Certificates',
                  icon: (
                      <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                      >
                          <circle cx="12" cy="8" r="6" />
                          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                      </svg>
                  ),
                  path: '/dashboard/learner/certificates',
              },
          ];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="w-10 h-10 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-3 w-72 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 p-4 z-50 animate-fade-in">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">
                        Quick Access
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                        {apps.map((app) => (
                            <Link
                                key={app.label}
                                href={app.path}
                                onClick={() => setOpen(false)}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="w-10 h-10 rounded-xl bg-[var(--brand-lighter)] text-[var(--brand)] flex items-center justify-center">
                                    {app.icon}
                                </div>
                                <span className="text-[10px] font-bold text-slate-600 text-center">{app.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

function ProfileMenu({
    isTeacher,
    isAdmin,
    isSuperAdmin,
    examConfig,
    sessionUser,
    clerkUser,
}: {
    isTeacher: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    examConfig?: ExamConfig;
    sessionUser?: any;
    clerkUser?: any;
}) {
    const router = useRouter();
    const clerk = useClerk();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function close(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const getLabel = () => {
        if (isSuperAdmin) return 'Super Admin';
        if (isAdmin) return 'Organization Admin';
        if (isTeacher) return 'Instructor';
        return 'Learner';
    };

    const dashboardPath = isSuperAdmin
        ? '/dashboard/super-admin'
        : isAdmin
          ? '/dashboard/creator'
          : isTeacher
            ? '/dashboard/creator'
            : '/dashboard/learner';
    const canManageTeacherBilling = (isTeacher && sessionUser?.features?.teacherSelfBilling !== false) || isAdmin;
    const normalizedPlan = String(sessionUser?.plan || '').toUpperCase();
    const canAccessSupport = (isTeacher || isAdmin) && ['STARTER', 'PRO'].includes(normalizedPlan);
    const displayName = examConfig?.userName || sessionUser?.name || clerkUser?.fullName || 'User';
    const displayEmail = sessionUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || '';
    const initial = displayName.charAt(0).toUpperCase();
    const avatarUrl = examConfig?.profilePicture || clerkUser?.imageUrl || sessionUser?.profilePicture;

    const handleSignOut = async () => {
        setOpen(false);
        try {
            await clerk.signOut({ redirectUrl: '/login' });
        } catch {
            router.replace('/login');
        }
    };

    const handleSupportClick = () => {
        setOpen(false);

        const crisp = (window as Window & { $crisp?: unknown[] }).$crisp;
        if (Array.isArray(crisp)) {
            crisp.push(['do', 'chat:open']);
            return;
        }

        router.push('/contact?from=dashboard');
    };

    return (
        <div ref={dropdownRef} className="relative flex items-center gap-3 ml-2">
            <div className="hidden sm:block text-right">
                <p className="text-sm font-black text-slate-800 leading-none">{displayName}</p>
                <p className="text-[9px] font-black text-[var(--brand)] uppercase tracking-widest mt-1">
                    {examConfig?.rollNumber ? `Roll: ${examConfig.rollNumber}` : getLabel()}
                </p>
            </div>

            {examConfig ? (
                <>
                    <button
                        onClick={() => setOpen((value) => !value)}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] flex items-center justify-center text-white font-black text-sm overflow-hidden relative"
                    >
                        {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                            initial
                        )}
                    </button>

                    {open && (
                        <div className="absolute right-0 top-full mt-3 w-64 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 z-50 overflow-hidden animate-fade-in">
                            <div className="px-4 py-4 border-b border-slate-100 flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] text-white font-black flex items-center justify-center overflow-hidden shrink-0">
                                    {avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        initial
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-800 truncate">{displayName}</p>
                                    {examConfig.rollNumber && (
                                        <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">
                                            Roll: {examConfig.rollNumber}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="p-2">
                                <button
                                    onClick={() => {
                                        setOpen(false);
                                        examConfig.onRefresh?.();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                        >
                                            <path d="M21 2v6h-6" />
                                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                            <path d="M3 22v-6h6" />
                                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                                        </svg>
                                    </div>
                                    Refresh Exam
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <button
                        onClick={() => setOpen((value) => !value)}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] flex items-center justify-center text-white font-black text-sm overflow-hidden relative"
                    >
                        {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                            initial
                        )}
                    </button>

                    {open && (
                        <div className="absolute right-0 top-full mt-3 w-72 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 z-50 overflow-hidden animate-fade-in">
                            <div className="px-4 py-4 border-b border-slate-100 flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] text-white font-black flex items-center justify-center overflow-hidden shrink-0">
                                    {avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        initial
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-800 truncate">{displayName}</p>
                                    {displayEmail && (
                                        <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">
                                            {displayEmail}
                                        </p>
                                    )}
                                    <span className="inline-flex mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-[var(--brand-lighter)] text-[var(--brand)] border border-[var(--brand-light)]">
                                        {getLabel()}
                                    </span>
                                </div>
                            </div>

                            <div className="p-2">
                                <button
                                    onClick={() => {
                                        setOpen(false);
                                        router.push(`${dashboardPath}/profile`);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <circle cx="12" cy="8" r="4" />
                                            <path d="M4 20a8 8 0 0 1 16 0" />
                                        </svg>
                                    </div>
                                    My Profile
                                </button>

                                {canManageTeacherBilling && (
                                    <button
                                        onClick={() => {
                                            setOpen(false);
                                            router.push('/dashboard/creator/billing');
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                            <CreditCard size={16} />
                                        </div>
                                        Billing
                                    </button>
                                )}

                                {canAccessSupport && (
                                    <button
                                        onClick={handleSupportClick}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                            <LifeBuoy size={16} />
                                        </div>
                                        Contact Support
                                    </button>
                                )}

                                <div className="h-px bg-slate-100 my-1.5" />

                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-black text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                    </div>
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function MenuBtn({
    icon,
    label,
    onClick,
    danger,
}: {
    icon: any;
    label: string;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all ${
                danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

// ─── ANNOUNCEMENT BELL (Student Navbar) ────────────────────────────────

function AnnouncementBell({ enabled }: { enabled: boolean }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedAnn, setSelectedAnn] = useState<any>(null);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function close(e: any) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const load = async () => {
        if (!enabled) {
            setAnnouncements([]);
            setUnreadCount(0);
            return;
        }

        try {
            const [ann, count] = await Promise.all([
                StudentService.getAnnouncements(true),
                StudentService.getUnreadAnnouncementCount(),
            ]);
            setAnnouncements(ann);
            setUnreadCount(count.count || 0);
        } catch {
            /* silent */
        }
    };

    useEffect(() => {
        if (!enabled) {
            return;
        }

        load();
        const interval = setInterval(load, 30000); // poll every 30s
        return () => clearInterval(interval);
    }, [enabled]);

    const handleClick = async (ann: any) => {
        setSelectedAnn(ann);
        setOpen(false);
        if (!ann.isRead) {
            try {
                await StudentService.markAnnouncementRead(ann.id);
                setUnreadCount((prev) => Math.max(prev - 1, 0));
                setAnnouncements((prev) => prev.map((a) => (a.id === ann.id ? { ...a, isRead: true } : a)));
            } catch {
                /* silent */
            }
        }
    };

    const handleDownload = (url: string, name: string) => {
        const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name || 'download')}`;
        window.open(proxyUrl, '_self');
    };

    return (
        <>
            <div ref={ref} className="relative">
                <button
                    onClick={() => setOpen(!open)}
                    className="hidden sm:flex w-10 h-10 rounded-xl border border-slate-100 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-[var(--brand)] transition-all relative"
                    title="Announcements"
                >
                    <Megaphone size={18} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 px-1">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {open && (
                    <div className="absolute right-0 top-full mt-3 w-80 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 z-50 animate-fade-in overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                                <Megaphone size={14} className="text-[var(--brand)]" /> Announcements
                            </h3>
                            {unreadCount > 0 && (
                                <span className="text-[9px] font-black text-[var(--brand)] bg-[var(--brand-light)] px-2 py-0.5 rounded-lg uppercase">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
                            {announcements.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Megaphone size={24} className="text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-400">No announcements yet</p>
                                </div>
                            ) : (
                                announcements.slice(0, 8).map((ann) => (
                                    <button
                                        key={ann.id}
                                        onClick={() => handleClick(ann)}
                                        className={`w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0 flex items-start gap-3 ${
                                            !ann.isRead ? 'bg-[var(--brand-light)]/20' : ''
                                        }`}
                                    >
                                        <div
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                ann.isRead
                                                    ? 'bg-slate-100 text-slate-400'
                                                    : 'bg-[var(--brand)] text-white'
                                            }`}
                                        >
                                            <Megaphone size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p
                                                className={`text-[13px] font-bold truncate ${ann.isRead ? 'text-slate-600' : 'text-slate-800'}`}
                                            >
                                                {ann.title}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                {new Date(ann.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                                {ann.teacher?.name && ` · ${ann.teacher.name}`}
                                            </p>
                                        </div>
                                        {!ann.isRead && (
                                            <div className="w-2 h-2 rounded-full bg-[var(--brand)] flex-shrink-0 mt-2" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Full Announcement Popup - Portal to escape backdrop-blur containing block */}
            {selectedAnn &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                            onClick={() => setSelectedAnn(null)}
                        />
                        <div className="bg-white w-full max-w-2xl rounded-[48px] p-12 shadow-2xl relative z-10 animate-in slide-in-from-bottom-8 duration-500 max-h-[85vh] overflow-y-auto custom-scrollbar">
                            <button
                                onClick={() => setSelectedAnn(null)}
                                className="absolute top-10 right-10 w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:scale-110 active:scale-95"
                            >
                                <X size={20} strokeWidth={3} />
                            </button>

                            <div className="flex items-start gap-5 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[var(--brand)]/20">
                                    <Megaphone size={24} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
                                        {selectedAnn.title}
                                    </h2>
                                    <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <span>
                                            {new Date(selectedAnn.createdAt).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </span>
                                        {selectedAnn.teacher?.name && (
                                            <>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                <span>{selectedAnn.teacher.name}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {selectedAnn.groups && selectedAnn.groups.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-6">
                                    {selectedAnn.groups.map((g: any) => (
                                        <span
                                            key={g.id}
                                            className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[var(--brand-light)] text-[var(--brand-dark)] border border-[var(--brand-light)]"
                                        >
                                            {g.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div
                                className="prose prose-sm max-w-none text-slate-700 mb-8 [&_p]:mb-3 [&_h1]:text-xl [&_h1]:font-black [&_h2]:text-lg [&_h2]:font-black [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_a]:text-[var(--brand)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--brand-light)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_img]:rounded-2xl [&_img]:max-w-full"
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(String(selectedAnn.content || '')),
                                }}
                            />

                            {Array.isArray(selectedAnn.attachments) && selectedAnn.attachments.length > 0 && (
                                <div className="bg-slate-50 rounded-[24px] border border-slate-100 p-6">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                        Attachments
                                    </p>
                                    <div className="space-y-2">
                                        {selectedAnn.attachments.map((att: any, idx: number) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleDownload(att.url, att.name)}
                                                className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 hover:border-[var(--brand-light)] hover:shadow-sm transition-all cursor-pointer"
                                            >
                                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                                    {att.type?.startsWith('image/') ? (
                                                        <ImageIcon size={16} className="text-blue-500" />
                                                    ) : att.type?.includes('pdf') ? (
                                                        <FileText size={16} className="text-rose-500" />
                                                    ) : (
                                                        <FileIcon size={16} className="text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="text-xs font-black text-slate-700 truncate">
                                                        {att.name}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400">
                                                        {att.size ? `${(att.size / 1024).toFixed(0)} KB` : 'File'}
                                                    </p>
                                                </div>
                                                <span className="flex items-center gap-1 text-[10px] font-black text-[var(--brand)] uppercase tracking-widest">
                                                    <Download size={12} /> Download
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}
