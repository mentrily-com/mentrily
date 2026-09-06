'use client';
import { TeacherService } from '@/services/api/TeacherService';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import AlertModal from '@/app/components/Common/AlertModal';
import { useToast } from '@/app/components/Common/Toast';
import CourseEditSkeleton from '@/app/components/Skeletons/CourseEditSkeleton';
import React from 'react';
import { usePlan } from '@/hooks/usePlan';

const CourseBuilder = dynamic(() => import('@/app/components/Authoring/CourseBuilder'), {
    ssr: false,
    loading: () => <CourseEditSkeleton />,
});

export default function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
    const { role } = usePlan();
    const router = useRouter();
    const { success } = useToast();
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'danger' | 'warning' | 'info';
    }>({ isOpen: false, title: '', message: '' });
    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';
    const { id } = React.use(params);

    useEffect(() => {
        async function loadCourse() {
            try {
                const data = await TeacherService.getCourse(id);
                // Ensure sections exists
                if (!data.sections || data.sections.length === 0) {
                    data.sections = [{ id: 'sec-init', title: 'Curriculum Start', questions: [] }];
                }
                setCourse(data);
            } catch (e) {
                console.error('Failed to load course', e);
            } finally {
                setLoading(false);
            }
        }
        loadCourse();
    }, [id]);

    const handleDelete = async () => {
        try {
            await TeacherService.deleteCourse(course.id);
            setAlertConfig({
                isOpen: true,
                title: 'Deleted',
                message: 'Course deleted successfully!',
                type: 'info',
            });
            setTimeout(() => router.push('/dashboard/creator'), 1000);
        } catch (e) {
            console.error('Delete failed', e);
            alert('Delete failed');
        }
    };

    if (loading) return <CourseEditSkeleton />;
    if (!course)
        return (
            <div className="p-12 text-center font-black uppercase tracking-widest text-rose-500">Course Not Found</div>
        );

    return (
        <div className="teacher-theme h-[calc(100vh-var(--topbar-height)-36px)]">
            <CourseBuilder
                initialData={course as any}
                onDelete={handleDelete}
                userRole={dashboardRole}
                basePath="/dashboard/creator"
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
        </div>
    );
}
