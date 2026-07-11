'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { Check, X, ChevronDown, ArrowRight } from 'lucide-react';
import { pricingTiers, comparisonData, faqItems } from '@/lib/pricing';

/* ── Pricing Toggle ── */
function PricingToggle({
    billing,
    setBilling,
}: {
    billing: 'monthly' | 'annual';
    setBilling: (b: 'monthly' | 'annual') => void;
}) {
    return (
        <div className="grid grid-cols-[96px_56px_160px] items-center justify-center gap-4 mb-14">
            <span
                className="text-right text-sm font-medium"
                style={{ color: billing === 'monthly' ? '#0F172A' : '#94A3B8' }}
            >
                Monthly
            </span>
            <button
                onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
                className="relative w-14 h-7 rounded-full transition-colors duration-250 cursor-pointer"
                style={{ backgroundColor: billing === 'annual' ? '#008D98' : '#E2E8F0' }}
                aria-label="Toggle billing period"
            >
                <motion.div
                    className="absolute top-0.5 w-6 h-6 rounded-full bg-white"
                    style={{
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                    }}
                    animate={{ left: billing === 'annual' ? '30px' : '2px' }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                />
            </button>
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: billing === 'annual' ? '#0F172A' : '#94A3B8' }}>
                    Annual
                </span>
                <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-opacity duration-200 ${
                        billing === 'annual' ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ backgroundColor: '#E6F7F8', color: '#008D98' }}
                    aria-hidden={billing !== 'annual'}
                >
                    2 months free
                </span>
            </div>
        </div>
    );
}

