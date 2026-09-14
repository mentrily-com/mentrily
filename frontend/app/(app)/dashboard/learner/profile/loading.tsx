import ProfilePageSkeleton from '@/app/components/Skeletons/ProfilePageSkeleton';

export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
                <ProfilePageSkeleton />
            </main>
        </div>
    );
}
