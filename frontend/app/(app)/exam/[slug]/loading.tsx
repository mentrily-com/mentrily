import CoursePlayerSkeleton from '@/app/components/Skeletons/CoursePlayerSkeleton';

export default function Loading() {
    return <CoursePlayerSkeleton isExamMode={true} hasSidebar={true} fillHeight={false} />;
}
