'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

export function useRequireAuth(redirectTo = '/login') {
    const { isSignedIn, isLoaded } = useAuth();

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            window.location.href = redirectTo;
        }
    }, [isLoaded, isSignedIn, redirectTo]);

    return Boolean(isSignedIn);
}
