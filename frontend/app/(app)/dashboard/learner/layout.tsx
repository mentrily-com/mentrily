'use client';
import React from 'react';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import LearnerDashboardSkeleton from '@/app/components/Skeletons/LearnerDashboardSkeleton';
import Navbar from '@/app/components/Navbar';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const { shouldBlockRender } = useRoleGuard(['STUDENT']);

    if (shouldBlockRender) {
        return (
            <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
                <Navbar userRole="student" />
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <LearnerDashboardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            <Navbar userRole="student" />
            <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
    );
}
