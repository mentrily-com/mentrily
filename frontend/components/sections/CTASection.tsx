'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { ArrowRight } from 'lucide-react';

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
            className="py-20 sm:py-28"
            style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}
        >
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.h2
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{
                        fontFamily: 'var(--font-display), Georgia, serif',
                        fontSize: 'clamp(32px, 5vw, 48px)',
                        fontWeight: 400,
                        lineHeight: 1.1,
                        letterSpacing: '-0.02em',
                        color: '#0F172A',
                    }}
                >
                    Your school. Your brand.{' '}
                    <span
                        style={{
                            fontStyle: 'italic',
                            fontWeight: 500,
                        }}
                    >
                        Launch today.
                    </span>
                </motion.h2>

                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.15, duration: 0.48 }}
                    onSubmit={handleSubmit}
                    className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                >
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="flex-1 px-4 py-3 text-sm rounded-lg border outline-none transition-colors duration-150"
                        style={{
                            backgroundColor: '#F8FAFC',
                            borderColor: '#E2E8F0',
                            color: '#0F172A',
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#008D98')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#E2E8F0')}
                    />
                    <button
                        type="submit"
                        className="px-6 py-3 text-sm font-semibold text-white rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#008D98' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006F78')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008D98')}
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

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.3 }}
                    className="mt-4 text-xs"
                    style={{ color: '#94A3B8' }}
                >
                    No credit card required. Free forever on the Free plan.
                </motion.p>
            </div>
        </section>
    );
}
