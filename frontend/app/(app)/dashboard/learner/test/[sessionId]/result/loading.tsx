import ExamResultReviewSkeleton from '@/app/components/Skeletons/ExamResultReviewSkeleton';

// Same component as the page's own loading branch, so the handoff is invisible.
export default function LearnerExamResultLoading() {
    return <ExamResultReviewSkeleton />;
}
