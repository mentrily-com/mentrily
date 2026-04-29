'use client';

import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
        const allowLocalAnalytics = process.env.NEXT_PUBLIC_POSTHOG_ALLOW_LOCAL === 'true';
        const isLocalhost =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (!posthogKey || (isLocalhost && !allowLocalAnalytics)) {
            setIsReady(false);
            return;
        }

        posthog.init(posthogKey, {
            api_host: posthogHost || 'https://us.i.posthog.com',
            capture_pageview: true,
            capture_pageleave: true,
            person_profiles: 'identified_only',
        });

        setIsReady(true);

        return () => {
            posthog.reset();
        };
    }, []);

    if (!isReady) {
        return <>{children}</>;
    }

    return <PHProvider client={posthog}>{children}</PHProvider>;
}
