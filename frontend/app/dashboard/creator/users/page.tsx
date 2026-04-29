'use client';

import React from 'react';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import TeacherStudentsPage from '@/app/dashboard/creator/_components/TeacherStudentsPage';
import { usePlan } from '@/hooks/usePlan';

export default function CreatorUsersPage() {
    const { role, loading } = usePlan();
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    if (loading) {
        return <DashboardSkeleton type="list" userRole={dashboardRole} />;
    }

    return <TeacherStudentsPage />;
}
