'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Loading from '@/app/(app)/loading';
import AlertModal from '@/app/components/Common/AlertModal';
import { useState } from 'react';
import { AuthService } from '@/services/api/AuthService';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

const ExamBuilder = dynamic(() => import('@/app/components/Authoring/ExamBuilder'), {
    ssr: false,
    loading: () => <DashboardSkeleton type="form" userRole="teacher" noNavbar />,
});

interface ExamEditorProps {
    initialData?: any;
    userRole?: 'admin' | 'teacher';
    basePath?: string;
    organizationId?: string;
}

export default function ExamEditor({
    initialData,
    userRole = 'teacher',
    basePath = '/dashboard/creator',
    organizationId,
}: ExamEditorProps) {
    const router = useRouter();
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'danger' | 'warning' | 'info';
    }>({ isOpen: false, title: '', message: '' });
    const [userData, setUserData] = useState<any>(null);

    React.useEffect(() => {
        const loadUser = async () => {
            const user = await AuthService.checkSession();
            setUserData(user);
        };

        void loadUser();
    }, []);

    const handleDelete = () => {
        setAlertConfig({
            isOpen: true,
            title: 'Deleted',
            message: 'Exam deleted successfully!',
            type: 'info',
        });
        setTimeout(() => router.push(`${basePath}/exams`), 1000);
    };

    return (
        <Suspense fallback={<Loading />}>
            <div className="min-h-screen bg-white">
                <ExamBuilder
                    initialData={initialData}
                    onDelete={handleDelete}
                    basePath={basePath}
                    userRole={userRole === 'admin' ? 'admin' : 'teacher'}
                    orgPermissions={userData?.features}
                    organizationId={organizationId}
                />
            </div>
            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type || 'info'}
                confirmLabel="Close"
                onConfirm={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
                onCancel={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
            />
        </Suspense>
    );
}
