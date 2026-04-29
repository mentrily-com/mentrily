'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle2, ArrowRightCircle } from 'lucide-react';

export default function ImpersonationBanner() {
    const router = useRouter();
    const [impersonation, setImpersonation] = useState<{
        active: boolean;
        name: string;
        role: string;
        origin: string;
    } | null>(null);

    useEffect(() => {
        const checkImpersonation = () => {
            const active = localStorage.getItem('impersonation_active') === 'true';
            if (active) {
                const target = JSON.parse(localStorage.getItem('impersonation_target') || '{}');
                const origin = localStorage.getItem('impersonation_origin') || '/dashboard/creator/users';
                setImpersonation({ active, name: target.name, role: target.role, origin });
            } else {
                setImpersonation(null);
            }
        };

        checkImpersonation();
        // Check on storage change (for multi-tab consistency if needed, though mostly for current tab lifecycle)
        window.addEventListener('storage', checkImpersonation);

        // Custom event for same-window updates
        window.addEventListener('impersonation_change', checkImpersonation);

        return () => {
            window.removeEventListener('storage', checkImpersonation);
            window.removeEventListener('impersonation_change', checkImpersonation);
        };
    }, []);

    const handleExit = () => {
        const origin = impersonation?.origin || '/dashboard/creator/users';
        localStorage.removeItem('impersonation_active');
        localStorage.removeItem('impersonation_target');
        localStorage.removeItem('impersonation_origin');

        // Update current role back to admin if we're exiting to the creator dashboard.
        if (origin.includes('/creator')) {
            localStorage.setItem('user-role', 'admin');
        }

        window.dispatchEvent(new Event('impersonation_change'));
        router.push(origin);
    };

    if (!impersonation) return null;

    return (
        <div className="w-full bg-slate-900 text-white py-1.5 px-4 sm:px-8 flex items-center justify-between animate-in slide-in-from-top duration-500 z-[1001] sticky top-0 border-b border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg shrink-0">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-tighter text-amber-500 hidden xs:inline">
                        Impersonating
                    </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                    <UserCircle2 size={14} className="text-slate-500 shrink-0" />
                    <p className="text-xs font-bold truncate">
                        <span className="text-slate-400 font-medium">Viewing:</span>
                        <span className="text-[var(--brand)] font-black ml-1 uppercase tracking-tight">
                            {impersonation.name}
                        </span>
                        <span className="ml-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            {impersonation.role}
                        </span>
                    </p>
                </div>
            </div>

            <button
                onClick={handleExit}
                className="flex items-center gap-2 px-3 py-1 bg-[var(--brand)] hover:scale-105 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-[var(--brand)]/20 active:scale-95 group shrink-0"
            >
                <span className="hidden sm:inline">Exit View</span>
                <span className="sm:hidden">Exit</span>
                <ArrowRightCircle size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
        </div>
    );
}
