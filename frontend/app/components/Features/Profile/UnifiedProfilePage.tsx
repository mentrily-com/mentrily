'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile, useUser } from '@clerk/nextjs';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import ReportProblemModal from '@/app/components/Common/ReportProblemModal';
import { AuthService } from '@/services/api/AuthService';

type DashboardRole = 'student' | 'teacher' | 'admin' | 'super-admin';

type SessionUser = {
    id?: string;
    name?: string;
    email?: string;
    role?: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
    rollNumber?: string;
    profilePicture?: string;
};

function mapRoleToDashboardRole(role?: SessionUser['role']): DashboardRole {
    if (role === 'SUPER_ADMIN') return 'super-admin';
    if (role === 'ADMIN') return 'admin';
    if (role === 'TEACHER') return 'teacher';
    return 'student';
}

function roleBadgeLabel(role?: SessionUser['role']): string {
    if (role === 'SUPER_ADMIN') return 'Super Admin';
    if (role === 'ADMIN') return 'Organization Admin';
    if (role === 'TEACHER') return 'Instructor';
    return 'Learner';
}

export default function UnifiedProfilePage() {
    const { user: clerkUser } = useUser();
    const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);
    const initialClerkNameRef = useRef<string | null>(null);
    const lastSyncedNameRef = useRef<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadSession = async () => {
            try {
                const data = await AuthService.checkSession();
                if (!mounted) return;
                setSessionUser(data || null);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        void loadSession();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (loading || !clerkUser) return;

        const clerkName = clerkUser.fullName?.trim();
        if (!clerkName) return;

        if (initialClerkNameRef.current === null) {
            initialClerkNameRef.current = clerkName;
            lastSyncedNameRef.current = sessionUser?.name?.trim() || null;
            return;
        }

        const currentSessionName = sessionUser?.name?.trim() || '';
        if (clerkName === currentSessionName || clerkName === lastSyncedNameRef.current) {
            return;
        }

        const syncName = window.setTimeout(async () => {
            try {
                const updatedUser = await AuthService.updateProfile({ name: clerkName });
                lastSyncedNameRef.current = clerkName;
                setSessionUser((previous) => ({
                    ...(previous || {}),
                    ...updatedUser,
                    name: updatedUser?.name || clerkName,
                }));
            } catch (error) {
                console.error('Failed to sync profile name', error);
            }
        }, 500);

        return () => window.clearTimeout(syncName);
    }, [clerkUser, clerkUser?.fullName, loading, sessionUser?.name]);

    const userRole = mapRoleToDashboardRole(sessionUser?.role);

    const displayName = useMemo(() => {
        return sessionUser?.name || clerkUser?.fullName || 'User';
    }, [sessionUser?.name, clerkUser?.fullName]);

    const displayEmail = useMemo(() => {
        return sessionUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || '';
    }, [sessionUser?.email, clerkUser?.primaryEmailAddress?.emailAddress]);

    const avatarUrl = clerkUser?.imageUrl || sessionUser?.profilePicture;
    const initial = displayName.charAt(0).toUpperCase();

    if (loading) {
        return <DashboardSkeleton type="form" userRole={userRole} />;
    }

    return (
        <div className="animate-fade-in font-sans">
            <div
                className="bg-white rounded-xl border p-6 md:p-8 mb-6 shadow-sm flex flex-col md:flex-row items-center gap-6 transition-all"
                style={{ borderColor: 'var(--color-border-subtle)' }}
            >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] flex items-center justify-center text-white text-3xl font-bold shadow-lg overflow-hidden shrink-0">
                    {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                        initial
                    )}
                </div>

                <div className="min-w-0 flex-1 text-center md:text-left">
                    <h1
                        className="text-2xl font-bold tracking-tight mb-1"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {displayName}
                    </h1>
                    <p className="text-sm font-medium mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                        {displayEmail}
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                        <span className="px-3 py-1 bg-[var(--color-bg-blue-tint)] text-[var(--brand)] text-[10px] font-semibold uppercase tracking-wider rounded border border-[var(--color-border-brand)]">
                            {roleBadgeLabel(sessionUser?.role)}
                        </span>
                        {sessionUser?.id && (
                            <span
                                className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded"
                                style={{
                                    backgroundColor: 'var(--color-bg-muted)',
                                    color: 'var(--color-text-secondary)',
                                }}
                            >
                                ID: {sessionUser.id.slice(0, 8)}
                            </span>
                        )}
                        {sessionUser?.rollNumber && (
                            <span
                                className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded"
                                style={{
                                    backgroundColor: 'var(--color-bg-muted)',
                                    color: 'var(--color-text-secondary)',
                                }}
                            >
                                Roll: {sessionUser.rollNumber}
                            </span>
                        )}
                        <button
                            onClick={() => setShowReportModal(true)}
                            className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded border cursor-pointer transition-colors"
                            style={{
                                backgroundColor: 'var(--color-bg-amber-tint)',
                                color: '#B45309',
                                borderColor: '#FDE68A',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF3C7')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-amber-tint)')}
                        >
                            Report a Problem
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="bg-white rounded-xl border p-4 md:p-6 shadow-sm mb-6"
                style={{ borderColor: 'var(--color-border-subtle)' }}
            >
                <div className="clerk-profile-clean">
                    <UserProfile
                        routing="hash"
                        appearance={{
                            variables: {
                                colorPrimary: 'var(--brand)',
                                colorBackground: '#ffffff',
                                colorText: '#0f172a',
                                colorInputBackground: '#f8fafc',
                                colorInputText: '#0f172a',
                                borderRadius: '0.75rem',
                                fontFamily: 'inherit',
                            },
                            elements: {
                                rootBox: { width: '100%' },
                                cardBox: { width: '100%', boxShadow: 'none' },
                                card: {
                                    width: '100%',
                                    boxShadow: 'none',
                                    border: '1px solid var(--color-border-subtle)',
                                    borderRadius: '0.75rem',
                                },
                                navbar: {
                                    backgroundColor: 'var(--color-bg-subtle)',
                                    borderBottom: '1px solid var(--color-border-subtle)',
                                },
                                navbarButton: { fontWeight: '600', borderRadius: '0.5rem' },
                                pageScrollBox: { padding: '1rem' },
                                formButtonPrimary: { fontWeight: '600', borderRadius: '0.5rem' },
                                formFieldInput: { borderRadius: '0.5rem', borderColor: 'var(--color-border-subtle)' },
                                formFieldLabel: { fontWeight: '600', color: 'var(--color-text-secondary)' },
                                profileSectionTitleText: { fontWeight: '700', color: 'var(--color-text-primary)' },
                                profileSectionPrimaryButton: { borderRadius: '0.5rem', fontWeight: '600' },
                                badge: {
                                    backgroundColor: 'var(--color-bg-blue-tint)',
                                    color: 'var(--brand)',
                                    border: '1px solid var(--color-border-brand)',
                                    fontWeight: '600',
                                },
                                footer: { display: 'none' },
                                footerItem: { display: 'none' },
                                footerAction: { display: 'none' },
                                footerActionText: { display: 'none' },
                                footerActionLink: { display: 'none' },
                                footerPages: { display: 'none' },
                                footerPagesLink: { display: 'none' },
                                internal: { display: 'none' },
                            },
                        }}
                    />
                </div>
            </div>

            <ReportProblemModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} />

            <style jsx global>{`
                .clerk-profile-clean .cl-footer,
                .clerk-profile-clean .cl-footerItem,
                .clerk-profile-clean .cl-footerAction,
                .clerk-profile-clean .cl-footerActionText,
                .clerk-profile-clean .cl-footerActionLink,
                .clerk-profile-clean .cl-footerPages,
                .clerk-profile-clean .cl-footerPagesLink,
                .clerk-profile-clean [class*='footer'],
                .clerk-profile-clean [class*='Footer'] {
                    display: none !important;
                }
            `}</style>
        </div>
    );
}
