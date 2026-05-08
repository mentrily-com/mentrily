'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { AuthService } from '@/services/api/AuthService';
import { usePlan } from '@/hooks/usePlan';

const ExamBuilder = dynamic(() => import('@/app/components/Authoring/ExamBuilder'), {
    ssr: false,
    loading: () => <DashboardSkeleton type="form" userRole="teacher" noNavbar />,
});

export default function CreateExamPage() {
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId') || undefined;
    const { role } = usePlan();
    const [userData, setUserData] = React.useState<any>(null);
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    React.useEffect(() => {
        const loadUser = async () => {
            const user = await AuthService.checkSession();
            setUserData(user);
        };

        void loadUser();
    }, []);

    return (
        <Suspense fallback={<DashboardSkeleton type="form" userRole={dashboardRole} />}>
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
