'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import QuotaBar from '@/app/components/Common/QuotaBar';
import UpgradeRequestModal from '@/app/components/Common/UpgradeRequestModal';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { BillingService } from '@/services/api/BillingService';
import { useToast } from '@/app/components/Common/Toast';
import { AuthService } from '@/services/api/AuthService';
import posthog from 'posthog-js';

type BillingUsage = {
    plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    usage: {
        students: number;
        courses: number;
        storageMb: number;
        seats: number;
        adminSeats?: number;
        teacherSeats?: number;
        monthlyExams?: number;
    };
    limits: {
        students: number;
        courses: number;
        storageMb: number;
        seats: number;
        examsPerMonth?: number;
        adminSeats?: number;
        teacherSeats?: number;
        allowedQuestionTypes?: string[];
    };
    billing: {
        planExpiresAt?: string | null;
        billingEmail?: string | null;
    };
};

type PlansResponse = {
    plans: Array<{
        plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
        limits: {
            students: number;
            courses: number;
            storageMb: number;
            seats: number;
            examsPerMonth?: number;
            adminSeats?: number;
            teacherSeats?: number;
            allowedQuestionTypes?: string[];
        };
        prices: { primary: string | null; all: string[] };
    }>;
};

const PRICE_LABELS: Record<'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE', { monthly: string; annual: string }> = {
    FREE: { monthly: '$0/mo', annual: '$0/yr' },
    STARTER: { monthly: '$39/mo', annual: '$390/yr' },
    PRO: { monthly: '$119/mo', annual: '$1,190/yr' },
    ENTERPRISE: { monthly: 'Custom', annual: 'Custom' },
};

function normalizePriceId(ids: string[], interval: 'monthly' | 'annual') {
    if (!ids || ids.length === 0) return null;

    if (interval === 'annual') {
        const annual = ids.find((id) => /annual|year/i.test(id));
        if (annual) return annual;
    }

    if (interval === 'monthly') {
        const monthly = ids.find((id) => /month|monthly/i.test(id));
        if (monthly) return monthly;
    }

    return ids[0];
}

function formatLimit(value?: number) {
    if (typeof value !== 'number') return 'N/A';
    return value < 0 ? 'Unlimited' : String(value);
}

function formatQuestionTypes(types?: string[]) {
    if (!types || types.length === 0) return 'Not specified';
    if (types.includes('*')) return 'All question types';
    return types.join(', ');
}

