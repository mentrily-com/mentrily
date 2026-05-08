'use client';

import React from 'react';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useSession } from '@/hooks/useSession';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
    const { isAuthorized, isPendingAuthorized } = useRoleGuard(['TEACHER', 'ADMIN']);
    const { data: sessionUser } = useSession();
    const skeletonRole = sessionUser?.role === 'ADMIN' ? 'admin' : 'teacher';

    if (!isAuthorized || isPendingAuthorized) return <DashboardSkeleton type="main" userRole={skeletonRole} />;

    return <>{children}</>;
}
