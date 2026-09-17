'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePostHog } from 'posthog-js/react';
import { setUser } from '@sentry/nextjs';
import { useSession } from '@/hooks/useSession';

export default function UserTelemetryBridge() {
    const { isLoaded, isSignedIn } = useAuth();
    const { session } = useSession();
    const posthog = usePostHog();

    useEffect(() => {
        if (!isLoaded || !isSignedIn) {
            setUser(null);
            if (posthog) {
                posthog.reset();
            }
            return;
        }

        if (!session) return;

        const distinctId = String(session.id || (session as any).email || '').trim();
        const email = String((session as any).email || '').trim();

        if (distinctId && posthog) {
            posthog.identify(distinctId, {
                email: email || undefined,
                role: session.role || undefined,
                plan: session.plan || undefined,
                orgId: session.orgId || undefined,
            });
        }

        setUser({
            id: distinctId || undefined,
            email: email || undefined,
            role: session.role || undefined,
            plan: session.plan || undefined,
            orgId: session.orgId || undefined,
        } as any);
    }, [isLoaded, isSignedIn, session, posthog]);

    return null;
}
