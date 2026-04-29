'use client';
import React from 'react';
import ExamResultsView from '@/app/components/Features/Exams/ExamResultsView';

export default function SuperAdminOrganizationExamResults({
    params,
}: {
    params: Promise<{ id: string; examId: string }>;
}) {
    const { id, examId } = React.use(params);
    const basePath = `/dashboard/super-admin/organizations/${id}`;
    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            <ExamResultsView examId={examId} userRole="admin" basePath={basePath} />
        </div>
    );
}
