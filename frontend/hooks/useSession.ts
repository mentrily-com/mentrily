'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { AuthService } from '@/services/api/AuthService';

type SessionHint = {
    id: string;
    orgId: string;
    role: string;
    hasCompletedOnboarding?: boolean;
};

type CachedSession = SessionHint & {
    plan?: string;
    planStatus?: string;
    features?: Record<string, unknown>;
    effectiveFeatures?: Record<string, unknown>;
    limits?: Record<string, unknown>;
    usage?: Record<string, unknown>;
};

type PendingDashboardRole = {
    role: string;
    destination?: string;
    expiresAt?: number;
};

const ALLOWED_ROLES = new Set(['STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']);
const SESSION_CACHE_KEY = 'bc-session-snapshot';

function normalizeRole(value?: string | null): string {
    return String(value || '').trim().toUpperCase().replace('-', '_');
}

function readSessionHint(): SessionHint | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const userId = document.querySelector('meta[name="bc-session-user-id"]')?.getAttribute('content')?.trim() || '';
    const orgId = document.querySelector('meta[name="bc-session-org-id"]')?.getAttribute('content')?.trim() || '';
    const role =
        document.querySelector('meta[name="bc-session-role"]')?.getAttribute('content')?.trim().toUpperCase() || '';

    if (!userId || !ALLOWED_ROLES.has(role)) {
        return null;
    }

    return {
        id: userId,
        orgId,
        role,
        hasCompletedOnboarding: false,
    };
}

function readStoredRole(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    const value = window.localStorage.getItem('user-role') || '';
    return String(value).trim().toUpperCase().replace('-', '_');
}

function readCachedSession(): CachedSession | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as CachedSession & { cachedAt?: number };
        const role = normalizeRole(parsed?.role);
        const cachedAt = Number(parsed?.cachedAt || 0);

        if (!parsed?.id || !ALLOWED_ROLES.has(role) || !Number.isFinite(cachedAt)) {
            window.localStorage.removeItem(SESSION_CACHE_KEY);
            return null;
        }

        if (Date.now() - cachedAt > 5 * 60_000) {
            window.localStorage.removeItem(SESSION_CACHE_KEY);
            return null;
        }

        return {
            ...parsed,
            role,
        };
    } catch {
        window.localStorage.removeItem(SESSION_CACHE_KEY);
        return null;
    }
}

function writeCachedSession(session: unknown) {
    if (typeof window === 'undefined' || !session || typeof session !== 'object') {
        return;
    }

    const record = session as Record<string, unknown>;
    const id = String(record.id || '').trim();
    const role = normalizeRole(record.role as string | undefined);

    if (!id || !ALLOWED_ROLES.has(role) || typeof record.plan === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            SESSION_CACHE_KEY,
            JSON.stringify({
                ...record,
                role,
                cachedAt: Date.now(),
            }),
        );
    } catch {}
}

function readPendingDashboardRole(): PendingDashboardRole | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const raw = window.localStorage.getItem('pending-dashboard-role');
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as PendingDashboardRole;
        const role = String(parsed?.role || '').trim().toUpperCase();
        const expiresAt = Number(parsed?.expiresAt || 0);

        if (!role || !ALLOWED_ROLES.has(role) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            window.localStorage.removeItem('pending-dashboard-role');
            return null;
        }

        return {
            role,
            destination: String(parsed?.destination || '').trim(),
            expiresAt,
        };
    } catch {
        window.localStorage.removeItem('pending-dashboard-role');
        return null;
    }
}

export function useSession() {
    const { isLoaded, isSignedIn, sessionId, userId } = useAuth();
    const pathname = usePathname();
    const sessionHint = readSessionHint();
    const cachedSession = readCachedSession();
    const hintedUserId = sessionHint?.id || '';
    const normalizedHintRole = String(sessionHint?.role || '').toUpperCase();
    const storedRole = readStoredRole();
    const pendingDashboardRole = readPendingDashboardRole();
    const pendingRole = String(pendingDashboardRole?.role || '').toUpperCase();
    const routeHintRole =
        pathname?.startsWith('/dashboard/creator') && (pendingRole === 'ADMIN' || pendingRole === 'TEACHER')
            ? pendingRole
            : normalizedHintRole;
    const effectiveHintRole =
        routeHintRole ||
        (pathname?.startsWith('/dashboard/creator') && (storedRole === 'ADMIN' || storedRole === 'TEACHER')
            ? storedRole
            : '');
    const isWorkspaceRoute =
        pathname?.startsWith('/dashboard') || pathname?.startsWith('/playground');
    const isHintCompatibleWithRoute =
        !pathname ||
        !effectiveHintRole ||
        (!pathname.startsWith('/dashboard/creator') &&
            !pathname.startsWith('/dashboard/super-admin') &&
            !pathname.startsWith('/dashboard/learner')) ||
        (pathname.startsWith('/dashboard/creator') &&
            (effectiveHintRole === 'TEACHER' || effectiveHintRole === 'ADMIN')) ||
        (pathname.startsWith('/dashboard/super-admin') &&
            effectiveHintRole === 'SUPER_ADMIN') ||
        (pathname.startsWith('/dashboard/learner') && effectiveHintRole === 'STUDENT');
    const placeholderSession =
        isLoaded && isSignedIn && cachedSession?.id && isHintCompatibleWithRoute
            ? {
                  ...cachedSession,
                  role: pendingRole || cachedSession.role,
              }
            : isLoaded && isSignedIn && sessionHint?.id && isHintCompatibleWithRoute
            ? {
                  ...sessionHint,
                  role: effectiveHintRole || sessionHint.role,
              }
            : undefined;

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['session', sessionId || userId || hintedUserId || 'anonymous'],
        enabled: isLoaded,
        placeholderData: placeholderSession,
        queryFn: async () => {
            if (!isSignedIn) {
                AuthService.resetSessionCache();
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(SESSION_CACHE_KEY);
                }
                return null;
            }

            const fetchVerifiedSession = async () => {
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    const verifiedSession = await AuthService.checkSession(true);
                    if (verifiedSession) {
                        writeCachedSession(verifiedSession);
                        return verifiedSession;
                    }

                    if (attempt < 2) {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }
                }

                return null;
            };

            if (isWorkspaceRoute || !isHintCompatibleWithRoute) {
                return await fetchVerifiedSession();
            }

            if (sessionHint?.id && sessionHint?.role) {
                return sessionHint;
            }

            return await fetchVerifiedSession();
        },
        staleTime: 5_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const session = data ?? null;

    if (session) {
        writeCachedSession(session);
    }

    if (
        typeof window !== 'undefined' &&
        pendingDashboardRole &&
        session?.role &&
        String(session.role).trim().toUpperCase() === pendingRole
    ) {
        window.localStorage.removeItem('pending-dashboard-role');
    }

    return {
        data: session,
        session,
        isLoading,
        error,
        refetch,
    };
}
