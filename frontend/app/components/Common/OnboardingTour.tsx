'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { AuthService } from '@/services/api/AuthService';
import { createGuide, type GuideStep } from './hints/guide';

export type OnboardingTourStep = GuideStep & { element: string };

// localStorage key used to fast-path suppress the tour on next page load
// without waiting for the session fetch to return hasCompletedOnboarding.
// Written as soon as the backend confirms completion; read synchronously on
// mount so there is zero flash between placeholder and real session data.
const GLOBAL_ONBOARDING_COMPLETED_KEY = 'mentrily_onboarding_completed_v1';

function markOnboardingCompleted(userId?: string) {
    if (typeof window === 'undefined') return;
    const key = userId ? `${GLOBAL_ONBOARDING_COMPLETED_KEY}_${userId}` : GLOBAL_ONBOARDING_COMPLETED_KEY;
    window.localStorage.setItem(key, 'true');
}

function isOnboardingCompletedCached(userId?: string) {
    if (typeof window === 'undefined') return false;
    const key = userId ? `${GLOBAL_ONBOARDING_COMPLETED_KEY}_${userId}` : GLOBAL_ONBOARDING_COMPLETED_KEY;
    return window.localStorage.getItem(key) === 'true';
}

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
    /** @deprecated No longer skips the backend flag gate — kept for API compat. */
    ignoreUserOnboardingFlag?: boolean;
    repeatUntilSkipped?: boolean;
    skipStorageKey?: string;
}) {
    const { data: session, isLoading, isPlaceholderData, refetch } = useSession();
    const storageKey = useMemo(() => `tour_${tourId}_completed`, [tourId]);
    const sessionSeenKey = useMemo(() => `tour_${tourId}_seen_this_session`, [tourId]);
    const resolvedSkipStorageKey = useMemo(() => skipStorageKey || `tour_${tourId}_skipped`, [skipStorageKey, tourId]);
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
    const userId = (session as any)?.id;

    // Sync the localStorage fast-path cache as soon as the real session
    // confirms completion — so the NEXT page load suppresses the tour
    // immediately without waiting for the session fetch.
    useEffect(() => {
        if (!isPlaceholderData && hasCompletedOnboarding) {
            markOnboardingCompleted(userId);
        }
    }, [hasCompletedOnboarding, isPlaceholderData, userId]);

    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            !stepsLength ||
            isLoading ||
            // Wait for the REAL session — placeholder data may carry a stale
            // hasCompletedOnboarding=false from the localStorage snapshot even
            // when the server would return true, causing a spurious tour flash.
            isPlaceholderData
        ) {
            return;
        }

        // PRIMARY GATE: backend flag (cross-device, cross-browser, permanent).
        // If the real session says the user already completed onboarding, or
        // our localStorage cache says so (set the moment the backend confirmed
        // it), suppress every tour unconditionally — ignoreUserOnboardingFlag
        // no longer bypasses this because it caused tours to fire repeatedly
        // on every login across devices/incognito/hard-refresh.
        if (hasCompletedOnboarding || isOnboardingCompletedCached(userId)) {
            // Keep per-tour localStorage in sync so the secondary gate also
            // suppresses without relying on a live session fetch.
            if (!repeatUntilSkipped) {
                window.localStorage.setItem(storageKey, 'true');
            }
            return;
        }

        // SECONDARY GATE: per-tour localStorage flag (fast path for within the
        // same browser — set as soon as the tour starts so it's never shown
        // twice in one browser even before the backend call completes).
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
                    if (repeatUntilSkipped || completionInFlightRef.current || hasCompletedOnboarding) {
                        return;
                    }
                    completionInFlightRef.current = true;
                    try {
                        await AuthService.completeOnboarding();
                        // Cache the completion immediately so subsequent page
                        // loads don't wait for a session fetch to suppress the tour.
                        markOnboardingCompleted(userId);
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
        userId,
    ]);

    return null;
}
