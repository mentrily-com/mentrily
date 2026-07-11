'use client';
import BrandedSpinner from '@/app/components/Common/BrandedSpinner';

// See app/(app)/loading.tsx — the playground page renders its own
// PlaygroundSkeleton while it loads, so this route-transition fallback
// stays a lightweight spinner instead of duplicating it.
export default function PlaygroundLoading() {
    return <BrandedSpinner />;
}
