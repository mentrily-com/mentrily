'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthService } from '@/services/api/AuthService';

type PlanName = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

type PlanPayload = {
    plan: PlanName;
    limits?: {
        students?: number;
        courses?: number;
        examsPerMonth?: number;
        modulesPerCourse?: number;
        examsPerCourse?: number;
        storageMb?: number;
        adminSeats?: number;
        teacherSeats?: number;
        seats?: number;
        allowedQuestionTypes?: string[];
    };
    features?: Record<string, boolean>;
};

type ComparisonRow = {
    category: string;
    key: string;
    fallback?: string[];
    limits?: boolean;
    limitKey?: keyof NonNullable<PlanPayload['limits']>;
};

const PRICE_BOOK: Record<PlanName, { monthly: string; annual: string; subtitle: string }> = {
    FREE: { monthly: '$0', annual: '$0', subtitle: 'Personal teacher account' },
    STARTER: { monthly: '$39', annual: '$390', subtitle: 'Small teaching teams' },
    PRO: { monthly: '$119', annual: '$1,190', subtitle: 'Growing academies' },
    ENTERPRISE: { monthly: 'Custom', annual: 'Custom', subtitle: 'Branding, domains, and institution controls' },
};

const PLAN_ORDER: PlanName[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

function formatLimit(value?: number, suffix = '') {
    if (value === undefined || value === null) return '-';
    if (value < 0) return 'Unlimited';
    return `${value}${suffix}`;
}

function storageLabel(storageMb?: number) {
    if (storageMb === undefined || storageMb === null) return '-';
    if (storageMb < 0) return 'Unlimited';
    if (storageMb >= 1024) return `${Math.round(storageMb / 1024)} GB`;
    return `${storageMb} MB`;
}

function questionTypeLabel(types?: string[]) {
    if (!types || types.length === 0) return '-';
    if (types.includes('*')) return 'All question types';
    return types
        .map((type) => {
            const normalized = type.toLowerCase();
            if (normalized === 'mcq') return 'MCQ';
            if (normalized === 'multiselect') return 'Multi-select';
            if (normalized === 'reading') return 'Reading';
            return normalized;
        })
        .join(', ');
}

export default function PricingClient({ plans }: { plans: PlanPayload[] }) {
    const [annual, setAnnual] = useState(false);
    const [canOpenCreatorBilling, setCanOpenCreatorBilling] = useState(false);

    useEffect(() => {
        let mounted = true;

        const loadSession = async () => {
            const session = await AuthService.checkSession();
            if (!mounted) return;
            setCanOpenCreatorBilling(Boolean(session?.role === 'ADMIN' || session?.role === 'TEACHER'));
        };

        void loadSession();

        return () => {
            mounted = false;
        };
    }, []);

    const normalizedPlans = useMemo(() => {
        const map = new Map(plans.map((plan) => [plan.plan, plan]));
        return PLAN_ORDER.map((name) => map.get(name) || { plan: name });
    }, [plans]);

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100">
            <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-white tracking-tight">Simple pricing for every stage</h1>
                    <p className="text-slate-400 font-bold mt-3">Start free, scale as your academy grows.</p>
                    <p className="text-slate-500 text-sm mt-2">
                        Free is personal. Starter and Pro are org-backed. Branding and custom domains are Enterprise
                        only.
                    </p>
                </div>

                <div className="flex justify-center mt-8">
                    <div className="flex items-center bg-[#1e293b] rounded-xl p-1 border border-slate-700">
                        <button
                            onClick={() => setAnnual(false)}
                            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                !annual ? 'bg-[#008D98] text-white' : 'text-slate-400'
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setAnnual(true)}
                            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                annual ? 'bg-[#008D98] text-white' : 'text-slate-400'
                            }`}
                        >
                            Annual <span className="text-emerald-400">Save 17%</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-10">
                    {normalizedPlans.map((plan) => {
                        const isPro = plan.plan === 'PRO';
                        const isFree = plan.plan === 'FREE';
                        const isEnterprise = plan.plan === 'ENTERPRISE';
                        const ctaHref = isFree
                            ? '/signup'
                            : isEnterprise
                              ? '/contact'
                              : canOpenCreatorBilling
                                ? '/dashboard/creator/billing'
                                : '/signup';

                        const ctaLabel = isFree
                            ? 'Get Started Free'
                            : isEnterprise
                              ? 'Contact Sales'
                              : `Upgrade to ${plan.plan === 'STARTER' ? 'Starter' : 'Pro'}`;

                        const price = annual ? PRICE_BOOK[plan.plan].annual : PRICE_BOOK[plan.plan].monthly;

                        return (
                            <div
                                key={plan.plan}
                                className={`rounded-3xl border p-6 relative ${
                                    isPro
                                        ? 'border-[#008D98] bg-gradient-to-b from-[#1e293b] to-[#172554]'
                                        : 'border-slate-700 bg-[#1e293b]'
                                }`}
                            >
                                {isPro && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#008D98] text-white text-[10px] font-black uppercase tracking-widest">
                                        Most Popular
                                    </span>
                                )}
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    {plan.plan}
                                </p>
                                <h3 className="mt-3 text-4xl font-black text-white">
                                    {price}
                                    {!isEnterprise && (
                                        <span className="text-sm text-slate-400 font-bold">
                                            /{annual ? 'yr' : 'mo'}
                                        </span>
                                    )}
                                </h3>
                                <p className="mt-2 text-xs font-bold text-slate-400">
                                    {PRICE_BOOK[plan.plan].subtitle}
                                </p>

                                <ul className="mt-6 space-y-2 text-xs font-bold text-slate-300">
                                    <li>Students: {formatLimit(plan.limits?.students)}</li>
                                    <li>Courses: {formatLimit(plan.limits?.courses)}</li>
                                    <li>Monthly exams: {formatLimit(plan.limits?.examsPerMonth)}</li>
                                    <li>Storage: {storageLabel(plan.limits?.storageMb)}</li>
                                    <li>Admin seats: {formatLimit(plan.limits?.adminSeats)}</li>
                                    <li>Teacher seats: {formatLimit(plan.limits?.teacherSeats)}</li>
                                    <li>Question types: {questionTypeLabel(plan.limits?.allowedQuestionTypes)}</li>
                                </ul>

                                <Link
                                    href={ctaHref}
                                    className={`mt-6 w-full py-3 rounded-xl inline-flex justify-center text-[10px] font-black uppercase tracking-widest transition-all ${
                                        isPro
                                            ? 'bg-[#008D98] hover:bg-[#006F78] text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-white'
                                    }`}
                                >
                                    {ctaLabel}
                                </Link>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-14 bg-[#1e293b] border border-slate-700 rounded-3xl p-6">
                    <h2 className="text-lg font-black text-white mb-4">Feature comparison</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Category
                                    </th>
                                    {PLAN_ORDER.map((plan) => (
                                        <th
                                            key={plan}
                                            className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"
                                        >
                                            {plan}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-xs font-bold text-slate-200">
                                {(
                                    [
                                        {
                                            category: 'Content',
                                            key: 'coding',
                                            fallback: [
                                                'MCQ + Multi-select + Reading',
                                                'All question types',
                                                'All question types',
                                                'All content types',
                                            ],
                                        },
                                        {
                                            category: 'Students',
                                            key: 'students',
                                            limits: true,
                                            limitKey: 'students',
                                        },
                                        {
                                            category: 'Monthly exams',
                                            key: 'examsPerMonth',
                                            limitKey: 'examsPerMonth',
                                        },
                                        {
                                            category: 'Exams',
                                            key: 'proctoring',
                                            fallback: [
                                                'Basic timed exams',
                                                'Proctoring enabled',
                                                'Advanced proctoring',
                                                'Advanced proctoring',
                                            ],
                                        },
                                        {
                                            category: 'Branding',
                                            key: 'whiteLabel',
                                            fallback: [
                                                'Mentrily branding',
                                                'Mentrily branding',
                                                'Mentrily branding',
                                                'Full white-label',
                                            ],
                                        },
                                        {
                                            category: 'Analytics',
                                            key: 'advancedAnalytics',
                                            fallback: ['Basic', 'Basic', 'Advanced', 'Advanced'],
                                        },
                                    ] as ComparisonRow[]
                                ).map((row) => (
                                    <tr key={row.category} className="border-b border-slate-800">
                                        <td className="py-3 text-slate-300">{row.category}</td>
                                        {normalizedPlans.map((plan, index) => {
                                            if (row.limits || row.limitKey) {
                                                const limitField = row.limitKey || 'students';
                                                return (
                                                    <td key={plan.plan} className="py-3 text-slate-200">
                                                        {formatLimit(plan.limits?.[limitField] as number | undefined)}
                                                    </td>
                                                );
                                            }

                                            const featureValue = (plan.features || {})[row.key];
                                            if (typeof featureValue === 'boolean') {
                                                return (
                                                    <td key={plan.plan} className="py-3">
                                                        {featureValue ? '✓' : '—'}
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={plan.plan} className="py-3 text-slate-300">
                                                    {row.fallback?.[index] || '-'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
