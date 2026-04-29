'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSession } from '@/hooks/useSession';

function readPendingDashboardRole(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    const raw = window.localStorage.getItem('pending-dashboard-role');
    if (!raw) {
        return '';
    }

    try {
        const parsed = JSON.parse(raw) as { role?: string; expiresAt?: number };
        const role = String(parsed?.role || '').trim().toUpperCase();
        const expiresAt = Number(parsed?.expiresAt || 0);

        if (!role || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            window.localStorage.removeItem('pending-dashboard-role');
            return '';
        }

        return role;
    } catch {
        window.localStorage.removeItem('pending-dashboard-role');
        return '';
    }
}

export function useRoleGuard(allowedRoles: string[]) {
    const router = useRouter();
    const { isLoaded, isSignedIn } = useAuth();
    const { data: user, isLoading: isSessionLoading, error: sessionError } = useSession();
    const role = user?.role;
    const pendingRole = readPendingDashboardRole();
    const isPendingAuthorized =
        Boolean(pendingRole) && (allowedRoles.length === 0 || allowedRoles.includes(String(pendingRole)));

    const isSessionResolved = isLoaded && isSignedIn && !isSessionLoading && !sessionError && Boolean(user) && Boolean(role);
    const isAuthorized =
        isPendingAuthorized ||
        (isSessionResolved && (allowedRoles.length === 0 || allowedRoles.includes(String(role))));
    const isReady = !isLoaded ? false : !isSignedIn ? true : isSessionResolved || isPendingAuthorized;

    useEffect(() => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push('/login');
            return;
        }

        if (isPendingAuthorized) {
            return;
        }

        if (!isSessionResolved) {
            return;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(String(role))) {
            if (role === 'STUDENT') router.replace('/dashboard/learner');
            else if (role === 'TEACHER' || role === 'ADMIN') router.replace('/dashboard/creator');
            else if (role === 'SUPER_ADMIN') router.replace('/dashboard/super-admin');
            return;
        }

    }, [allowedRoles, router, isLoaded, isSignedIn, isSessionResolved, role, isPendingAuthorized]);

    return { isAuthorized, isReady, isPendingAuthorized };
}
