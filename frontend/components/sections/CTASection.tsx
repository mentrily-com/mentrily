'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Shield, Infinity, CreditCard, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface CTASectionProps {
    title?: string;
    description?: string;
    ctaText?: string;
    ctaHref?: string;
}

export default function CTASection({ title, description, ctaText, ctaHref }: CTASectionProps) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleMarketingEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus('loading');
        try {
            const res = await fetch('/api/marketing/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (res.ok) {
                setStatus('success');
                setEmail('');
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('Email send error:', error);
            setStatus('error');
        }
    };

    const displayTitle = title || 'Your school. Your brand. Launch today.';
    const displayDescription = description || 'Join educators who chose ownership over renting.';
    const displayCtaText = ctaText || 'Get Started Free';

    return (
        <section
            ref={ref}
            className="py-20 sm:py-28 relative overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #0F3035 70%, #0A2527 100%)',
            }}
        >
            {/* Decorative elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Teal gradient orb */}
                <div
                    className="absolute animate-mesh-drift"
                    style={{
                        top: '-30%',
                        right: '-10%',
                        width: '700px',
                        height: '700px',
                        background: 'radial-gradient(circle, rgba(0,141,152,0.15) 0%, transparent 60%)',
                    }}
                />
                {/* Emerald orb */}
                <div
                    className="absolute"
                    style={{
                        bottom: '-20%',
                        left: '-10%',
                        width: '500px',
                        height: '500px',
                        background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 60%)',
                    }}
                />
                {/* Dot pattern overlay */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.h2
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{
                        fontFamily: 'var(--font-display), Georgia, serif',
                        fontSize: 'clamp(32px, 5vw, 52px)',
                        fontWeight: 400,
                        lineHeight: 1.1,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                    }}
                >
                    {title ? (
                        title
                    ) : (
                        <>
                            Your school. Your brand.{' '}
                            <span
                                style={{
                                    fontStyle: 'italic',
                                    fontWeight: 500,
                                    background: 'linear-gradient(135deg, #5EEAD4, #2DD4BF)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}
                            >
                                Launch today.
                            </span>
                        </>
                    )}
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="mt-5 text-base"
                    style={{ color: 'rgba(226,232,240,0.7)' }}
                >
                    {displayDescription}
                </motion.p>

                {ctaHref ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.2, duration: 0.48 }}
                        className="mt-10"
                    >
                        <Link
                            href={ctaHref}
                            className="inline-flex items-center justify-center px-10 py-4 text-base font-black text-white rounded-xl transition-all duration-200 cursor-pointer gap-2"
                            style={{
                                background: 'linear-gradient(135deg, #008D98, #006F78)',
                                boxShadow: '0 4px 16px rgba(0,141,152,0.3)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,141,152,0.45)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,141,152,0.3)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {displayCtaText} <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                ) : status === 'success' ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-10 p-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 backdrop-blur-sm max-w-md mx-auto"
                    >
                        <div className="flex items-center justify-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <h3 className="text-lg font-black text-white">Check your email!</h3>
                        </div>
                        <p className="text-sm text-teal-100/70 font-medium">We just sent your platform invite link. See you inside!</p>
                    </motion.div>
                ) : (
                    <motion.form
                        initial={{ opacity: 0, y: 20 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.2, duration: 0.48 }}
                        onSubmit={handleMarketingEmail}
                        className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                    >
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            className="flex-1 px-5 py-3.5 text-sm rounded-xl outline-none transition-all duration-200"
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#FFFFFF',
                                backdropFilter: 'blur(8px)',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(0,141,152,0.5)';
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,141,152,0.15)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        />
                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="px-6 py-3.5 text-sm font-black text-white rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                            style={{
                                background: 'linear-gradient(135deg, #008D98, #006F78)',
                                boxShadow: '0 4px 16px rgba(0,141,152,0.3)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,141,152,0.45)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,141,152,0.3)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {status === 'loading' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    {displayCtaText} <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </motion.form>
                )}

                {(status === 'error' && !ctaHref) && (
                    <p className="mt-4 text-xs font-bold text-rose-400">
                        Something went wrong. Please try again.
                    </p>
                )}

                {/* Trust badges */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.4 }}
                    className="mt-8 flex flex-wrap items-center justify-center gap-6"
                >
                    <span className="flex items-center gap-2 text-xs font-bold" style={{ color: 'rgba(148,163,184,0.8)' }}>
                        <CreditCard size={14} style={{ color: '#5EEAD4' }} />
                        No credit card required
                    </span>
                    <span className="flex items-center gap-2 text-xs font-bold" style={{ color: 'rgba(148,163,184,0.8)' }}>
                        <Infinity size={14} style={{ color: '#5EEAD4' }} />
                        Free forever plan
                    </span>
                    <span className="flex items-center gap-2 text-xs font-bold" style={{ color: 'rgba(148,163,184,0.8)' }}>
                        <Shield size={14} style={{ color: '#5EEAD4' }} />
                        Cancel anytime
                    </span>
                </motion.div>
            </div>
        </section>
    );
}
