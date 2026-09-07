'use client';

import { useMemo } from 'react';
import { useSession } from '@/hooks/useSession';

const DEFAULT_LIMITS = {
    students: 50,
    courses: 2,
    examsPerMonth: 2,
    storageMb: 500,
    adminSeats: 0,
    teacherSeats: 0,
    seats: 1,
    allowedQuestionTypes: ['mcq', 'multiselect', 'reading'],
};

const DEFAULT_USAGE = {
    students: 0,
    courses: 0,
    storageMb: 0,
    seats: 0,
    adminSeats: 0,
    teacherSeats: 0,
    monthlyExams: 0,
};

const PLAN_RANK: Record<string, number> = {
    FREE: 0,
    STARTER: 1,
    PRO: 2,
    ENTERPRISE: 3,
};

const FEATURE_MIN_PLAN: Record<string, string> = {
    coding: 'STARTER',
    webEditor: 'STARTER',
    proctoring: 'STARTER',
    impersonation: 'STARTER',
    certificates: 'STARTER',
    pythonNotebook: 'PRO',
    aiExams: 'PRO',
    bulkImport: 'PRO',
    advancedAnalytics: 'PRO',
    tabSwitch: 'PRO',
    ipTracking: 'PRO',
    apiAccess: 'PRO',
    whiteLabel: 'ENTERPRISE',
    customDomain: 'ENTERPRISE',
    subdomain: 'ENTERPRISE',
    customSlug: 'ENTERPRISE',
};

function readHintRole(): 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN' | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const hintedRole =
        document.querySelector('meta[name="bc-session-role"]')?.getAttribute('content')?.trim().toUpperCase() || '';

    if (
        hintedRole === 'STUDENT' ||
        hintedRole === 'TEACHER' ||
        hintedRole === 'ADMIN' ||
        hintedRole === 'SUPER_ADMIN'
    ) {
        return hintedRole;
    }

    return null;
}

export function usePlan() {
    const { data: user, isLoading: loading } = useSession();
    const hintedRole = readHintRole();

    const plan = (user?.plan || 'FREE') as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    const role = (user?.role || hintedRole || 'TEACHER') as 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
    const effectiveFeatures = user?.effectiveFeatures || user?.features || {};
    const limits = user?.limits || DEFAULT_LIMITS;
    const usage = user?.usage || DEFAULT_USAGE;

    const percentByKey = useMemo(() => {
        const usageRecord = usage as Record<string, number>;
        const entries = Object.entries(limits).map(([key, limit]) => {
            const numericLimit = Number(limit);
            const used = Number(usageRecord[key] ?? 0);

            if (!Number.isFinite(numericLimit) || numericLimit <= 0) return [key, 0];
            return [key, Math.min(100, Math.round((used / numericLimit) * 100))];
        });

        return Object.fromEntries(entries) as Record<string, number>;
    }, [limits, usage]);

    const canUse = (feature: string) => {
        if (loading) return false;
        const featuresRecord = effectiveFeatures as Record<string, unknown>;
        if (featuresRecord?.[feature] === true) return true;

        const requiredPlan = FEATURE_MIN_PLAN[feature];
        if (!requiredPlan) return false;

        return Number(PLAN_RANK[plan] ?? 0) >= Number(PLAN_RANK[requiredPlan] ?? Infinity);
    };

    const requiresOrg = (feature: string) => {
        const orgOnlyFeatures = new Set(['whiteLabel', 'customDomain', 'subdomain']);
        return orgOnlyFeatures.has(feature);
    };

    return {
        loading,
        role,
        plan,
        effectiveFeatures,
        limits,
        usage,
        usagePercent: percentByKey,
        canUse,
        requiresOrg,
    };
}
