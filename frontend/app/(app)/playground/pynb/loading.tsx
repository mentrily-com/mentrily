import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';
import NotebookSkeleton from '@/app/components/Skeletons/NotebookSkeleton';

export default function Loading() {
    return (
        <PublicPlaygroundShell embedded>
            <NotebookSkeleton />
        </PublicPlaygroundShell>
    );
}
