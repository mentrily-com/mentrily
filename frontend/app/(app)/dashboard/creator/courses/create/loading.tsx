'use client';

import CourseBuilderShellSkeleton from '@/app/components/Skeletons/CourseBuilderShellSkeleton';

// CourseEditor (which this route renders) already falls back to
// CourseBuilderShellSkeleton while its own data resolves. Matching it here means the
// route-transition fallback and the mounted page show the same shape, instead
// of the parent dashboard skeleton flashing first and then being replaced.
export default function Loading() {
    return <CourseBuilderShellSkeleton />;
}