export default function TeacherBillingPage() {
    const { isAuthorized, isReady } = useRoleGuard(['TEACHER']);
    const { success, error } = useToast();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
    const [usageData, setUsageData] = useState<BillingUsage | null>(null);
    const [plansData, setPlansData] = useState<PlansResponse['plans']>([]);
    const [selfBillingEnabled, setSelfBillingEnabled] = useState(true);
    const [isOrgBilling, setIsOrgBilling] = useState(false);
    const [upgradeRequestPlan, setUpgradeRequestPlan] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthorized) return;

        let mounted = true;

        const load = async () => {
            setLoading(true);
            try {
                const session = await AuthService.checkSession();
                const hasOrganization = Boolean(String(session?.orgId || '').trim());
                // Owning your personal org (become-creator / solo signup) is NOT
                // "org billing managed by an admin" — only a Teacher invited into
                // someone else's org is. isOrgOwner comes from /auth/me.
                const ownsActiveOrg = (session as Record<string, unknown> | null)?.isOrgOwner === true;
                const teacherBillingAllowed = session?.features?.teacherSelfBilling !== false;
                setIsOrgBilling(hasOrganization && !ownsActiveOrg);

                if (!teacherBillingAllowed && !hasOrganization) {
                    if (mounted) {
                        setSelfBillingEnabled(false);
                        setLoading(false);
                    }
                    return;
                }

                const successParam = searchParams.get('success');
                const checkoutParam = searchParams.get('checkout');
                const hasSuccess = successParam === 'true' || checkoutParam === 'success';
                const sessionId = String(searchParams.get('session_id') || '').trim();

                if (hasSuccess && sessionId) {
                    await BillingService.syncCheckoutSession(sessionId);
                    AuthService.resetSessionCache();
                    const refreshedSession = await AuthService.checkSession(true);
                    if (refreshedSession?.role === 'ADMIN' && typeof window !== 'undefined') {
                        window.localStorage.setItem('user-role', 'admin');
                    }
                }

                const [usage, plans] = await Promise.all([BillingService.getUsage(), BillingService.getPlans()]);

                if (!mounted) return;

                setSelfBillingEnabled(teacherBillingAllowed || hasOrganization);
                setUsageData(usage as BillingUsage);
                setPlansData((plans as PlansResponse).plans || []);
            } catch (err: any) {
                if (!mounted) return;
                error(err?.message || 'Failed to load billing data', 'Billing Error');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        void load();

        return () => {
            mounted = false;
        };
    }, [isAuthorized, searchParams]);

    useEffect(() => {
        if (!isAuthorized) return;

        const successParam = searchParams.get('success');
        const checkoutParam = searchParams.get('checkout');
        const cancelled = searchParams.get('cancelled');

        const hasSuccess = successParam === 'true' || checkoutParam === 'success';
        const hasCancelled = cancelled === 'true' || checkoutParam === 'cancelled';

        if (hasSuccess) {
            success('Subscription updated successfully. Syncing latest plan...', 'Billing Updated');
        }

        if (hasCancelled) {
            error('Checkout was cancelled.', 'No Changes Made');
        }

        if (hasSuccess || hasCancelled) {
            const url = new URL(window.location.href);
            url.searchParams.delete('success');
            url.searchParams.delete('cancelled');
            url.searchParams.delete('checkout');
            url.searchParams.delete('session_id');
            window.history.replaceState({}, '', url.toString());
        }
    }, [searchParams, isAuthorized]);

    const currentPlan = usageData?.plan || 'FREE';
    const canManageBilling = !isOrgBilling;

    const sortedPlans = useMemo(() => {
        const order = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
        return [...plansData].sort((a, b) => order.indexOf(a.plan) - order.indexOf(b.plan));
    }, [plansData]);

    const handlePortal = async () => {
        try {
            posthog.capture('billing_portal_opened', { source: 'creator_billing_teacher' });
            setBusyAction('portal');
            const result = await BillingService.createPortalSession({
                returnUrl: `${window.location.origin}/dashboard/creator/billing`,
            });

            if (result?.url) {
                window.location.href = result.url;
            }
        } catch (err: any) {
            error(err?.message || 'Unable to open billing portal', 'Billing Portal Error');
        } finally {
            setBusyAction(null);
        }
    };

    // BETA: self-serve Stripe checkout is disabled — clicking Upgrade opens
    // the request-access modal instead of redirecting to Stripe. Restore
    // the commented block below (and re-enable createCheckoutSession in
    // billing.service.ts) to bring back live checkout.
    const handleUpgrade = async (plan: string, _ids: string[]) => {
        if (plan === 'FREE') return;
        if (plan === 'ENTERPRISE') {
            window.location.href = '/contact';
            return;
        }

        posthog.capture('plan_upgrade_requested', {
            source: 'creator_billing_teacher',
            targetPlan: plan,
            interval: billingInterval,
        });
        setUpgradeRequestPlan(plan);
    };

    /* Original Stripe checkout trigger — restore verbatim to re-enable:
    const handleUpgrade = async (plan: string, ids: string[]) => {
        if (plan === 'FREE') return;
        if (plan === 'ENTERPRISE') {
            window.location.href = '/contact';
            return;
        }

        try {
            const priceId = normalizePriceId(ids, billingInterval);
            if (!priceId) {
                throw new Error('No Stripe price configured for this plan');
            }

            setBusyAction(plan);
            posthog.capture('plan_upgrade_clicked', {
                source: 'creator_billing_teacher',
                targetPlan: plan,
                interval: billingInterval,
            });
            const result = await BillingService.createCheckoutSession({
                priceId,
                successUrl: `${window.location.origin}/dashboard/creator/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${window.location.origin}/dashboard/creator/billing?cancelled=true`,
            });

            if (result?.url) {
                window.location.href = result.url;
            }
        } catch (err: any) {
            error(err?.message || 'Unable to start checkout session', 'Checkout Error');
        } finally {
            setBusyAction(null);
        }
    };
    */

    if (!isReady || loading) {
        return <DashboardSkeleton type="main" userRole="teacher" />;
    }

    if (!isAuthorized) {
        return <DashboardSkeleton type="main" userRole="teacher" />;
    }

    if (!selfBillingEnabled) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
                <main className="max-w-[1000px] mx-auto px-6 lg:px-12 py-12">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-10 text-center">
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Billing Managed by Admin</h1>
                        <p className="text-sm font-bold text-slate-500 mt-3">
                            Your organization admin manages billing for instructors. Please contact your admin to
                            request plan upgrades.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="animate-fade-in font-sans pb-10">

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                        {isOrgBilling ? 'Organization Billing' : 'Billing & Plans'}
                    </h1>
                    <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {isOrgBilling
                            ? 'View the plan and usage your organization admin manages for this workspace.'
                            : 'Manage subscription, usage, and upgrades for your organization.'}
                    </p>
                </div>

                {!isOrgBilling && (
                    <div className="flex items-center gap-1 rounded-lg p-1 self-start lg:self-auto border shadow-sm bg-white" style={{ borderColor: 'var(--color-border-subtle)' }}>
                        <button
                            onClick={() => setBillingInterval('monthly')}
                            className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${billingInterval === 'monthly' ? 'bg-[var(--color-bg-subtle)]' : 'hover:bg-[var(--color-bg-muted)]'}`}
                            style={{ color: billingInterval === 'monthly' ? 'var(--brand)' : 'var(--color-text-secondary)' }}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingInterval('annual')}
                            className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${billingInterval === 'annual' ? 'bg-[var(--color-bg-subtle)]' : 'hover:bg-[var(--color-bg-muted)]'}`}
                            style={{ color: billingInterval === 'annual' ? 'var(--brand)' : 'var(--color-text-secondary)' }}
                        >
                            Annual
                        </button>
                    </div>
                )}
            </div>

            <section className="bg-white rounded-xl border shadow-sm p-6 md:p-8 mb-6" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                            Current Plan
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded border"
                                style={{ backgroundColor: 'var(--color-bg-blue-tint)', color: 'var(--brand)', borderColor: 'var(--color-border-brand)' }}>
                                {currentPlan}
                            </span>
                            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                {PRICE_LABELS[currentPlan][billingInterval]}
                            </h2>
                        </div>
                        <p className="text-xs font-medium mt-3" style={{ color: 'var(--color-text-secondary)' }}>
                            Renewal:{' '}
                            {usageData?.billing?.planExpiresAt
                                ? new Date(usageData.billing.planExpiresAt).toLocaleDateString()
                                : 'Not scheduled'}
                        </p>
                        <p className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            Billing email: {usageData?.billing?.billingEmail || 'Not set'}
                        </p>
                    </div>

                    {canManageBilling ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            <button
                                onClick={() =>
                                    document.getElementById('plan-comparison')?.scrollIntoView({ behavior: 'smooth' })
                                }
                                className="px-5 py-2.5 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                                style={{ backgroundColor: 'white', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                    e.currentTarget.style.color = 'var(--color-text-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                                }}
                            >
                                Change Plan
                            </button>
                            <button
                                onClick={handlePortal}
                                disabled={busyAction === 'portal'}
                                className="px-5 py-2.5 rounded-lg text-white text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-60 cursor-pointer shadow-sm"
                                style={{ backgroundColor: 'var(--brand)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand-dark)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand)')}
                            >
                                {busyAction === 'portal' ? 'Opening...' : 'Manage Billing'}
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                            Billing changes are restricted to organization admins.
                        </div>
                    )}
                </div>

                {canManageBilling && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <button
                        onClick={handlePortal}
                        disabled={busyAction === 'portal'}
                        className="text-xs font-semibold uppercase tracking-wider hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                        style={{ color: 'var(--brand)' }}
                    >
                        {busyAction === 'portal' ? 'Opening invoices...' : 'View invoices'}
                    </button>
                </div>
                )}
            </section>

            <section className="bg-white rounded-xl border shadow-sm p-6 md:p-8 mb-6" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>Usage Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <QuotaBar
                        label="Courses"
                        used={Number(usageData?.usage?.courses || 0)}
                        limit={Number(usageData?.limits?.courses || 0)}
                    />
                    <QuotaBar
                        label="Storage (MB)"
                        used={Number(usageData?.usage?.storageMb || 0)}
                        limit={Number(usageData?.limits?.storageMb || 0)}
                    />
                    <QuotaBar
                        label="Seats"
                        used={Number(usageData?.usage?.seats || 0)}
                        limit={Number(usageData?.limits?.seats || 0)}
                    />
                    <QuotaBar
                        label="Monthly Exams"
                        used={Number(usageData?.usage?.monthlyExams || 0)}
                        limit={Number(usageData?.limits?.examsPerMonth || 0)}
                    />
                </div>
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Question Types</p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                        {formatQuestionTypes(usageData?.limits?.allowedQuestionTypes)}
                    </p>
                </div>
            </section>

            {!isOrgBilling && (
            <section id="plan-comparison" className="bg-white rounded-xl border shadow-sm p-6 md:p-8 mb-6" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>Plan Comparison</h3>
                {sortedPlans.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-500 text-center">
                        Plan data is temporarily unavailable. Please refresh this page.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {sortedPlans.map((plan) => {
                            const isCurrent = plan.plan === currentPlan;
                            const isEnterprise = plan.plan === 'ENTERPRISE';
                            const isUpgradeable =
                                ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'].indexOf(plan.plan) >
                                ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'].indexOf(currentPlan);

                            return (
                                <div
                                    key={plan.plan}
                                    className={`rounded-xl border p-5 transition-all ${isCurrent ? 'bg-[var(--color-bg-blue-tint)]' : 'bg-white hover:border-[var(--color-border-brand)] hover:shadow-md'}`}
                                    style={{ borderColor: isCurrent ? 'var(--brand)' : 'var(--color-border-subtle)' }}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                            {plan.plan}
                                        </p>
                                        {isCurrent && (
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: 'white', color: 'var(--brand)', border: '1px solid var(--color-border-brand)' }}>
                                                Current
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>
                                        {PRICE_LABELS[plan.plan][billingInterval]}
                                    </p>

                                    <ul className="mt-5 space-y-2.5 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                        <li className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                            <span>Students:</span>
                                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{plan.limits.students < 0 ? 'Unlimited' : plan.limits.students}</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                            <span>Courses:</span>
                                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{plan.limits.courses < 0 ? 'Unlimited' : plan.limits.courses}</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                            <span>Storage:</span>
                                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{plan.limits.storageMb < 0 ? 'Unlimited' : `${plan.limits.storageMb} MB`}</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                            <span>Seats:</span>
                                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatLimit(plan.limits.seats)}</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                            <span>Monthly exams:</span>
                                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatLimit(plan.limits.examsPerMonth)}</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                            <span>Admin seats:</span>
                                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatLimit(plan.limits.adminSeats)}</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                            <span>Teacher seats:</span>
                                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatLimit(plan.limits.teacherSeats)}</span>
                                        </li>
                                    </ul>

                                    <p className="mt-4 text-[11px] font-medium leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                        {formatQuestionTypes(plan.limits.allowedQuestionTypes)}
                                    </p>

                                    {isEnterprise ? (
                                        <button
                                            onClick={() => {
                                                posthog.capture('plan_upgrade_clicked', {
                                                    source: 'creator_billing_teacher',
                                                    targetPlan: 'ENTERPRISE',
                                                    interval: billingInterval,
                                                });
                                                window.location.href = '/contact';
                                            }}
                                            className="w-full mt-6 py-2.5 rounded-lg text-white text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                                            style={{ backgroundColor: 'var(--color-text-primary)' }}
                                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                        >
                                            Contact Sales
                                        </button>
                                    ) : isCurrent ? (
                                        <button
                                            disabled
                                            className="w-full mt-6 py-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider cursor-not-allowed border"
                                            style={{ backgroundColor: 'var(--color-bg-muted)', color: 'var(--color-text-muted)', borderColor: 'var(--color-border-subtle)' }}
                                        >
                                            Current Plan
                                        </button>
                                    ) : (
                                        <button
                                            disabled={!isUpgradeable || busyAction !== null}
                                            onClick={() => handleUpgrade(plan.plan, plan.prices.all)}
                                            className="w-full mt-6 py-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border shadow-sm"
                                            style={{
                                                backgroundColor: isUpgradeable ? 'white' : 'var(--color-bg-muted)',
                                                color: isUpgradeable ? 'var(--brand)' : 'var(--color-text-muted)',
                                                borderColor: isUpgradeable ? 'var(--color-border-brand)' : 'var(--color-border-subtle)',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isUpgradeable) return;
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-blue-tint)';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isUpgradeable) return;
                                                e.currentTarget.style.backgroundColor = 'white';
                                            }}
                                        >
                                            {`Request ${plan.plan}`}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
            )}

            <UpgradeRequestModal
                isOpen={Boolean(upgradeRequestPlan)}
                onClose={() => setUpgradeRequestPlan(null)}
                plan={upgradeRequestPlan}
                billingInterval={billingInterval}
                currentPlan={currentPlan}
            />
        </div>
    );
}
