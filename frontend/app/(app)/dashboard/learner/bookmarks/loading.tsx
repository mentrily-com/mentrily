import LearnerBookmarksSkeleton from '@/app/components/Skeletons/LearnerBookmarksSkeleton';

// Same skeleton the page renders while its bookmarks load, so the
// route-transition fallback and the mounted page show one continuous shape.
export default function Loading() {
    return (
        <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
            <LearnerBookmarksSkeleton />
        </main>
    );
}
