'use client';

import React, { useEffect } from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function ClerkSignInCompatPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const query = searchParams.toString();
    const hasCallbackPath = pathname.includes('sso-callback');
    const isOauthCallback = hasCallbackPath || searchParams.get('oauth') === 'callback';
    const hasError = Boolean(searchParams.get('error') || searchParams.get('message') || searchParams.get('status'));

    useEffect(() => {
        if (isOauthCallback) return;
        const target = `/login${query ? `?${query}` : ''}`;
        router.replace(target);
    }, [isOauthCallback, query, router]);

    if (!isOauthCallback) return null;

    if (hasError) {
        const text =
            `${searchParams.get('error') || ''} ${searchParams.get('message') || ''} ${searchParams.get('status') || ''}`.toLowerCase();
        if (text.includes('authorization_invalid') || text.includes('cancel') || text.includes('denied')) {
            router.replace('/login?error=oauth_cancelled');
        } else {
            router.replace('/login?error=oauth_failed');
        }
        return null;
    }

    return (
        <AuthenticateWithRedirectCallback
            transferable={false}
            signInUrl="/login"
            signUpUrl="/signup"
        />
    );
}