/* ── Pricing Cards ── */
function PricingCards({ billing }: { billing: 'monthly' | 'annual' }) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    return (
        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-20">
            {pricingTiers.map((tier, i) => {
                const price =
                    tier.monthlyPrice === null
                        ? 'Custom'
                        : billing === 'annual' && tier.yearlyPrice !== null
                          ? `$${Math.round(tier.yearlyPrice / 12)}`
                          : `$${tier.monthlyPrice}`;
                const period = tier.monthlyPrice === null ? '' : '/mo';
                const annualTotal = billing === 'annual' && tier.yearlyPrice ? `$${tier.yearlyPrice}/yr` : null;

                return (
                    <motion.div
                        key={tier.id}
                        initial={{ opacity: 0, y: 28 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{
                            delay: 0.05 + i * 0.08,
                            duration: 0.48,
                            ease: [0.25, 0.1, 0.25, 1],
                        }}
                        className={`relative p-6 rounded-2xl transition-all duration-200 flex flex-col ${
                            tier.highlighted ? 'animate-pro-pulse' : ''
                        }`}
                        style={{
                            backgroundColor: tier.highlighted ? '#E6F7F8' : '#FFFFFF',
                            border: tier.highlighted ? '2px solid #008D98' : '1px solid #E2E8F0',
                            boxShadow: tier.highlighted
                                ? '0 4px 20px rgba(26,86,219,0.18)'
                                : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                        }}
                    >
                        {tier.badge && (
                            <span
                                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap"
                                style={{ backgroundColor: '#F59E0B' }}
                            >
                                {tier.badge}
                            </span>
                        )}

                        <h3 className="text-sm font-semibold mb-1" style={{ color: '#0F172A' }}>
                            {tier.name}
                        </h3>

                        {/* Price */}
                        <div className="mb-1">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`${tier.id}-${billing}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex items-baseline gap-1"
                                >
                                    <span
                                        className="text-3xl font-semibold"
                                        style={{ color: '#0F172A', fontFamily: 'var(--font-body)' }}
                                    >
                                        {price}
                                    </span>
                                    <span className="text-sm" style={{ color: '#94A3B8' }}>
                                        {period}
                                    </span>
                                </motion.div>
                            </AnimatePresence>
                            {annualTotal && (
                                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                                    billed as {annualTotal}
                                </p>
                            )}
                        </div>

                        <p className="text-xs leading-relaxed mb-4" style={{ color: '#475569' }}>
                            {tier.description}
                        </p>

                        {/* Limits */}
                        <div
                            className="py-3 mb-4 space-y-1"
                            style={{ borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}
                        >
                            {Object.entries(tier.limits).map(([limitName, v]) => (
                                <p
                                    key={`${tier.id}-${limitName}`}
                                    className="text-xs font-medium"
                                    style={{ color: '#0F172A' }}
                                >
                                    {v}
                                </p>
                            ))}
                        </div>

                        {/* Features */}
                        <ul className="space-y-2 mb-6 flex-1">
                            {tier.features.map((f) => (
                                <li key={f} className="flex items-start gap-2 text-xs" style={{ color: '#475569' }}>
                                    <Check size={14} style={{ color: '#10B981' }} className="shrink-0 mt-0.5" />
                                    {f}
                                </li>
                            ))}
                        </ul>

                        {/* CTA */}
                        <Link
                            href={tier.ctaHref}
                            className="block w-full py-2.5 text-center text-sm font-semibold rounded-lg transition-colors duration-150 cursor-pointer mt-auto"
                            style={{
                                backgroundColor: tier.highlighted ? '#008D98' : 'transparent',
                                color: tier.highlighted ? '#FFFFFF' : '#008D98',
                                border: tier.highlighted ? 'none' : '1px solid #E2E8F0',
                            }}
                            onMouseEnter={(e) => {
                                if (tier.highlighted) {
                                    e.currentTarget.style.backgroundColor = '#006F78';
                                } else {
                                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                                    e.currentTarget.style.borderColor = '#008D98';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (tier.highlighted) {
                                    e.currentTarget.style.backgroundColor = '#008D98';
                                } else {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = '#E2E8F0';
                                }
                            }}
                        >
                            {tier.cta}
                        </Link>
                    </motion.div>
                );
            })}
        </div>
    );
}

/* ── Feature Comparison Table ── */
function FeatureComparison() {
    const [expanded, setExpanded] = useState<string[]>([]);

    const toggle = (name: string) => {
        setExpanded((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
    };

    const renderValue = (val: string | boolean) => {
        if (val === true) return <Check size={16} style={{ color: '#10B981' }} />;
        if (val === false) return <X size={16} style={{ color: '#EF4444' }} />;
        return (
            <span className="text-xs font-medium" style={{ color: '#475569' }}>
                {val}
            </span>
        );
    };

    return (
        <div className="mb-20">
            <h3
                className="text-center mb-8"
                style={{
                    fontFamily: 'var(--font-display), Georgia, serif',
                    fontSize: '24px',
                    fontWeight: 400,
                    color: '#0F172A',
                }}
            >
                Compare all features
            </h3>

            {/* Header row (desktop) */}
            <div
                className="hidden lg:grid grid-cols-5 gap-0 mb-2 px-4 py-3 rounded-lg"
                style={{ backgroundColor: '#F8FAFC' }}
            >
                <div className="text-xs font-semibold" style={{ color: '#94A3B8' }}>
                    Feature
                </div>
                <div className="text-xs font-semibold text-center" style={{ color: '#94A3B8' }}>
                    Free
                </div>
                <div className="text-xs font-semibold text-center" style={{ color: '#94A3B8' }}>
                    Starter
                </div>
                <div className="text-xs font-semibold text-center" style={{ color: '#008D98' }}>
                    Pro
                </div>
                <div className="text-xs font-semibold text-center" style={{ color: '#94A3B8' }}>
                    Enterprise
                </div>
            </div>

            {/* Categories */}
            <div className="space-y-2">
                {comparisonData.map((cat) => {
                    const isExpanded = expanded.includes(cat.name);
                    return (
                        <div key={cat.name}>
                            <button
                                onClick={() => toggle(cat.name)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-150 cursor-pointer"
                                style={{
                                    backgroundColor: isExpanded ? '#E6F7F8' : '#FFFFFF',
                                    border: '1px solid #E2E8F0',
                                }}
                            >
                                <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                                    {cat.name}
                                </span>
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronDown size={18} style={{ color: '#94A3B8' }} />
                                </motion.div>
                            </button>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pt-1 space-y-0">
                                            {cat.features.map((feat) => (
                                                <div
                                                    key={feat.name}
                                                    className="grid grid-cols-2 lg:grid-cols-5 gap-2 px-4 py-3 items-center"
                                                    style={{ borderBottom: '1px solid #F1F5F9' }}
                                                >
                                                    <span
                                                        className="text-sm col-span-2 lg:col-span-1"
                                                        style={{ color: '#475569' }}
                                                    >
                                                        {feat.name}
                                                    </span>
                                                    <div className="flex justify-center">{renderValue(feat.free)}</div>
                                                    <div className="flex justify-center">
                                                        {renderValue(feat.starter)}
                                                    </div>
                                                    <div className="flex justify-center">{renderValue(feat.pro)}</div>
                                                    <div className="flex justify-center">
                                                        {renderValue(feat.enterprise)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── FAQ ── */
function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="max-w-3xl mx-auto mb-20">
            <h3
                className="text-center mb-10"
                style={{
                    fontFamily: 'var(--font-display), Georgia, serif',
                    fontSize: '24px',
                    fontWeight: 400,
                    color: '#0F172A',
                }}
            >
                Frequently asked questions
            </h3>

            <div className="space-y-2">
                {faqItems.map((item, i) => {
                    const isOpen = openIndex === i;
                    return (
                        <div
                            key={i}
                            className="rounded-xl overflow-hidden"
                            style={{
                                border: '1px solid #E2E8F0',
                                backgroundColor: '#FFFFFF',
                            }}
                        >
                            <button
                                onClick={() => setOpenIndex(isOpen ? null : i)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                            >
                                <span className="text-sm font-medium pr-4" style={{ color: '#0F172A' }}>
                                    {item.question}
                                </span>
                                <motion.div
                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="shrink-0"
                                >
                                    <ChevronDown size={18} style={{ color: '#94A3B8' }} />
                                </motion.div>
                            </button>

                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-5 pb-4">
                                            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                                                {item.answer}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Pricing Page ── */
export default function PricingPage() {
    const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });

    return (
        <div ref={ref} className="pt-24 pb-0" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48 }}
                    className="text-center mb-10"
                >
                    <h1
                        style={{
                            fontFamily: 'var(--font-display), Georgia, serif',
                            fontSize: 'clamp(36px, 5vw, 56px)',
                            fontWeight: 400,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            color: '#0F172A',
                        }}
                    >
                        Pricing
                    </h1>
                    <p
                        className="mt-4 max-w-lg mx-auto"
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '17px',
                            lineHeight: 1.65,
                            color: '#475569',
                        }}
                    >
                        One price covers your whole school. No per-student fees. No surprise charges.
                    </p>
                </motion.div>

                <PricingToggle billing={billing} setBilling={setBilling} />
                <PricingCards billing={billing} />
                <FeatureComparison />
                <FAQ />

                {/* Final CTA strip */}
                <div className="text-center py-14" style={{ borderTop: '1px solid #E2E8F0' }}>
                    <h3
                        className="mb-4"
                        style={{
                            fontFamily: 'var(--font-display), Georgia, serif',
                            fontSize: '24px',
                            fontWeight: 400,
                            color: '#0F172A',
                        }}
                    >
                        Ready to launch your school?
                    </h3>
                    <Link
                        href="/signup"
                        className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white rounded-lg transition-colors duration-150 cursor-pointer"
                        style={{ backgroundColor: '#008D98' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006F78')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008D98')}
                    >
                        Get Started Free <ArrowRight size={16} />
                    </Link>
                    <p className="mt-3 text-xs" style={{ color: '#94A3B8' }}>
                        No credit card required.
                    </p>
                </div>
            </div>
        </div>
    );
}
