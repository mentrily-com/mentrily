'use client';
import React from 'react';
import BrandedSpinner from '@/app/components/Common/BrandedSpinner';

// This is Next's route-transition Suspense fallback — shown only for the
// brief moment between navigating and the destination page mounting. Every
// destination page already renders its own accurate skeleton while its data
// fetch resolves, so this stays a lightweight spinner rather than a
// page-shaped skeleton (which used to flash right before the page's own,
// nearly-identical skeleton — a jarring "double skeleton" load).
export default function Loading() {
    return <BrandedSpinner />;
}
