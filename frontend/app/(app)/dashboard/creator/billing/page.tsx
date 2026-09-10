'use client';

import React from 'react';
import CreatorBillingSkeleton from '@/app/components/Skeletons/CreatorBillingSkeleton';
import TeacherBillingPage from '@/app/(app)/dashboard/creator/_components/TeacherBillingPage';
import AdminBillingPage from '@/app/(app)/dashboard/creator/_components/AdminBillingPage';
import { usePlan } from '@/hooks/usePlan';

export default function CreatorBillingPage() {
    const { role, loading } = usePlan();

    if (loading) {
        return <CreatorBillingSkeleton />;
    }

    if (role === 'ADMIN') {
        return <AdminBillingPage />;
    }

    return <TeacherBillingPage />;
}
