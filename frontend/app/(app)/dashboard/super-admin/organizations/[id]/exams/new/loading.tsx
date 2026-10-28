import ExamEditorSkeleton from '@/app/components/Skeletons/ExamEditorSkeleton';

// Same height container as page.tsx around ExamEditor.
export default function Loading() {
    return (
        <div className="h-[calc(100vh-var(--topbar-height)-36px)]">
            <ExamEditorSkeleton />
        </div>
    );
}
