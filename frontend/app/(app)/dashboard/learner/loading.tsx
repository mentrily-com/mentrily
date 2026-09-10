import LearnerDashboardSkeleton from '@/app/components/Skeletons/LearnerDashboardSkeleton';

// Matches what page.tsx renders while its data resolves
// (`if (loading && !stats) return <LearnerDashboardSkeleton />`). The busy
// /dashboard/learner/* sub-routes now carry their own matching loading.tsx,
// so this can be the exact shape of the learner dashboard itself rather than
// a generic compromise shared with thirteen other routes.
export default function LearnerLoading() {
    return <LearnerDashboardSkeleton />;
}
