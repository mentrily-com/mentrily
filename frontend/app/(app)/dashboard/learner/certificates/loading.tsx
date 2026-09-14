import LearnerCertificatesSkeleton from '@/app/components/Skeletons/LearnerCertificatesSkeleton';

export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            <div className="border-b border-slate-100 bg-white/90 backdrop-blur-sm">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-wrap items-center gap-4 sm:gap-10">
                    <div className="py-4 text-sm font-black text-[var(--brand)] border-b-2 border-[var(--brand)] px-1">
                        My Certificates
                    </div>
                    <div className="text-xs font-bold text-slate-400">
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
