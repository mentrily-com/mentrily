'use client';

import { ReactNode } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import posthog from 'posthog-js';

interface PlanGateProps {
    feature: string;
    requiredPlan: string;
    children: ReactNode;
}

export default function PlanGate({ feature, requiredPlan, children }: PlanGateProps) {
    const { canUse, role, loading } = usePlan();
    const blocked = !loading && !canUse(feature);

    useEffect(() => {
        if (loading || !blocked) return;
        posthog.capture('feature_gate_hit', {
            feature,
            requiredPlan,
            role,
        });
    }, [blocked, feature, requiredPlan, role, loading]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse">
                <div className="h-4 w-32 bg-slate-100 rounded mb-4" />
                <div className="h-3 w-full bg-slate-100 rounded mb-2" />
                <div className="h-3 w-4/5 bg-slate-100 rounded mb-5" />
                <div className="h-9 w-28 bg-slate-100 rounded" />
            </div>
        );
    }

    if (!blocked) {
        return <>{children}</>;
    }

    const billingPath =
        role === 'TEACHER' || role === 'ADMIN'
            ? '/dashboard/creator/billing'
            : role === 'SUPER_ADMIN'
                ? '/dashboard/super-admin'
                : '/pricing';

    return (
        <div className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="opacity-40 pointer-events-none">{children}</div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <div className="text-center px-6 py-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="mx-auto mb-2 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                        <Lock size={16} className="text-slate-600" />
                    </div>
                    <p className="text-sm font-black text-slate-800">Available on {requiredPlan}</p>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                        Unlock this feature by upgrading your plan.
                    </p>
                    <Link
                        href={billingPath}
                        onClick={() => {
                            posthog.capture('plan_upgrade_clicked', {
                                source: 'plan_gate',
                                feature,
                                requiredPlan,
                                role,
                            });
                        }}
                        className="mt-3 inline-flex items-center justify-center rounded-lg bg-[var(--brand)] px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--brand-dark)]"
                    >
                        Upgrade Now
                    </Link>
                </div>
            </div>
        </div>
    );
}
