'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { heroWordStagger, heroWord } from '@/lib/animations';
import { siteConfig } from '@/app/config/site';

export default function Hero() {
    return (
        <section
            className="relative min-h-screen flex items-center overflow-hidden pt-16"
            style={{ backgroundColor: '#FFFFFF' }}
        >
            {/* Subtle radial gradient top-right */}
            <div
                className="absolute top-0 right-0 w-[800px] h-[800px] pointer-events-none"
                style={{
                    background: 'radial-gradient(circle at center, #E6F7F8 0%, transparent 65%)',
                    opacity: 0.7,
                }}
            />

            {/* Dot grid pattern */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#E2E8F0 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    opacity: 0.04,
                }}
            />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="grid lg:grid-cols-[minmax(500px,0.88fr)_minmax(0,1.12fr)] gap-12 lg:gap-10 items-center">
                    {/* Left: Copy */}
                    <div className="max-w-xl">
                        {/* Headline */}
                        <motion.h1 variants={heroWordStagger} initial="hidden" animate="visible" className="mb-6">
                            {['Stop', 'renting'].map((word, i) => (
                                <motion.span
                                    key={i}
                                    variants={heroWord}
                                    className="inline-block mr-3"
                                    style={{
                                        fontFamily: 'var(--font-display), Georgia, serif',
                                        fontSize: 'clamp(40px, 5.5vw, 72px)',
                                        fontWeight: 300,
                                        lineHeight: 1.1,
                                        letterSpacing: '-0.03em',
                                        color: '#0F172A',
                                    }}
                                >
                                    {word}
                                </motion.span>
                            ))}
                            <br />
                            {['someone', "else's", 'classroom.'].map((word, i) => (
                                <motion.span
                                    key={`italic-${i}`}
                                    variants={heroWord}
                                    className="inline-block mr-3"
                                    style={{
                                        fontFamily: 'var(--font-display), Georgia, serif',
                                        fontSize: 'clamp(40px, 5.5vw, 72px)',
                                        fontWeight: 500,
                                        fontStyle: 'italic',
                                        lineHeight: 1.1,
                                        letterSpacing: '-0.03em',
                                        color: '#0F172A',
                                    }}
                                >
                                    {word}
                                </motion.span>
                            ))}
                        </motion.h1>

                        {/* Sub-headline */}
                        <motion.p
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.42, duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
                            className="mb-8 leading-relaxed max-w-lg"
                            style={{
                                fontFamily: 'var(--font-body), system-ui, sans-serif',
                                fontSize: '17px',
                                lineHeight: 1.65,
                                color: '#475569',
                            }}
                        >
                            {siteConfig.name} gives educators a complete platform to create courses, lessons, quizzes,
                            proctored exams, assignments, and certificates. Start free as a personal teacher account,
                            upgrade to Starter or Pro for team usage, and unlock white-label branding on Enterprise.
                        </motion.p>

                        {/* CTAs */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6, duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                            className="flex flex-wrap gap-4"
                        >
                            <Link
                                href="/signup"
                                className="inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-lg transition-all duration-150 cursor-pointer"
                                style={{
                                    backgroundColor: '#008D98',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006F78')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008D98')}
                            >
                                Start for Free
                            </Link>
                            <Link
                                href="/pricing"
                                className="inline-flex items-center px-7 py-3.5 text-sm font-semibold rounded-lg border transition-all duration-150 cursor-pointer"
                                style={{
                                    color: '#008D98',
                                    borderColor: '#E2E8F0',
                                    backgroundColor: 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                                    e.currentTarget.style.borderColor = '#008D98';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = '#E2E8F0';
                                }}
                            >
                                See Pricing
                            </Link>
                        </motion.div>
                    </div>

                    {/* Right: Dashboard preview */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                            delay: 0.9,
                            duration: 0.5,
                            ease: [0.16, 1, 0.3, 1],
                        }}
                        className="hidden lg:flex justify-center"
                    >
                        <div
                            className="relative w-[min(56vw,860px)] overflow-hidden rounded-2xl bg-white xl:w-[min(57vw,900px)]"
                            style={{
                                border: '1px solid #E2E8F0',
                                boxShadow: '0 24px 70px rgba(15,23,42,0.14), 0 8px 24px rgba(15,23,42,0.08)',
                            }}
                        >
                            <div className="relative aspect-[1919/938] overflow-hidden bg-[#F8FAFC]">
                                <Image
                                    src="/images/dashboard-learner-preview.jpg"
                                    alt={`${siteConfig.name} learner dashboard preview`}
                                    fill
                                    priority
                                    sizes="(min-width: 1024px) 64vw, 100vw"
                                    className="object-cover"
                                />
                                <div
                                    className="pointer-events-none absolute inset-0"
                                    style={{
                                        boxShadow: 'inset 0 0 0 1px rgba(226,232,240,0.7)',
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
