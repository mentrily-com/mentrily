'use client';
import React from 'react';
import { useOrganization } from '@/app/context/OrganizationContext';
import { BrandLockup } from '@/components/brand/BrandLockup';

// Lightweight route-transition indicator. Individual pages render their own
// accurate skeleton while fetching data, so this stays intentionally simple
// (no page-shaped skeleton) to avoid a "skeleton, then a different skeleton"
// flash between route navigation and the page's own loading state.
export default function BrandedSpinner() {
    const { organization } = useOrganization();

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
            <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute w-20 h-20 border-4 border-t-[var(--brand)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                <div className="absolute flex items-center justify-center">
                    <BrandLockup
                        orgName={organization?.name}
                        orgLogo={organization?.logo}
                        collapsed
                        defaultLogoClassName="h-12 w-12 max-w-none rounded-2xl animate-pulse"
                        iconClassName="h-12 w-12 animate-pulse"
                        priority
                    />
                </div>
            </div>
            <div className="mt-8 text-center">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Syncing your journey</h2>
                <div className="flex items-center justify-center gap-1 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-bounce"></div>
                </div>
            </div>
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-50 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent w-full animate-[loading-bar_1.5s_infinite]"></div>
            </div>
            <style jsx>{`
                @keyframes loading-bar {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
            `}</style>
        </div>
    );
}
