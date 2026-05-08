'use client';

import React from 'react';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import TeacherBillingPage from '@/app/(app)/dashboard/creator/_components/TeacherBillingPage';
import AdminBillingPage from '@/app/(app)/dashboard/creator/_components/AdminBillingPage';
import { usePlan } from '@/hooks/usePlan';

export default function CreatorBillingPage() {
    const { role, loading } = usePlan();

    if (loading) {
        return <DashboardSkeleton type="main" userRole="teacher" />;
    }

    if (role === 'ADMIN') {
        return <AdminBillingPage />;
    }

    return <TeacherBillingPage />;
}
