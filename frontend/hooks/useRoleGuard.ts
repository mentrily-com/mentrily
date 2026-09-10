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
        const role = String(parsed?.role || '')
            .trim()
            .toUpperCase();
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
    // isPlaceholderData = true while the real server session is still in flight.
    // The localStorage snapshot (bc-session-snapshot) can carry the PREVIOUS
    // persona's role (e.g. STUDENT after a switch to TEACHER), so we must
    // never redirect or gate content on placeholder data — only on the real
    // verified session from the server.
    const { data: user, isLoading: isSessionLoading, isPlaceholderData, error: sessionError } = useSession();
    const role = user?.role;
    const pendingRole = readPendingDashboardRole();
    const isPendingAuthorized =
        Boolean(pendingRole) && (allowedRoles.length === 0 || allowedRoles.includes(String(pendingRole)));

    // A session is only trustworthy once it is NOT placeholder data AND fully resolved.
    const isSessionResolved =
        isLoaded &&
        isSignedIn &&
        !isSessionLoading &&
        !isPlaceholderData &&
        !sessionError &&
        Boolean(user) &&
        Boolean(role);
    const isAuthorized =
        isPendingAuthorized ||
        (isSessionResolved && (allowedRoles.length === 0 || allowedRoles.includes(String(role))));
    const isReady = !isLoaded ? false : !isSignedIn ? true : isSessionResolved || isPendingAuthorized;

    // True only once we have a fully-resolved (non-placeholder) session that
    // is definitively NOT one of the allowed roles -- the same condition the
    // redirect effect below acts on, so a caller gating render on this stays
    // in lockstep with the actual redirect decision instead of drifting out
    // of sync with it.
    const isKnownWrongRole =
        isSessionResolved &&
        !isPendingAuthorized &&
        allowedRoles.length > 0 &&
        !allowedRoles.includes(String(role));
    // True once Clerk has loaded and confirmed there's no session at all --
    // distinct from "still loading," which isn't grounds to block anything.
    const isConfirmedSignedOut = isLoaded && !isSignedIn;
    // Whether a page under this guard should hold off on rendering its own
    // content/loading UI: only while we either don't know anything yet
    // (Clerk itself hasn't loaded) or we've conclusively determined this
    // visitor doesn't belong here (signed out, or resolved to a role that
    // isn't allowed) -- both cases redirect away via the effect below. The
    // much more common "still verifying, but probably fine" window is
    // deliberately NOT blocking: pages fetch their own data independently of
    // this guard anyway (the backend enforces the real authorization), so
    // gating render here only bought a second, generic loading skeleton in
    // front of whatever loading UI the page already shows for its own
    // fetch -- shown on every hard refresh, not just first sign-in.
    const shouldBlockRender = !isLoaded || isConfirmedSignedOut || isKnownWrongRole;

    useEffect(() => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push('/login');
            return;
        }

        if (isPendingAuthorized) {
            return;
        }

        // Never redirect based on placeholder data — wait for the real session.
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

    return { isAuthorized, isReady, isPendingAuthorized, shouldBlockRender };
}
