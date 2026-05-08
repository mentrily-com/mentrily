'use client';

import React from 'react';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import AdminUsersView from '@/app/components/Features/Admin/AdminUsersView';
import { usePlan } from '@/hooks/usePlan';

export default function ManageUsersPage() {
    const { role, loading } = usePlan();
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    if (loading) {
        return <DashboardSkeleton type="list" userRole={dashboardRole} />;
    }

    return <AdminUsersView basePath="/dashboard/creator" />;
}
