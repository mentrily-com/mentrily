import CoursePlayerSkeleton from '@/app/components/Skeletons/CoursePlayerSkeleton';

export default function Loading() {
    return (
        <div className="h-[calc(100dvh-var(--topbar-height)-20px)] min-h-0 overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-sm sm:h-[calc(100dvh-var(--topbar-height)-36px)]">
            <CoursePlayerSkeleton hasSidebar={true} sidebarCollapsed={true} isExamMode={false} fillHeight={true} />
        </div>
    );
}
