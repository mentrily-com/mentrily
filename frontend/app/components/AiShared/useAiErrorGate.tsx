'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import UpgradeModal from '@/app/components/Common/UpgradeModal';
import { useToast } from '@/app/components/Common/Toast';
import { useSession } from '@/hooks/useSession';
import { usePlan } from '@/hooks/usePlan';
import { describeAiError } from '@/lib/ai/errors';

/**
 * One place that turns AI errors into the app's existing upgrade flow:
 * plan and quota errors open the UpgradeModal (or tell invited teachers
 * their admin manages billing), everything else becomes a toast.
 */
export function useAiErrorGate() {
    const router = useRouter();
    const { error: toastError } = useToast();
    const { session } = useSession();
    const { role } = usePlan();
    const [upgrade, setUpgrade] = useState<{ title: string; message: string } | null>(null);

    const selfBilling = (session?.features as Record<string, unknown> | undefined)?.teacherSelfBilling !== false;
    const canUpgrade = role !== 'TEACHER' || selfBilling;

    const handleError = useCallback(
        (err: unknown) => {
            const view = describeAiError(err);
            if (view.upgrade) {
                if (!canUpgrade) {
                    toastError(`${view.message.replace(/ Upgrade your plan for more\.$/, '')} Ask your admin to upgrade the plan.`, view.title);
                    return;
                }
                setUpgrade({ title: view.title, message: view.message });
                return;
            }
            toastError(view.message, view.title);
        },
        [canUpgrade, toastError],
    );

    /** For plan-locked controls: same upgrade path as a server-side plan error. */
    const promptUpgrade = useCallback(
        (message: string, title = 'Upgrade required') => {
            if (!canUpgrade) {
                toastError(`${message} Ask your admin to upgrade the plan.`, title);
                return;
            }
            setUpgrade({ title, message });
        },
        [canUpgrade, toastError],
    );

    const modal = (
        <UpgradeModal
            isOpen={Boolean(upgrade)}
            title={upgrade?.title}
            message={upgrade?.message ?? ''}
            onClose={() => setUpgrade(null)}
            onUpgrade={() => {
                setUpgrade(null);
                router.push('/dashboard/creator/billing');
            }}
        />
    );

    return { handleError, promptUpgrade, modal };
}
