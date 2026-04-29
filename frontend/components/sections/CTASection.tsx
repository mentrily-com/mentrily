'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Shield, Infinity, CreditCard } from 'lucide-react';

export default function CTASection() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) {
            setSubmitted(true);
            setEmail('');
        }
    };

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
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="mt-5 text-base"
                    style={{ color: 'rgba(226,232,240,0.7)' }}
                >
                    Join 500+ educators who chose ownership over renting.
                </motion.p>

                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.2, duration: 0.48 }}
                    onSubmit={handleSubmit}
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
                        className="px-6 py-3.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
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
                        {submitted ? (
                            'Check your email!'
                        ) : (
                            <>
                                Get Started Free <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </motion.form>

                {/* Trust badges */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.4 }}
                    className="mt-8 flex flex-wrap items-center justify-center gap-6"
                >
                    <span className="flex items-center gap-2 text-xs" style={{ color: 'rgba(148,163,184,0.8)' }}>
                        <CreditCard size={14} style={{ color: '#5EEAD4' }} />
                        No credit card required
                    </span>
                    <span className="flex items-center gap-2 text-xs" style={{ color: 'rgba(148,163,184,0.8)' }}>
                        <Infinity size={14} style={{ color: '#5EEAD4' }} />
                        Free forever plan
                    </span>
                    <span className="flex items-center gap-2 text-xs" style={{ color: 'rgba(148,163,184,0.8)' }}>
                        <Shield size={14} style={{ color: '#5EEAD4' }} />
                        Cancel anytime
                    </span>
                </motion.div>
            </div>
        </section>
    );
}
