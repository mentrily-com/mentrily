'use client';
import React from 'react';
import ExamResultsView from '@/app/components/Features/Exams/ExamResultsView';
import { usePlan } from '@/hooks/usePlan';

export default function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const { role } = usePlan();
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    return (
        <div className="animate-fade-in pb-10">
            <ExamResultsView examId={id} userRole={dashboardRole} />
        </div>
    );
}
