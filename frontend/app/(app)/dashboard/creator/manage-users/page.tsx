'use client';

import React from 'react';
import ManageUsersSkeleton from '@/app/components/Skeletons/ManageUsersSkeleton';
import AdminUsersView from '@/app/components/Features/Admin/AdminUsersView';
import { usePlan } from '@/hooks/usePlan';

export default function ManageUsersPage() {
    const { loading } = usePlan();

    if (loading) {
        return <ManageUsersSkeleton />;
    }

    return <AdminUsersView basePath="/dashboard/creator" />;
}
