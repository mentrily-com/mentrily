'use client';

import React from 'react';
import CourseEditor from '@/app/components/Features/Courses/CourseEditor';
import { usePlan } from '@/hooks/usePlan';

export default function CreateCoursePage() {
    const { role } = usePlan();
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    return (
        <div className="teacher-theme h-[calc(100vh-var(--topbar-height)-36px)]">
            <CourseEditor userRole={dashboardRole} basePath="/dashboard/creator" />
        </div>
    );
}
