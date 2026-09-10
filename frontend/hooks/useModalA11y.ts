import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared keyboard/focus behavior for custom modal and drawer overlays:
 * Escape closes, Tab/Shift+Tab is trapped inside the panel, background
 * scroll is locked, and focus moves into the panel on open and back to
 * whatever triggered it on close.
 *
 * `AppModal` inlines this same logic (it predates the hook and is the most
 * widely used dialog, so its own copy stays put); every other custom
 * overlay should use this hook rather than re-implement it.
 */
export function useModalA11y(panelRef: React.RefObject<HTMLElement | null>, isOpen: boolean, onClose?: () => void) {
    const triggerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        triggerRef.current = document.activeElement as HTMLElement | null;

        const raf = requestAnimationFrame(() => {
            const panel = panelRef.current;
            if (!panel) return;
            const focusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
            (focusable || panel).focus();
        });

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && onClose) {
                event.stopPropagation();
                onClose();
                return;
            }

            if (event.key !== 'Tab') return;

            const panel = panelRef.current;
            if (!panel) return;
            const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
                (el) => el.offsetParent !== null,
            );
            if (focusables.length === 0) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.body.style.overflow = previousOverflow;
            triggerRef.current?.focus?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);
}
