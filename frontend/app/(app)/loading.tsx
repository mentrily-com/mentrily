'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import BrandedPageLoader from '@/app/components/Common/BrandedPageLoader';

// Next's route-transition Suspense fallback. NextTopLoader (wired in the
// layout) already signals "navigating" with its progress bar, and every
// destination page renders its own accurate, layout-matching skeleton the
// instant it mounts — so this must not compete with either. Returning null
// here used to be a full-page skeleton (or, briefly, a generic spinner) that
// flashed right before the page's own skeleton, reading as a double load.
//
// The only routes that keep a full takeover are ones where the app chrome
// itself must never flash: unauthenticated auth screens, and exam entry
// (no navigation should be visible mid-exam).
export default function Loading() {
    const pathname = usePathname();
    const isAuthRoute =
        !pathname ||
        pathname === '/' ||
        pathname === '/about' ||
        pathname === '/contact' ||
        pathname === '/login' ||
        pathname === '/signup' ||
        pathname === '/forgot-password' ||
        pathname.startsWith('/sign-in') ||
        pathname.startsWith('/sign-up');

    if (isAuthRoute || pathname?.startsWith('/exam/')) {
        return <BrandedPageLoader />;
    }

    return null;
}
