import LearnerCertificatesSkeleton from '@/app/components/Skeletons/LearnerCertificatesSkeleton';

export default function Loading() {
    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            <div className="border-b border-gray-100 bg-white/90">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-wrap items-center gap-4 sm:gap-10">
                    <div className="py-4 text-sm font-semibold text-[var(--brand)] border-b-2 border-[var(--brand)] px-1">
                        My Certificates
                    </div>
                    <div className="text-xs font-medium text-gray-400">
                        Loading credentials...
                    </div>
                </div>
            </div>

            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
                <LearnerCertificatesSkeleton />
            </main>
        </div>
    );
}
