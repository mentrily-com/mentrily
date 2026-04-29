'use client';

import React from 'react';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

export default function LearnerLoading() {
    return <DashboardSkeleton type="main" userRole="student" noNavbar />;
}
