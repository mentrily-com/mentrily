import CoursePlayerSkeleton from './CoursePlayerSkeleton';
import SkeletonRoot from './SkeletonRoot';

// Learner exam result review: score header bar (title + verdict + total) above the question player.
// h-full (not min-h-screen) so it fits the dashboard layout's fixed-height content area.
export default function ExamResultReviewSkeleton() {
    return (
        <SkeletonRoot className="h-full flex flex-col bg-white overflow-hidden">
            <div className="bg-white border-b border-slate-100 px-4 py-3 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
                <div className="space-y-2">
                    <div className="h-5 w-56 rounded-md bg-slate-200 animate-pulse" />
                    <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="flex gap-3 sm:gap-4">
                    <div className="h-12 w-[132px] rounded-xl bg-slate-100 animate-pulse" />
                    <div className="h-12 w-[132px] rounded-xl bg-slate-50 animate-pulse" />
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
                <CoursePlayerSkeleton hasSidebar={true} isExamMode={false} />
            </div>
        </SkeletonRoot>
    );
}
