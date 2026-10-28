import CoursePlayerSkeleton from './CoursePlayerSkeleton';

// Shared by the submission-preview loading.tsx files and their pages' loading branch, so the
// route fallback and the in-page skeleton are the same card (sidebar starts collapsed).
export default function SubmissionPreviewSkeleton() {
    return (
        <div className="h-[calc(100dvh-var(--topbar-height)-20px)] min-h-0 overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-sm sm:h-[calc(100dvh-var(--topbar-height)-36px)]">
            <CoursePlayerSkeleton hasSidebar={true} sidebarCollapsed={true} isExamMode={false} fillHeight={true} />
        </div>
    );
}
