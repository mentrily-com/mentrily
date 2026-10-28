'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AiStudioSkeleton from '@/app/components/Skeletons/AiStudioSkeleton';

const AiStudio = dynamic(() => import('@/app/components/AiStudio/AiStudio'), {
    ssr: false,
    loading: () => <AiStudioSkeleton />,
});

export default function AiStudioPage() {
    return (
        <Suspense fallback={<AiStudioSkeleton />}>
            <AiStudio />
        </Suspense>
    );
}
