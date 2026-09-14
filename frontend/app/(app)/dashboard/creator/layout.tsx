'use client';

import React from 'react';
import CreatorDashboardSkeleton from '@/app/components/Skeletons/CreatorDashboardSkeleton';
import { useRoleGuard } from '@/hooks/useRoleGuard';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
    const { shouldBlockRender } = useRoleGuard(['TEACHER', 'ADMIN']);

    if (shouldBlockRender) return <CreatorDashboardSkeleton />;

    return <>{children}</>;
}
