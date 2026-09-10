'use client';
import React from 'react';
import CourseEditor from '@/app/components/Features/Courses/CourseEditor';

export default function SuperAdminOrganizationCourseNew({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    return (
        <div className="h-[calc(100vh-var(--topbar-height)-36px)]">
            <CourseEditor
                userRole="admin"
                basePath={`/dashboard/super-admin/organizations/${id}`}
                organizationId={id}
            />
        </div>
    );
}
