'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { useEffect, useState, useRef } from 'react';
import { BookOpen, Code2, FileCheck, Zap } from 'lucide-react';

const stats = [
    { label: 'Courses Launched', target: 500, suffix: '+', icon: BookOpen },
    { label: 'Languages Supported', target: 33, suffix: '', icon: Code2 },
    { label: 'Exams Graded', target: 10_000, suffix: '+', format: true, icon: FileCheck },
    { label: 'Uptime', target: 99.8, suffix: '%', decimal: true, icon: Zap },
];

function AnimatedCounter({
    target,
    suffix,
    format,
    decimal,
    inView,
}: {
    target: number;
    suffix: string;
    format?: boolean;
    decimal?: boolean;
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

            if (decimal) {
                setCount(parseFloat((eased * target).toFixed(1)));
            } else {
                setCount(Math.floor(eased * target));
            }

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
    }, [inView, target, decimal]);

    const display = format
        ? count >= 1_000_000
            ? `${(count / 1_000_000).toFixed(0)}M`
            : count >= 1_000
              ? `${(count / 1_000).toFixed(0)}K`
              : count.toString()
        : decimal
          ? count.toFixed(1)
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
            className="py-8 relative"
            style={{ backgroundColor: '#FFFFFF' }}
        >
            {/* Gradient accent line at top */}
            <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                    background: 'linear-gradient(90deg, transparent 0%, #008D98 30%, #10B981 70%, transparent 100%)',
                }}
            />
            {/* Bottom border */}
            <div className="absolute bottom-0 left-0 right-0 h-px" style={{ backgroundColor: '#E2E8F0' }} />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-6 sm:gap-0">
                    {stats.map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 12 }}
                                animate={inView ? { opacity: 1, y: 0 } : {}}
                                transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                                className="flex flex-col items-center px-2 sm:px-8 py-3 text-center group cursor-default"
                                style={{
                                    borderRight: i < stats.length - 1 ? '1px solid transparent' : 'none',
                                }}
                            >
                                {/* Icon */}
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 transition-colors duration-200"
                                    style={{ backgroundColor: '#E6F7F8' }}
                                >
                                    <Icon size={18} style={{ color: '#008D98' }} />
                                </div>
                                {/* Number */}
                                <span
                                    className="text-2xl sm:text-3xl font-bold tabular-nums"
                                    style={{
                                        color: '#0F172A',
                                        fontFamily: 'var(--font-body), system-ui, sans-serif',
                                    }}
                                >
                                    <AnimatedCounter
                                        target={stat.target}
                                        suffix={stat.suffix}
                                        format={stat.format}
                                        decimal={stat.decimal}
                                        inView={inView}
                                    />
                                </span>
                                {/* Label */}
                                <span
                                    className="text-xs sm:text-sm mt-1 font-medium leading-tight"
                                    style={{ color: '#64748B' }}
                                >
                                    {stat.label}
                                </span>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </motion.section>
    );
}
