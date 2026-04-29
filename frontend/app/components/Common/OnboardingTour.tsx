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
}: {
    tourId: string;
    steps: OnboardingTourStep[];
    delayMs?: number;
}) {
    const { data: session, refetch } = useSession();
    const storageKey = useMemo(() => `tour_${tourId}_completed`, [tourId]);
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
                border-radius: 24px !important;
                border: 1px solid rgba(148, 163, 184, 0.18) !important;
                box-shadow: 0 28px 90px rgba(15, 23, 42, 0.24) !important;
                background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98)) !important;
                color: #0f172a !important;
                padding: 12px !important;
                max-width: 360px !important;
            }
            .driver-popover-title {
                font-size: 15px !important;
                font-weight: 900 !important;
                letter-spacing: -0.02em !important;
                margin-bottom: 8px !important;
            }
            .driver-popover-description {
                font-size: 13px !important;
                line-height: 1.65 !important;
                color: #475569 !important;
            }
            .driver-popover-progress-text {
                color: #64748b !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.14em !important;
                font-size: 10px !important;
            }
            .driver-popover-footer button {
                border-radius: 999px !important;
                border: 0 !important;
                font-weight: 800 !important;
                box-shadow: none !important;
                padding: 10px 16px !important;
            }
            .driver-popover-next-btn,
            .driver-popover-done-btn {
                background: var(--brand) !important;
                color: white !important;
                text-shadow: none !important;
            }
            .driver-popover-prev-btn,
            .driver-popover-close-btn {
                background: #e2e8f0 !important;
                color: #0f172a !important;
                text-shadow: none !important;
            }
            .driver-overlay {
                background: rgba(2, 6, 23, 0.46) !important;
                backdrop-filter: blur(2px);
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
        if (typeof window === 'undefined' || !steps.length || hasCompletedOnboarding) {
            return;
        }

        const completed = window.localStorage.getItem(storageKey);
        if (completed === 'true') {
            return;
        }

        const currentActiveTour = window.sessionStorage.getItem(activeKey);
        if (currentActiveTour) {
            return;
        }

        window.sessionStorage.setItem(activeKey, tourId);
        const timeout = window.setTimeout(() => {
            const availableSteps = steps.filter((step) => document.querySelector(step.element));
            if (availableSteps.length !== steps.length || availableSteps.length === 0) {
                if (!startedRef.current && window.sessionStorage.getItem(activeKey) === tourId) {
                    window.sessionStorage.removeItem(activeKey);
                }
                return;
            }

            startedRef.current = true;
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
                doneBtnText: 'Finish',
                nextBtnText: 'Next',
                prevBtnText: 'Back',
                onDestroyed: async () => {
                    if (window.sessionStorage.getItem(activeKey) === tourId) {
                        window.sessionStorage.removeItem(activeKey);
                    }
                    window.localStorage.setItem(storageKey, 'true');
                    if (completionInFlightRef.current || hasCompletedOnboarding) {
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
    }, [activeKey, delayMs, hasCompletedOnboarding, refetch, steps, storageKey, tourId]);

    return null;
}
