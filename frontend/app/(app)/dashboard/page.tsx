'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRequireAuth } from '@/hooks/requireAuthClient';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthService } from '@/services/api/AuthService';
import RoleSelectionModal from '@/app/components/RoleSelectionModal';
import { useAuth } from '@clerk/nextjs';
import BrandedPageLoader from '@/app/components/Common/BrandedPageLoader';

export default function DashboardPage() {
    const [authChecked, setAuthChecked] = useState(false);
    const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
    const [isRedirectingToRoleDashboard, setIsRedirectingToRoleDashboard] = useState(false);
    const [redirectingRole, setRedirectingRole] = useState<'student' | 'teacher' | 'admin' | 'super-admin'>('teacher');
    const isSignedIn = useRequireAuth('/login');
    const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const authFlow = String(searchParams.get('flow') || '')
        .trim()
        .toLowerCase();
    const shouldProvisionSignup = authFlow === 'signup' || authFlow === 'registration';

    const persistRoleHint = useCallback((role?: string | null) => {
        if (typeof window === 'undefined' || !role) return;

        const normalizedRole = String(role).trim().toUpperCase();
        if (normalizedRole === 'SUPER_ADMIN') {
            window.localStorage.setItem('user-role', 'super-admin');
            return;
        }
        if (normalizedRole === 'ADMIN') {
            window.localStorage.setItem('user-role', 'admin');
            return;
        }
        if (normalizedRole === 'TEACHER') {
            window.localStorage.setItem('user-role', 'teacher');
            return;
        }
        if (normalizedRole === 'STUDENT') {
            window.localStorage.setItem('user-role', 'student');
        }
    }, []);

    const persistPendingRoleTransition = useCallback(
        (role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN', destination: string) => {
            if (typeof window === 'undefined') return;
            window.localStorage.setItem(
                'pending-dashboard-role',
                JSON.stringify({
                    role,
                    destination,
                    expiresAt: Date.now() + 20_000,
                }),
            );
        },
        [],
    );

    const redirectMissingAccount = useCallback(async () => {
        router.replace('/login?error=account_not_found');
    }, [router]);

    const getDestinationByRole = (
        role?: string,
    ): '/dashboard/creator' | '/dashboard/super-admin' | '/dashboard/learner' | null => {
        if (role === 'TEACHER' || role === 'ADMIN') return '/dashboard/creator';
        if (role === 'SUPER_ADMIN') return '/dashboard/super-admin';
        if (role === 'STUDENT') return '/dashboard/learner';
        return null;
    };

    useEffect(() => {
        if (!isSignedIn || !clerkLoaded || !clerkSignedIn) return;
        let cancelled = false;

        const loadSession = async () => {
            AuthService.resetSessionCache();
            setIsRedirectingToRoleDashboard(false);

            // Fresh signups race Clerk token issuance + first-request user
            // provisioning; a 3×120ms window regularly lost that race and
            // stranded the user on the loader with no role modal. Retry a
            // handful of times with growing waits before concluding anything.
            for (let attempt = 0; attempt < 6; attempt += 1) {
                const user = shouldProvisionSignup
                    ? await AuthService.checkSessionForSignup()
                    : await AuthService.checkSession(true);
                if (!user) {
                    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
                    continue;
                }

                if (cancelled) {
                    return;
                }

                if (user.needsRoleSelection) {
                    setAuthChecked(true);
                    setNeedsRoleSelection(true);
                    return;
                }

                const destination = getDestinationByRole(user?.role);
                if (destination) {
                    setAuthChecked(true);
                    setIsRedirectingToRoleDashboard(true);
                    router.replace(destination);
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, 120));
            }

            if (!cancelled) {
                if (shouldProvisionSignup) {
                    setAuthChecked(false);
                    return;
                }

                await redirectMissingAccount();
            }
        };

        loadSession();

        return () => {
            cancelled = true;
        };
    }, [isSignedIn, clerkLoaded, clerkSignedIn, redirectMissingAccount, router, shouldProvisionSignup]);

    const redirectByRole = (user: { role?: string } | null, preferredDestination?: string): boolean => {
        const destination = getDestinationByRole(user?.role);
        if (!destination) return false;
        persistRoleHint(user?.role);
        const normalizedRole = String(user?.role || '')
            .trim()
            .toUpperCase();
        setRedirectingRole(
            normalizedRole === 'STUDENT'
                ? 'student'
                : normalizedRole === 'SUPER_ADMIN'
                  ? 'super-admin'
                  : normalizedRole === 'ADMIN'
                    ? 'admin'
                    : 'teacher',
        );
        setIsRedirectingToRoleDashboard(true);
        router.replace(preferredDestination || destination);
        return true;
    };

    const resolveAndRedirect = async (preferredDestination?: '/dashboard/creator' | '/dashboard/learner') => {
        AuthService.resetSessionCache();

        let user: { needsRoleSelection?: boolean; role?: string } | null = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
            user = shouldProvisionSignup
                ? await AuthService.checkSessionForSignup()
                : await AuthService.checkSession(true);

            if (user && !user.needsRoleSelection && redirectByRole(user, preferredDestination)) {
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 150));
        }

        setNeedsRoleSelection(false);
        if (preferredDestination) {
            router.replace(preferredDestination);
            return;
        }
        router.replace('/dashboard');
    };

    const handleSelectRole = async (role: 'STUDENT') => {
        try {
            persistRoleHint(role);
            persistPendingRoleTransition(role, '/dashboard/learner');
            setRedirectingRole('student');
            setIsRedirectingToRoleDashboard(true);
            const updatedUser = await AuthService.selectRole(role);
            const redirected = redirectByRole((updatedUser as { role?: string }) || { role }, '/dashboard/learner');
            if (!redirected) {
                await resolveAndRedirect('/dashboard/learner');
            }
        } catch (error) {
            setIsRedirectingToRoleDashboard(false);
            const message = String((error as Error)?.message || '').toLowerCase();
            if (
                message.includes('already been selected') ||
                message.includes('unauthorized') ||
                message.includes('bad request')
            ) {
                setRedirectingRole('student');
                setIsRedirectingToRoleDashboard(true);
                await resolveAndRedirect('/dashboard/learner');
                return;
            }
            throw error;
        }
    };

    const handleSelectCreator = async () => {
        try {
            const initiatePlan = String(searchParams.get('plan') || '')
                .trim()
                .toLowerCase();
            const preferredDestination =
                initiatePlan === 'starter' || initiatePlan === 'pro'
                    ? `/dashboard/creator/billing?initiate=${initiatePlan}`
                    : '/dashboard/creator';
            persistRoleHint('TEACHER');
            persistPendingRoleTransition('TEACHER', preferredDestination);
            setRedirectingRole('teacher');
            setIsRedirectingToRoleDashboard(true);

            await AuthService.selectRoleCreator();
            router.replace(preferredDestination);
        } catch (error) {
            setIsRedirectingToRoleDashboard(false);
            const message = String((error as Error)?.message || '').toLowerCase();
            if (
                message.includes('already been selected') ||
                message.includes('unauthorized') ||
                message.includes('bad request')
            ) {
                persistRoleHint('TEACHER');
                setRedirectingRole('teacher');
                setIsRedirectingToRoleDashboard(true);
                await resolveAndRedirect('/dashboard/creator');
                return;
            }
            throw error;
        }
    };

    if (!authChecked) {
        return <BrandedPageLoader />;
    }

    if (needsRoleSelection) {
        return <RoleSelectionModal onSelectRole={handleSelectRole} onSelectCreator={handleSelectCreator} />;
    }

    if (isRedirectingToRoleDashboard) {
        return <DashboardSkeleton type="main" userRole={redirectingRole} />;
    }

    return null;
}
