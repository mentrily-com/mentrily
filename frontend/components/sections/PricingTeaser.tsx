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
            className="py-20 sm:py-28 relative overflow-hidden bg-gray-50 border-t border-gray-200"
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
                        <div className="w-8 h-0.5 bg-[var(--brand)]" />
                        <span className="text-sm font-medium uppercase tracking-widest text-[var(--brand-dark)]">
                            Pricing
                        </span>
                        <div className="w-8 h-0.5 bg-[var(--brand)]" />
                    </div>
                    <h2
                        className="font-display font-normal tracking-tight"
                        style={{
                            fontSize: 'clamp(32px, 4vw, 48px)',
                            lineHeight: 1.1,
                        }}
                    >
                        Clear limits, clean upgrade path
                    </h2>
                    <p className="mt-3 text-sm max-w-lg mx-auto text-gray-500">
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
                            className={`relative p-6 rounded-lg transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${
                                tier.highlighted ? 'shadow-md hover:shadow-lg' : 'shadow-sm hover:shadow-md'
                            }`}
                            style={{
                                backgroundColor: '#FFFFFF',
                                border: tier.highlighted ? '2px solid transparent' : '1px solid #dce0e6',
                                backgroundImage: tier.highlighted
                                    ? 'linear-gradient(#FFFFFF, #FFFFFF), linear-gradient(135deg, #007c85, #10B981)'
                                    : 'none',
                                backgroundOrigin: 'border-box',
                                backgroundClip: tier.highlighted ? 'padding-box, border-box' : 'border-box',
                            }}
                        >
                            {tier.highlighted && (
                                <span
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-medium text-white"
                                    style={{
                                        background: 'linear-gradient(135deg, #F59E0B, #F97316)',
                                        boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
                                    }}
                                >
                                    RECOMMENDED
                                </span>
                            )}

                            <h3 className="text-sm font-semibold mb-1 text-gray-900">
                                {tier.name}
                            </h3>
                            <p className="text-xs mb-3 text-gray-400">
                                {tier.description}
                            </p>
                            <div className="flex items-baseline gap-1 mb-5">
                                <span
                                    className="text-4xl font-medium text-gray-900"
                                >
                                    {tier.price}
                                </span>
                                <span className="text-sm font-medium text-gray-400">
                                    {tier.period}
                                </span>
                            </div>

                            <ul className="space-y-2.5 mb-6">
                                {tier.features.map((f) => (
                                    <li
                                        key={f}
                                        className="flex items-center gap-2.5 text-sm text-gray-500"
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-emerald-50"
                                        >
                                            <Check size={12} className="text-emerald-500" strokeWidth={3} />
                                        </div>
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <Link
                                href={tier.href}
                                className="block w-full py-2.5 text-center text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer"
                                style={{
                                    background: tier.highlighted
                                        ? 'linear-gradient(135deg, #007c85, #005359)'
                                        : 'transparent',
                                    color: tier.highlighted ? '#FFFFFF' : '#006a72',
                                    border: tier.highlighted ? 'none' : '1px solid #dce0e6',
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
                        className="inline-flex items-center gap-1.5 text-sm font-medium transition-all duration-200 cursor-pointer group text-[var(--brand-dark)]"
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
