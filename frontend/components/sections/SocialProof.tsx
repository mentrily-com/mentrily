'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { useEffect, useState, useRef } from 'react';

const stats = [
    { label: 'Courses Launched', target: 500, suffix: '+' },
    { label: 'Coding Languages', target: 33, suffix: '' },
    { label: 'Exams Graded', target: 10_000, suffix: '+', format: true },
    { label: 'Uptime', target: 98, suffix: '%' },
];

function AnimatedCounter({
    target,
    suffix,
    format,
    inView,
}: {
    target: number;
    suffix: string;
    format?: boolean;
    inView: boolean;
}) {
    const [count, setCount] = useState(0);
    const rafRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
        if (!inView) return;
        const duration = 1800;

        const animate = (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const elapsed = timestamp - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out curve
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                setCount(target);
            }
        };

        rafRef.current = requestAnimationFrame(animate);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [inView, target]);

    const display = format
        ? count >= 1_000_000
            ? `${(count / 1_000_000).toFixed(0)}M`
            : count >= 1_000
              ? `${(count / 1_000).toFixed(0)}K`
              : count.toString()
        : count.toLocaleString();

    return (
        <span>
            {display}
            {suffix}
        </span>
    );
}

export default function SocialProof() {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.12,
    });

    return (
        <motion.section
            ref={ref}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            className="py-6"
            style={{ borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}
        >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div
                    className="flex flex-wrap items-center justify-center gap-6 sm:gap-0 sm:divide-x"
                    style={{ borderColor: '#E2E8F0' }}
                >
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="flex flex-col items-center px-8 sm:px-10 py-2"
                            style={{
                                borderColor: '#E2E8F0',
                            }}
                        >
                            <span
                                className="text-2xl sm:text-3xl font-semibold tabular-nums"
                                style={{
                                    color: '#0F172A',
                                    fontFamily: 'var(--font-body), system-ui, sans-serif',
                                }}
                            >
                                <AnimatedCounter
                                    target={stat.target}
                                    suffix={stat.suffix}
                                    format={stat.format}
                                    inView={inView}
                                />
                            </span>
                            <span className="text-xs sm:text-sm mt-1" style={{ color: '#94A3B8' }}>
                                {stat.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </motion.section>
    );
}
