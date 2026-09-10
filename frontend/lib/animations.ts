import type { Variants } from 'motion/react';

// ── Reduced-motion media query helper ──
const prefersReducedMotion =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

const dur = (ms: number) => (prefersReducedMotion ? 0.01 : ms / 1000);

// ── Shared easing curves ──
export const easeDefault = [0.25, 0.1, 0.25, 1] as const;
export const easeSnappy = [0.16, 1, 0.3, 1] as const;

// ── Container with staggered children ──
export const staggerContainer: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: dur(90),
            delayChildren: dur(100),
        },
    },
};

// ── Fade up (default section entrance) ──
export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: dur(480),
            ease: [...easeDefault],
        },
    },
};

// ── Fade in (no translate) ──
export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: dur(350),
            ease: [...easeDefault],
        },
    },
};

// ── Slide from left ──
export const slideFromLeft: Variants = {
    hidden: { opacity: 0, x: -24 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: dur(500),
            ease: [...easeDefault],
        },
    },
};

// ── Slide from right ──
export const slideFromRight: Variants = {
    hidden: { opacity: 0, x: 24 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: dur(500),
            ease: [...easeDefault],
        },
    },
};

// ── Scale in ──
export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.94 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: dur(280),
            ease: [...easeDefault],
        },
    },
};

// ── Hero word stagger ──
export const heroWordStagger: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: dur(50),
            delayChildren: dur(100),
        },
    },
};

export const heroWord: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: dur(380),
            ease: [...easeDefault],
        },
    },
};

// ── Card hover (used with whileHover) ──
export const cardHover = {
    y: -2,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
    transition: { duration: 0.2, ease: 'easeOut' },
};

// ── Timeline milestone ──
export const timelineDot: Variants = {
    hidden: { scale: 0 },
    visible: {
        scale: 1,
        transition: { duration: dur(200), ease: [...easeDefault] },
    },
};

export const timelineLine: Variants = {
    hidden: { width: '0%' },
    visible: {
        width: '100%',
        transition: { duration: dur(300), ease: [...easeDefault] },
    },
};

// ── Value card 2x2 stagger ──
export const valueCardStagger: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: dur(120),
        },
    },
};

// ══════════════════════════════════════
// DASHBOARD ANIMATION VARIANTS
// ══════════════════════════════════════

// ── Page enter (used on every dashboard content area) ──
export const pageEnter: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: dur(250),
            ease: [...easeDefault],
            staggerChildren: dur(60),
        },
    },
};

// ── Stat card stagger (4-up row) ──
export const statCardContainer: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: dur(80),
        },
    },
};

export const statCardItem: Variants = {
    hidden: { opacity: 0, scale: 0.97 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: dur(300),
            ease: [...easeDefault],
        },
    },
};

// ── Table row stagger ──
export const tableRowContainer: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: dur(30),
        },
    },
};

export const tableRow: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: dur(250),
            ease: [...easeDefault],
        },
    },
};

// ── Modal overlay + panel ──
export const modalOverlay: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: dur(200) },
    },
    exit: {
        opacity: 0,
        transition: { duration: dur(150) },
    },
};

export const modalPanel: Variants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: dur(200),
            ease: [...easeDefault],
        },
    },
    exit: {
        opacity: 0,
        scale: 0.96,
        transition: { duration: dur(150) },
    },
};

// ── Sidebar label fade ──
export const sidebarLabel: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: dur(100), delay: dur(150) },
    },
    exit: {
        opacity: 0,
        transition: { duration: dur(100) },
    },
};

// ── Dashboard card hover ──
export const dashboardCardHover = {
    y: -1,
    boxShadow: '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)',
    transition: { duration: 0.2, ease: 'easeOut' },
};
