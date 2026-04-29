'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { Course } from '@/app/components/Authoring/types';
import { useRouter } from 'next/navigation';
import AlertModal from '@/app/components/Common/AlertModal';
import { useState } from 'react';
import { AuthService } from '@/services/api/AuthService';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

const CourseBuilder = dynamic(() => import('@/app/components/Authoring/CourseBuilder'), {
    ssr: false,
    loading: () => <DashboardSkeleton type="form" userRole="teacher" noNavbar />,
});

interface CourseEditorProps {
    initialData?: Course;
    onDelete?: () => void; // Optional override
    userRole?: 'admin' | 'teacher';
    basePath?: string;
    organizationId?: string;
}

export default function CourseEditor({
    initialData,
    onDelete,
    userRole = 'teacher',
    basePath = '/dashboard/creator',
    organizationId,
}: CourseEditorProps) {
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
        if (onDelete) {
            onDelete();
            return;
        }

        setAlertConfig({
            isOpen: true,
            title: 'Deleted',
            message: 'Course deleted successfully!',
            type: 'info',
        });
        setTimeout(() => router.push(`${basePath}/courses` || `${basePath}`), 1000);
    };

    return (
        <>
            <CourseBuilder
                initialData={initialData}
                onDelete={handleDelete}
                basePath={basePath}
                userRole={userRole === 'admin' ? 'admin' : 'teacher'}
                orgPermissions={userData?.features}
                organizationId={organizationId}
            />
            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type || 'info'}
                confirmLabel="Close"
                onConfirm={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
                onCancel={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
            />
        </>
    );
}
