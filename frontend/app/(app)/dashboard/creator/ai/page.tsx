'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const AiStudio = dynamic(() => import('@/app/components/AiStudio/AiStudio'), {
    ssr: false,
    loading: () => (
        <div className="h-[calc(100vh-var(--topbar-height)-36px)] animate-pulse rounded-2xl border border-slate-200 bg-white" />
    ),
});

export default function AiStudioPage() {
    return (
        <Suspense fallback={null}>
            <AiStudio />
        </Suspense>
    );
}
