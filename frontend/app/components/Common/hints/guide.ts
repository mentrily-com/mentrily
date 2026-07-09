'use client';

import { driver, type Driver, type DriveStep, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';

export interface GuideStep {
    /** CSS selector to highlight. Omit for a centered "modal" step. */
    element?: string;
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
}

export interface GuideOptions {
    /** Small badge above the title. Defaults to "Mentrily Guide". */
    kicker?: string;
    nextLabel?: string;
    prevLabel?: string;
    doneLabel?: string;
    /** Called when the user clicks the Skip button. */
    onSkip?: () => void;
    /**
     * Called exactly once when the guide is torn down.
     * `finished` is true when the user reached and closed the final step.
     */
    onDismissed?: (finished: boolean) => void;
    overlayOpacity?: number;
    /** Extra config forwarded to driver.js (advanced use). */
    driverConfig?: Partial<Config>;
}

const THEME_STYLE_ID = 'mentrily-guide-theme';

/**
 * Injects the shared hint/guide theme once per document.
 * Safe to call repeatedly.
 */
export function ensureGuideTheme() {
    if (typeof document === 'undefined' || document.getElementById(THEME_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = THEME_STYLE_ID;
    style.textContent = `
        .driver-popover.mentrily-guide {
            border-radius: 20px;
            border: 1px solid rgba(226, 232, 240, 0.9);
            background: #ffffff;
            color: #0f172a;
            padding: 20px;
            max-width: 400px;
            overflow: hidden;
            box-shadow:
                0 1px 2px rgba(15, 23, 42, 0.06),
                0 12px 32px rgba(15, 23, 42, 0.14),
                0 32px 80px rgba(15, 23, 42, 0.16);
            /* Buttery movement when the popover jumps between steps */
            transition:
                left 320ms cubic-bezier(0.32, 0.72, 0, 1),
                top 320ms cubic-bezier(0.32, 0.72, 0, 1);
            animation: mentrily-guide-pop 360ms cubic-bezier(0.21, 1.02, 0.47, 1) both;
            will-change: left, top;
        }
        @keyframes mentrily-guide-pop {
            from { opacity: 0; transform: translateY(10px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .driver-popover.mentrily-guide::before {
            content: "";
            position: absolute;
            inset: 0 0 auto 0;
            height: 4px;
            background: linear-gradient(90deg, var(--brand), #0f172a 58%, #0891b2);
        }
        /* The arrow is clipped by overflow:hidden anyway and leaves edge
           artifacts against the rounded border — the glow ring on the target
           already communicates the connection, so hide it entirely. */
        .driver-popover.mentrily-guide .driver-popover-arrow {
            display: none;
        }
        .mentrily-guide .mentrily-guide-kicker {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            margin: 2px 0 12px;
            border-radius: 999px;
            background: var(--brand-lighter, #f8fafc);
            color: var(--brand-dark, #0f172a);
            padding: 6px 11px;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.14em;
            text-transform: uppercase;
        }
        .mentrily-guide .mentrily-guide-kicker::before {
            content: "";
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: var(--brand);
            box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 35%, transparent);
            animation: mentrily-guide-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes mentrily-guide-ping {
            0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 35%, transparent); }
            70%  { box-shadow: 0 0 0 7px transparent; }
            100% { box-shadow: 0 0 0 0 transparent; }
        }
        .mentrily-guide .driver-popover-title {
            font-size: 17px;
            line-height: 1.3;
            font-weight: 900;
            letter-spacing: -0.02em;
            margin-bottom: 8px;
            /* The kicker row already clears the Skip pill, so the title can
               span the full width without a lopsided right gap. */
            padding-right: 0;
        }
        .mentrily-guide .driver-popover-description {
            font-size: 13.5px;
            line-height: 1.65;
            color: #475569;
            font-weight: 500;
            max-width: 56ch;
        }
        /* Cross-fade title/description on step change */
        .mentrily-guide.mentrily-guide-step-anim .driver-popover-title,
        .mentrily-guide.mentrily-guide-step-anim .driver-popover-description {
            animation: mentrily-guide-swap 260ms ease both;
        }
        @keyframes mentrily-guide-swap {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .mentrily-guide .driver-popover-progress-text {
            color: #94a3b8;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-size: 10px;
            min-width: 44px;
        }
        .mentrily-guide .mentrily-guide-progress-track {
            position: relative;
            height: 4px;
            overflow: hidden;
            border-radius: 999px;
            background: #e2e8f0;
            margin: 16px 0 2px;
        }
        .mentrily-guide .mentrily-guide-progress-fill {
            height: 100%;
            width: var(--mentrily-guide-progress, 10%);
            border-radius: inherit;
            background: linear-gradient(90deg, var(--brand), #0891b2);
            transition: width 340ms cubic-bezier(0.32, 0.72, 0, 1);
        }
        .mentrily-guide .driver-popover-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 14px;
            gap: 8px;
        }
        .mentrily-guide .driver-popover-footer button {
            border-radius: 999px;
            border: 0;
            font-weight: 800;
            font-size: 12px;
            box-shadow: none;
            padding: 10px 16px;
            text-shadow: none;
            transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
        }
        .mentrily-guide .driver-popover-footer button:active {
            transform: scale(0.96);
        }
        .mentrily-guide .driver-popover-navigation-btns {
            display: flex;
            gap: 8px;
        }
        .mentrily-guide .driver-popover-next-btn,
        .mentrily-guide .driver-popover-done-btn {
            background: #0f172a;
            color: #ffffff;
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
        }
        .mentrily-guide .driver-popover-next-btn:hover,
        .mentrily-guide .driver-popover-done-btn:hover {
            background: #1e293b;
            transform: translateY(-1px);
            box-shadow: 0 12px 26px rgba(15, 23, 42, 0.26);
        }
        .mentrily-guide .driver-popover-prev-btn {
            background: #f1f5f9;
            color: #0f172a;
        }
        .mentrily-guide .driver-popover-prev-btn:hover {
            background: #e2e8f0;
        }
        .mentrily-guide .driver-popover-close-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            width: auto;
            height: auto;
            min-width: 54px;
            padding: 7px 11px;
            border-radius: 999px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            line-height: 1;
        }
        .mentrily-guide .driver-popover-close-btn:hover {
            background: #e2e8f0;
            color: #0f172a;
        }
        .mentrily-guide .mentrily-guide-keys {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 12px;
            color: #94a3b8;
            font-size: 10px;
            font-weight: 700;
        }
        .mentrily-guide .mentrily-guide-keys kbd {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 18px;
            padding: 2px 5px;
            border-radius: 5px;
            border: 1px solid #e2e8f0;
            border-bottom-width: 2px;
            background: #f8fafc;
            font-family: inherit;
            font-size: 10px;
            font-weight: 800;
            color: #64748b;
        }
        /* A slim brand outline that hugs the element. An outline (unlike the
           previous white box-shadow halo) paints no white bands on wide
           elements and stays inside the overlay cutout. */
        .driver-active-element.mentrily-guide-target {
            outline: 3px solid color-mix(in srgb, var(--brand) 80%, white);
            outline-offset: 0px;
            animation: mentrily-guide-glow 2.2s ease-in-out infinite;
        }
        @keyframes mentrily-guide-glow {
            0%, 100% { outline-color: color-mix(in srgb, var(--brand) 80%, white); }
            50%      { outline-color: color-mix(in srgb, var(--brand) 40%, white); }
        }
        @media (max-width: 640px) {
            .driver-popover.mentrily-guide {
                width: calc(100vw - 24px);
                max-width: calc(100vw - 24px);
                border-radius: 16px;
                padding: 14px;
            }
            .mentrily-guide .driver-popover-footer {
                flex-wrap: wrap;
            }
            .mentrily-guide .driver-popover-footer button {
                flex: 1 1 auto;
                min-width: 92px;
            }
            .mentrily-guide .mentrily-guide-keys {
                display: none;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .driver-popover.mentrily-guide,
            .mentrily-guide .driver-popover-title,
            .mentrily-guide .driver-popover-description,
            .mentrily-guide .mentrily-guide-progress-fill,
            .mentrily-guide .mentrily-guide-kicker::before,
            .driver-active-element.mentrily-guide-target {
                animation: none !important;
                transition: none !important;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Shared factory for every hint/tour experience in the app.
 * Returns a configured driver.js instance with the Mentrily guide theme,
 * animated progress, skip handling, and keyboard hints already wired up.
 *
 * Call `.drive()` on the returned instance to start.
 */
export function createGuide(steps: GuideStep[], options: GuideOptions = {}): Driver {
    ensureGuideTheme();

    const {
        kicker = 'Mentrily Guide',
        nextLabel = 'Next',
        prevLabel = 'Back',
        doneLabel = 'Finish',
        onSkip,
        onDismissed,
        overlayOpacity = 0.54,
        driverConfig,
    } = options;

    const total = steps.length || 1;
    let reachedEnd = false;
    let dismissedNotified = false;
    let renderedOnce = false;

    const driveSteps: DriveStep[] = steps.map((step, index) => ({
        element: step.element,
        popover: {
            title: step.title,
            description: step.description,
            side: step.side,
            align: step.align,
            ...(index === total - 1 ? { doneBtnText: doneLabel } : {}),
        },
    }));

    const guide = driver({
        showProgress: true,
        allowClose: true,
        overlayClickBehavior: 'nextStep',
        overlayColor: '#020617',
        overlayOpacity,
        popoverClass: 'mentrily-guide',
        doneBtnText: doneLabel,
        nextBtnText: nextLabel,
        prevBtnText: prevLabel,
        progressText: '{{current}} / {{total}}',
        // A tight cutout: large padding reveals a band of un-dimmed page
        // around the element, which reads as white bars on wide panels.
        stagePadding: 5,
        stageRadius: 10,
        onHighlightStarted: (element) => {
            (element as HTMLElement | undefined)?.classList?.add('mentrily-guide-target');
        },
        onDeselected: (element) => {
            (element as HTMLElement | undefined)?.classList?.remove('mentrily-guide-target');
        },
        onPopoverRender: (popover, opts) => {
            const activeIndex = Number(opts?.state?.activeIndex ?? 0);
            if (activeIndex === total - 1) {
                reachedEnd = true;
            }

            if (popover.closeButton) {
                popover.closeButton.textContent = 'Skip';
                popover.closeButton.setAttribute('aria-label', 'Skip guide');
            }

            const wrapper = popover.wrapper as HTMLElement | undefined;
            if (!wrapper) return;

            const percent = `${Math.round(((activeIndex + 1) / total) * 100)}%`;
            wrapper.style.setProperty('--mentrily-guide-progress', percent);

            // Replay the content swap animation on every step after the first render.
            if (renderedOnce) {
                wrapper.classList.remove('mentrily-guide-step-anim');
                // Force reflow so the animation restarts.
                void wrapper.offsetWidth;
                wrapper.classList.add('mentrily-guide-step-anim');
            }
            renderedOnce = true;

            if (!wrapper.querySelector('.mentrily-guide-kicker')) {
                const chip = document.createElement('div');
                chip.className = 'mentrily-guide-kicker';
                chip.textContent = kicker;
                wrapper.insertBefore(chip, popover.title);
            }

            if (!wrapper.querySelector('.mentrily-guide-progress-track')) {
                const track = document.createElement('div');
                track.className = 'mentrily-guide-progress-track';
                const fill = document.createElement('div');
                fill.className = 'mentrily-guide-progress-fill';
                track.appendChild(fill);
                popover.footer.parentElement?.insertBefore(track, popover.footer);
            }

            if (!wrapper.querySelector('.mentrily-guide-keys')) {
                const keys = document.createElement('div');
                keys.className = 'mentrily-guide-keys';
                keys.innerHTML = '<kbd>←</kbd><kbd>→</kbd> to navigate · <kbd>Esc</kbd> to skip';
                popover.footer.parentElement?.appendChild(keys);
            }
        },
        onCloseClick: (_element, _step, opts) => {
            onSkip?.();
            opts.driver.destroy();
        },
        onDestroyed: () => {
            if (dismissedNotified) return;
            dismissedNotified = true;
            onDismissed?.(reachedEnd);
        },
        ...driverConfig,
    });

    guide.setSteps(driveSteps);
    return guide;
}
