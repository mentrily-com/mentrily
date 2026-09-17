'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import NewExamSkeleton from '@/app/components/Skeletons/NewExamSkeleton';
import { usePlan } from '@/hooks/usePlan';
import { useSession } from '@/hooks/useSession';

const ExamBuilder = dynamic(() => import('@/app/components/Authoring/ExamBuilder'), {
    ssr: false,
    loading: () => <NewExamSkeleton />,
});

export default function CreateExamPage() {
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId') || undefined;
    const { role } = usePlan();
    const { session: userData } = useSession();
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    return (
        <Suspense fallback={<NewExamSkeleton />}>
            <div className="animate-fade-in h-[calc(100vh-var(--topbar-height)-36px)]">
                <ExamBuilder
                    basePath="/dashboard/creator"
                    courseId={courseId}
                    userRole={dashboardRole}
                    orgPermissions={userData?.features}
                />
            </div>
        </Suspense>
    );
}
