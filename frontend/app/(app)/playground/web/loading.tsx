import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';
import PlaygroundSkeleton from '@/app/components/Skeletons/PlaygroundSkeleton';
import { LabCardSkeleton } from '@/app/components/Skeletons/NotebookSkeleton';

export default function Loading() {
    return (
        <PublicPlaygroundShell embedded>
            <LabCardSkeleton>
                <PlaygroundSkeleton fillHeight />
            </LabCardSkeleton>
        </PublicPlaygroundShell>
    );
}
