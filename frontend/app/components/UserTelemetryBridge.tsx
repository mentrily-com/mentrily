'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePostHog } from 'posthog-js/react';
import { setUser } from '@sentry/nextjs';
import { AuthService } from '@/services/api/AuthService';

export default function UserTelemetryBridge() {
    const { isLoaded, isSignedIn } = useAuth();
    const posthog = usePostHog();

    useEffect(() => {
        if (!isLoaded || !isSignedIn) {
            setUser(null);
            if (posthog) {
                posthog.reset();
            }
            return;
        }

        let active = true;

        const syncUserTelemetry = async () => {
            const session = await AuthService.checkSession();
            if (!active || !session) return;

            const distinctId = String(session.id || session.email || '').trim();
            const email = String(session.email || '').trim();

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
        };

        void syncUserTelemetry();

        return () => {
            active = false;
        };
    }, [isLoaded, isSignedIn, posthog]);

    return null;
}
