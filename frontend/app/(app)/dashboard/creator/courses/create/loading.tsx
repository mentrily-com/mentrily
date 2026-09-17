import CourseBuilderShellSkeleton from '@/app/components/Skeletons/CourseBuilderShellSkeleton';

export default function Loading() {
    return (
        <div className="teacher-theme h-[calc(100vh-var(--topbar-height)-36px)]">
            <CourseBuilderShellSkeleton />
        </div>
    );
}
