'use client';

import UnifiedProfilePage from '@/app/components/Features/Profile/UnifiedProfilePage';

export default function LearnerProfilePage() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8 animate-fade-in">
                <UnifiedProfilePage />
            </main>
        </div>
    );
}
