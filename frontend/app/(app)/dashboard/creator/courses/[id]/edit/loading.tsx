import CourseEditSkeleton from '@/app/components/Skeletons/CourseEditSkeleton';

// The route-transition fallback has to be the same visual this page renders
// for its own data fetch (CourseEditSkeleton), or navigating here shows the
// parent route's differently-shaped skeleton first and then swaps -- a
// visible double-load on a route that was already loading correctly.
export default function Loading() {
    return <CourseEditSkeleton />;
}
