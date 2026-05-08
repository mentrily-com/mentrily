'use client';
import React from 'react';
import ExamMonitorView from '@/app/components/Features/Exams/ExamMonitorView';
import { usePlan } from '@/hooks/usePlan';

export default function ExamMonitorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const { role } = usePlan();
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    return (
        <div className="animate-fade-in pb-10">
            <ExamMonitorView examId={id} userRole={dashboardRole} />
        </div>
    );
}
