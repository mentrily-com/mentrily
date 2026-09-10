'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

const teaserTiers = [
    {
        name: 'Free',
        price: '$0',
        period: '/mo',
        description: 'For individual educators getting started.',
        features: ['2 courses', 'Unlimited students', '2 monthly exams', 'All question types'],
        cta: 'Start Free',
        href: '/signup',
    },
    {
        name: 'Starter',
        price: '$39',
        period: '/mo',
        description: 'For small teams running bootcamps.',
        features: ['15 courses', 'Unlimited students', '10 monthly exams', '2 admin + 3 teacher seats'],
        cta: 'Start Starter',
        href: '/signup?plan=starter',
    },
    {
        name: 'Pro',
        price: '$119',
        period: '/mo',
        description: 'For growing schools and training programs.',
        features: ['30 courses', 'Unlimited students', '20 monthly exams', '5 admin + 10 teacher seats'],
        cta: 'Start Pro',
        href: '/signup?plan=pro',
        highlighted: true,
    },
];

export default function PricingTeaser() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    return (
        <section
            ref={ref}
            className="py-20 sm:py-28 relative overflow-hidden"
            style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}
        >
            {/* Background radial gradient */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    style={{
                        position: 'absolute',
                        top: '20%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '1000px',
                        height: '600px',
                        background: 'radial-gradient(ellipse at center, rgba(0,141,152,0.04) 0%, transparent 65%)',
                    }}
                />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                    className="text-center mb-14"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#008D98' }} />
                        <span className="text-sm font-medium uppercase tracking-widest" style={{ color: '#008D98' }}>
                            Pricing
                        </span>
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#008D98' }} />
                    </div>
                    <h2
                        style={{
                            fontFamily: 'var(--font-display), Georgia, serif',
                            fontSize: 'clamp(32px, 4vw, 48px)',
                            fontWeight: 400,
                            lineHeight: 1.1,
                            letterSpacing: '-0.02em',
                            color: '#0F172A',
                        }}
                    >
                        Clear limits, clean upgrade path
                    </h2>
                    <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: '#64748B' }}>
                        Free works personally. Starter and Pro add team seats. Enterprise unlocks custom domains and
                        white-label branding.
                    </p>
                </motion.div>

                <div className="grid sm:grid-cols-3 gap-5">
                    {teaserTiers.map((tier, i) => (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 28 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{
                                delay: 0.1 + i * 0.1,
                                duration: 0.48,
                                ease: [0.25, 0.1, 0.25, 1],
                            }}
                            className={`relative p-6 rounded-2xl transition-all duration-250 cursor-pointer ${
                                tier.highlighted ? 'animate-glow-pulse' : ''
                            }`}
                            style={{
                                backgroundColor: tier.highlighted ? '#FFFFFF' : '#FFFFFF',
                                border: tier.highlighted ? '2px solid transparent' : '1px solid #E2E8F0',
                                backgroundImage: tier.highlighted
                                    ? 'linear-gradient(#FFFFFF, #FFFFFF), linear-gradient(135deg, #008D98, #10B981)'
                                    : 'none',
                                backgroundOrigin: 'border-box',
                                backgroundClip: tier.highlighted ? 'padding-box, border-box' : 'border-box',
                                boxShadow: tier.highlighted
                                    ? '0 8px 32px rgba(0,141,152,0.12), 0 2px 8px rgba(0,0,0,0.04)'
                                    : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
                            }}
                            onMouseEnter={(e) => {
                                if (!tier.highlighted) {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow =
                                        '0 8px 24px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)';
                                } else {
                                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!tier.highlighted) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow =
                                        '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)';
                                } else {
                                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                }
                            }}
                        >
                            {tier.highlighted && (
                                <span
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
                                    style={{
                                        background: 'linear-gradient(135deg, #F59E0B, #F97316)',
                                        boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
                                    }}
                                >
                                    RECOMMENDED
                                </span>
                            )}

                            <h3 className="text-sm font-semibold mb-1" style={{ color: '#0F172A' }}>
                                {tier.name}
                            </h3>
                            <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
                                {tier.description}
                            </p>
                            <div className="flex items-baseline gap-1 mb-5">
                                <span
                                    className="text-4xl font-bold"
                                    style={{ color: '#0F172A', fontFamily: 'var(--font-body)' }}
                                >
                                    {tier.price}
                                </span>
                                <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>
                                    {tier.period}
                                </span>
                            </div>

                            <ul className="space-y-2.5 mb-6">
                                {tier.features.map((f) => (
                                    <li
                                        key={f}
                                        className="flex items-center gap-2.5 text-sm"
                                        style={{ color: '#475569' }}
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: '#ECFDF5' }}
                                        >
                                            <Check size={12} style={{ color: '#10B981' }} strokeWidth={3} />
                                        </div>
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <Link
                                href={tier.href}
                                className="block w-full py-2.5 text-center text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                                style={{
                                    background: tier.highlighted
                                        ? 'linear-gradient(135deg, #008D98, #006F78)'
                                        : 'transparent',
                                    color: tier.highlighted ? '#FFFFFF' : '#008D98',
                                    border: tier.highlighted ? 'none' : '1px solid #E2E8F0',
                                    boxShadow: tier.highlighted ? '0 4px 12px rgba(0,141,152,0.2)' : 'none',
                                }}
                            >
                                {tier.cta}
                            </Link>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.5 }}
                    className="text-center mt-8"
                >
                    <Link
                        href="/pricing"
                        className="inline-flex items-center gap-1.5 text-sm font-medium transition-all duration-200 cursor-pointer group"
                        style={{ color: '#008D98' }}
                    >
                        See full pricing & Enterprise plan
                        <ArrowRight
                            size={15}
                            className="transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
