import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';
import PlaygroundSkeleton from '@/app/components/Skeletons/PlaygroundSkeleton';

// Same embedded shell (padding + xl question-builder column) as page.tsx so nothing shifts on mount.
export default function Loading() {
    return (
        <PublicPlaygroundShell embedded showQuestionBuilder>
            <PlaygroundSkeleton fillHeight />
        </PublicPlaygroundShell>
    );
}
