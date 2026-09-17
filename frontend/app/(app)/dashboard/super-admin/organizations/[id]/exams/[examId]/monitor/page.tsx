'use client';
import React from 'react';
import ExamMonitorView from '@/app/components/Features/Exams/ExamMonitorView';

export default function SuperAdminOrganizationExamMonitor({
    params,
}: {
    params: Promise<{ id: string; examId: string }>;
}) {
    const { id, examId } = React.use(params);
    const basePath = `/dashboard/super-admin/organizations/${id}`;
    return (
        <div className="min-h-screen bg-slate-50">
            <ExamMonitorView examId={examId} userRole="admin" />
        </div>
    );
}
