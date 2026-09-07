'use client';

import TeacherStudentsSkeleton from '@/app/components/Skeletons/TeacherStudentsSkeleton';

// TeacherStudentsPage (which this route renders) already falls back to
// TeacherStudentsSkeleton while its own data resolves. Matching it here means the
// route-transition fallback and the mounted page show the same shape, instead
// of the parent dashboard skeleton flashing first and then being replaced.
export default function Loading() {
    return <TeacherStudentsSkeleton />;
}
