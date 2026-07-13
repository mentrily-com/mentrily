'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { AuthService } from '@/services/api/AuthService';
import { createGuide, type GuideStep } from './hints/guide';

export type OnboardingTourStep = GuideStep & { element: string };

export default function OnboardingTour({
    tourId,
    steps,
    delayMs = 400,
    ignoreUserOnboardingFlag = false,
    repeatUntilSkipped = false,
    skipStorageKey,
}: {
    tourId: string;
    steps: OnboardingTourStep[];
    delayMs?: number;
    ignoreUserOnboardingFlag?: boolean;
    repeatUntilSkipped?: boolean;
    skipStorageKey?: string;
}) {
    const { data: session, isLoading, isPlaceholderData, refetch } = useSession();
    const storageKey = useMemo(() => `tour_${tourId}_completed`, [tourId]);
    const sessionSeenKey = useMemo(() => `tour_${tourId}_seen_this_session`, [tourId]);
    const resolvedSkipStorageKey = useMemo(
        () => skipStorageKey || `tour_${tourId}_skipped`,
        [skipStorageKey, tourId],
    );
    const activeKey = 'mentrily_active_tour';
    const startedRef = useRef(false);
    const completionInFlightRef = useRef(false);

    // `steps` is passed as a fresh array/object literal by every call site on
    // every render. Depending on it directly below would restart this effect
    // (and its delayMs startup timer) on every parent re-render, which can
    // perpetually postpone the tour on pages that re-render more than once
    // within the delay window. A ref carries the latest steps into the
    // timeout without being part of the dependency array; only the step
    // *count* — a stable primitive — is a legitimate reason to re-run.
    const stepsRef = useRef(steps);
    stepsRef.current = steps;
    const stepsLength = steps.length;

    const hasCompletedOnboarding = Boolean((session as any)?.hasCompletedOnboarding);

    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            !stepsLength ||
            isLoading ||
            isPlaceholderData ||
            (!ignoreUserOnboardingFlag && hasCompletedOnboarding)
        ) {
            return;
        }

        const shouldStayHidden = repeatUntilSkipped
            ? window.localStorage.getItem(resolvedSkipStorageKey) === 'true'
            : window.localStorage.getItem(storageKey) === 'true';
        if (shouldStayHidden) {
            return;
        }

        if (repeatUntilSkipped && window.sessionStorage.getItem(sessionSeenKey) === 'true') {
            return;
        }

        const currentActiveTour = window.sessionStorage.getItem(activeKey);
        if (currentActiveTour) {
            return;
        }

        window.sessionStorage.setItem(activeKey, tourId);
        const timeout = window.setTimeout(() => {
            const availableSteps = stepsRef.current.filter((step) => document.querySelector(step.element));
            if (availableSteps.length === 0) {
                if (!startedRef.current && window.sessionStorage.getItem(activeKey) === tourId) {
                    window.sessionStorage.removeItem(activeKey);
                }
                return;
            }

            startedRef.current = true;
            if (repeatUntilSkipped) {
                window.sessionStorage.setItem(sessionSeenKey, 'true');
            }
            if (!repeatUntilSkipped) {
                window.localStorage.setItem(storageKey, 'true');
            }

            const tour = createGuide(availableSteps, {
                doneLabel: 'Finish tour',
                nextLabel: 'Next step',
                prevLabel: 'Back',
                onSkip: () => {
                    window.localStorage.setItem(resolvedSkipStorageKey, 'true');
                },
                onDismissed: async () => {
                    if (window.sessionStorage.getItem(activeKey) === tourId) {
                        window.sessionStorage.removeItem(activeKey);
                    }
                    if (
                        repeatUntilSkipped ||
                        ignoreUserOnboardingFlag ||
                        completionInFlightRef.current ||
                        hasCompletedOnboarding
                    ) {
                        return;
                    }
                    completionInFlightRef.current = true;
                    try {
                        await AuthService.completeOnboarding();
                        await refetch();
                    } catch (error) {
                        console.error('Failed to persist onboarding completion', error);
                    } finally {
                        completionInFlightRef.current = false;
                    }
                },
            });

            tour.drive();
        }, delayMs);

        return () => {
            window.clearTimeout(timeout);
            if (!startedRef.current && window.sessionStorage.getItem(activeKey) === tourId) {
                window.sessionStorage.removeItem(activeKey);
            }
        };
    }, [
        activeKey,
        delayMs,
        hasCompletedOnboarding,
        ignoreUserOnboardingFlag,
        isLoading,
        isPlaceholderData,
        refetch,
        repeatUntilSkipped,
        resolvedSkipStorageKey,
        sessionSeenKey,
        stepsLength,
        storageKey,
        tourId,
    ]);

    return null;
}
