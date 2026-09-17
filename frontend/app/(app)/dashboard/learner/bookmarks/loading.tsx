import LearnerBookmarksSkeleton from '@/app/components/Skeletons/LearnerBookmarksSkeleton';

export default function Loading() {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            <div className="border-b border-slate-100">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-wrap items-center gap-4 sm:gap-10">
                    <div className="py-4 text-sm font-black text-[var(--brand)] border-b-2 border-[var(--brand)] px-1">
                        Bookmarks
                    </div>
                    <div className="text-xs font-bold text-slate-400">
                        Loading saved units...
                    </div>
                </div>
            </div>

            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8 text-left">
                <LearnerBookmarksSkeleton />
            </main>
        </div>
    );
}
