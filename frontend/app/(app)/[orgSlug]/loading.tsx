'use client';
import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';
import PlaygroundSkeleton from '@/app/components/Skeletons/PlaygroundSkeleton';

// Co-located with page.tsx so the route-transition fallback matches the
// actual page instead of falling back to the group-level loading.tsx (which
// returns null for content routes and left a blank white flash here before
// the page's own shell painted in).
export default function OrgSlugLoading() {
    return (
        <PublicPlaygroundShell>
            <PlaygroundSkeleton />
        </PublicPlaygroundShell>
    );
}
