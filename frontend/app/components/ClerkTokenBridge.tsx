'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { registerClerkTokenGetter } from '@/lib/clerk-token';

export default function ClerkTokenBridge() {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    useEffect(() => {
        registerClerkTokenGetter(async () => {
            if (!isLoaded || !isSignedIn) {
                return null;
            }

            const token = await getToken();
            return token || null;
        });
    }, [getToken, isLoaded, isSignedIn]);

    return null;
}
