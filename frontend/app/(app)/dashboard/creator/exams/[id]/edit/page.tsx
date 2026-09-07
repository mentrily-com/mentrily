'use client';
import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import ExamEditSkeleton from '@/app/components/Skeletons/ExamEditSkeleton';
import AlertModal from '@/app/components/Common/AlertModal';
import { TeacherService } from '@/services/api/TeacherService';
import { usePlan } from '@/hooks/usePlan';

const ExamBuilder = dynamic(() => import('@/app/components/Authoring/ExamBuilder'), {
    ssr: false,
    loading: () => <ExamEditSkeleton />,
});

export default function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
    const { role } = usePlan();
    const router = useRouter();
    const { id } = React.use(params);
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'danger' | 'warning' | 'info';
    }>({ isOpen: false, title: '', message: '' });
    const [exam, setExam] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    useEffect(() => {
        async function loadExam() {
            try {
                const data = await TeacherService.getExam(id);
                setExam(data);
            } catch (e) {
                console.error('Failed to load exam', e);
            } finally {
                setLoading(false);
            }
        }
        loadExam();
    }, [id]);

    const handleDelete = async () => {
        try {
            await TeacherService.deleteExam(exam.id);
            setAlertConfig({
                isOpen: true,
                title: 'Deleted',
                message: 'Exam deleted successfully!',
                type: 'info',
            });
            setTimeout(() => router.push('/dashboard/creator/exams'), 1000);
        } catch (e) {
            console.error('Delete failed', e);
            alert('Delete failed');
        }
    };

    if (loading) return <ExamEditSkeleton />;
    if (!exam)
        return (
            <div className="p-12 text-center font-black uppercase tracking-widest text-rose-500">Exam Not Found</div>
        );

    return (
        <Suspense fallback={<ExamEditSkeleton />}>
            <div className="animate-fade-in h-[calc(100vh-var(--topbar-height)-36px)]">
                <ExamBuilder
                    initialData={exam as any}
                    onDelete={handleDelete}
                    basePath="/dashboard/creator"
                    userRole={dashboardRole}
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
