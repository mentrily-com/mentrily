'use client';

import React from 'react';
import EnrollmentModal from '@/app/components/Common/EnrollmentModal';
import CourseDetailsView from '@/app/components/Features/Courses/CourseDetailsView';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import StudioModuleList from '@/app/dashboard/creator/_components/StudioModuleList';
import StudioRecentActivity from '@/app/dashboard/creator/_components/StudioRecentActivity';
import { useStudioDashboard } from '@/app/dashboard/creator/_components/useStudioDashboard';
import { usePlan } from '@/hooks/usePlan';

export default function CreatorCoursesPage() {
    const {
        searchQuery,
        setSearchQuery,
        tab,
        setTab,
        enrollmentModal,
        setEnrollmentModal,
        viewingCourse,
        setViewingCourse,
        userData,
        filteredModules,
        recentActivity,
        loading,
    } = useStudioDashboard();
    const { role } = usePlan();
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    if (loading) return <DashboardSkeleton type="list" userRole={dashboardRole} />;

    const canCreateCourses = userData?.features?.canCreateCourses !== false;

    return (
        <div className="animate-fade-in">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                    Courses
                </h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Manage modules, publish drafts, and enroll students from one place.
                </p>
            </div>

            <div className="flex flex-col gap-8 xl:flex-row">
                <StudioModuleList
                    modules={filteredModules}
                    tab={tab}
                    searchQuery={searchQuery}
                    canCreateCourses={canCreateCourses}
                    onTabChange={setTab}
                    onSearchChange={setSearchQuery}
                    onViewCourse={setViewingCourse}
                    onOpenEnrollment={(course) =>
                        setEnrollmentModal({ isOpen: true, courseTitle: course.title, courseId: course.id })
                    }
                />
                <aside className="w-full xl:w-80 shrink-0">
                    <StudioRecentActivity activities={recentActivity} />
                </aside>
            </div>

            <EnrollmentModal
                isOpen={enrollmentModal.isOpen}
                onClose={() => setEnrollmentModal({ ...enrollmentModal, isOpen: false })}
                courseTitle={enrollmentModal.courseTitle}
                courseId={enrollmentModal.courseId}
                onEnroll={() => undefined}
            />

            <CourseDetailsView
                isOpen={!!viewingCourse}
                onClose={() => setViewingCourse(null)}
                course={viewingCourse}
                userRole={dashboardRole}
            />
        </div>
    );
}
