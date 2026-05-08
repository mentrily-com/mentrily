'use client';

import { useEffect, useMemo, useRef } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useSession } from '@/hooks/useSession';
import { AuthService } from '@/services/api/AuthService';

export interface OnboardingTourStep {
    element: string;
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
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

    const hasCompletedOnboarding = Boolean((session as any)?.hasCompletedOnboarding);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const styleId = 'mentrily-driver-theme';
        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .driver-popover {
                border-radius: 22px !important;
                border: 1px solid rgba(226, 232, 240, 1) !important;
                box-shadow: 0 26px 80px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.9) inset !important;
                background: #ffffff !important;
                color: #0f172a !important;
                padding: 18px !important;
                max-width: 430px !important;
                opacity: 1 !important;
                filter: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                overflow: hidden !important;
            }
            .driver-popover::before {
                content: "";
                position: absolute;
                inset: 0 0 auto 0;
                height: 5px;
                background: linear-gradient(90deg, var(--brand), #0f172a 58%, #0891b2);
            }
            .mentrily-tour-kicker {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                margin: 3px 0 12px;
                border-radius: 999px;
                background: #fff7ed;
                color: var(--brand-dark);
                padding: 7px 10px;
                font-size: 10px;
                font-weight: 900;
                letter-spacing: 0.14em;
                text-transform: uppercase;
            }
            .mentrily-tour-kicker::before {
                content: "";
                width: 7px;
                height: 7px;
                border-radius: 999px;
                background: var(--brand);
                box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.16);
            }
            .driver-popover-title {
                font-size: 18px !important;
                line-height: 1.25 !important;
                font-weight: 900 !important;
                letter-spacing: -0.02em !important;
                margin-bottom: 10px !important;
                padding-right: 68px !important;
            }
            .driver-popover-description {
                font-size: 14px !important;
                line-height: 1.7 !important;
                color: #334155 !important;
                max-width: 58ch !important;
            }
            .driver-popover-progress-text {
                color: #475569 !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.14em !important;
                font-size: 11px !important;
                min-width: 44px !important;
            }
            .mentrily-tour-progress-track {
                position: relative;
                height: 6px;
                overflow: hidden;
                border-radius: 999px;
                background: #e2e8f0;
                margin: 18px 0 2px;
            }
            .mentrily-tour-progress-fill {
                height: 100%;
                width: var(--mentrily-tour-progress, 20%);
                border-radius: inherit;
                background: linear-gradient(90deg, var(--brand), #0891b2);
                transition: width 260ms ease;
            }
            .driver-popover-footer {
                align-items: center !important;
                margin-top: 14px !important;
            }
            .driver-popover-footer button {
                border-radius: 999px !important;
                border: 0 !important;
                font-weight: 800 !important;
                box-shadow: none !important;
                padding: 12px 18px !important;
            }
            .driver-popover-navigation-btns {
                display: flex !important;
                gap: 8px !important;
            }
            .driver-popover-next-btn,
            .driver-popover-done-btn {
                background: #0f172a !important;
                color: white !important;
                text-shadow: none !important;
                box-shadow: 0 10px 22px rgba(15, 23, 42, 0.18) !important;
            }
            .driver-popover-prev-btn,
            .driver-popover-close-btn {
                background: #e2e8f0 !important;
                color: #0f172a !important;
                text-shadow: none !important;
            }
            .driver-popover-close-btn {
                position: absolute !important;
                top: 18px !important;
                right: 18px !important;
                width: auto !important;
                height: auto !important;
                min-width: 58px !important;
                padding: 8px 11px !important;
                border-radius: 999px !important;
                font-size: 10px !important;
                font-weight: 900 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.12em !important;
                line-height: 1 !important;
            }
            .driver-overlay {
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            .driver-popover,
            .driver-popover * {
                filter: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            .driver-active-element,
            .driver-active-element * {
                filter: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            .driver-active-element {
                opacity: 1 !important;
                filter: none !important;
                transform: translateZ(0) !important;
                box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.92), 0 0 0 9px rgba(249, 115, 22, 0.56), 0 28px 80px rgba(15, 23, 42, 0.30) !important;
            }
            @media (max-width: 640px) {
                .driver-popover {
                    width: calc(100vw - 24px) !important;
                    max-width: calc(100vw - 24px) !important;
                    border-radius: 18px !important;
                    padding: 10px !important;
                }
                .driver-popover-footer {
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .driver-popover-footer button {
                    flex: 1 1 auto !important;
                    min-width: 96px !important;
                    padding: 10px 12px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }, []);

    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            !steps.length ||
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
            const availableSteps = steps.filter((step) => document.querySelector(step.element));
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

            const driveSteps: DriveStep[] = availableSteps.map((step) => ({
                element: step.element,
                popover: {
                    title: step.title,
                    description: step.description,
                    side: step.side,
                    align: step.align,
                },
            }));

            const tour = driver({
                showProgress: true,
                allowClose: true,
                overlayClickBehavior: 'nextStep',
                overlayColor: '#020617',
                overlayOpacity: 0.54,
                doneBtnText: 'Finish tour',
                nextBtnText: 'Next step',
                prevBtnText: 'Back',
                progressText: '{{current}} / {{total}}',
                stagePadding: 8,
                stageRadius: 24,
                onPopoverRender: (popover: any, options: any) => {
                    if (popover?.closeButton) {
                        popover.closeButton.textContent = 'Skip';
                        popover.closeButton.setAttribute('aria-label', 'Skip onboarding tour');
                    }
                    if (popover?.wrapper) {
                        const activeIndex = Number(options?.state?.activeIndex ?? 0);
                        const total = availableSteps.length || 1;
                        const percent = `${Math.round(((activeIndex + 1) / total) * 100)}%`;
                        popover.wrapper.style.setProperty('--mentrily-tour-progress', percent);

                        if (!popover.wrapper.querySelector('.mentrily-tour-kicker')) {
                            const kicker = document.createElement('div');
                            kicker.className = 'mentrily-tour-kicker';
                            kicker.textContent = 'Mentrily Guide';
                            popover.wrapper.insertBefore(kicker, popover.title);
                        }

                        if (!popover.wrapper.querySelector('.mentrily-tour-progress-track')) {
                            const track = document.createElement('div');
                            track.className = 'mentrily-tour-progress-track';
                            const fill = document.createElement('div');
                            fill.className = 'mentrily-tour-progress-fill';
                            track.appendChild(fill);
                            popover.footer.parentElement?.insertBefore(track, popover.footer);
                        }
                    }
                },
                onCloseClick: (_element: any, _step: any, options: any) => {
                    window.localStorage.setItem(resolvedSkipStorageKey, 'true');
                    options.driver.destroy();
                },
                onDestroyed: async () => {
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

            tour.setSteps(driveSteps);
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
        steps,
        storageKey,
        tourId,
    ]);

    return null;
}
