'use client';
import React from 'react';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import SuperAdminDashboardSkeleton from '@/app/components/Skeletons/SuperAdminDashboardSkeleton';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const { shouldBlockRender } = useRoleGuard(['SUPER_ADMIN']);

    if (shouldBlockRender) return <SuperAdminDashboardSkeleton />;

    return <>{children}</>;
}
