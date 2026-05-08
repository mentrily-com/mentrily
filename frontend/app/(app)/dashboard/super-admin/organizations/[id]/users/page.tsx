'use client';
import React from 'react';
import AdminUsersView from '@/app/components/Features/Admin/AdminUsersView';

export default function SuperAdminOrganizationUsersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    return <AdminUsersView basePath={`/dashboard/super-admin/organizations/${id}`} organizationId={id} />;
}
