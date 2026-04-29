'use client';
import React from 'react';
import AdminExamsView from '@/app/components/Features/Admin/AdminExamsView';

export default function SuperAdminOrganizationExams({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    return <AdminExamsView basePath={`/dashboard/super-admin/organizations/${id}`} organizationId={id} />;
}
