'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { heroWordStagger, heroWord } from '@/lib/animations';
import { siteConfig } from '@/app/config/site';
import { ArrowRight } from 'lucide-react';
import ImagePreviewModal, { type PreviewImage } from '@/components/ui/ImagePreviewModal';

export default function Hero() {
    const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

    const heroImage = {
        src: '/images/dashboard-learner-preview.jpg',
        alt: `${siteConfig.name} learner dashboard with course modules, daily streak, and analytics`,
    };

    return (
        <section
            className="relative min-h-screen flex items-center overflow-hidden pt-20 pb-16"
            style={{ backgroundColor: '#FAFBFF' }}
        >
            {/* ── Gradient mesh background ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Primary teal orb */}
                <div
                    className="absolute animate-mesh-drift"
                    style={{
                        top: '-15%',
                        right: '-10%',
                        width: '900px',
                        height: '900px',
                        background: 'radial-gradient(circle at center, rgba(0,141,152,0.08) 0%, transparent 60%)',
                    }}
                />
                {/* Secondary emerald orb */}
                <div
                    className="absolute animate-mesh-drift"
                    style={{
                        bottom: '-20%',
                        left: '-15%',
                        width: '700px',
                        height: '700px',
                        background: 'radial-gradient(circle at center, rgba(16,185,129,0.05) 0%, transparent 60%)',
                        animationDelay: '-8s',
                    }}
                />
                {/* Subtle dot pattern */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(#CBD5E1 0.8px, transparent 0.8px)',
                        backgroundSize: '28px 28px',
                        opacity: 0.25,
                    }}
                />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="grid lg:grid-cols-[minmax(460px,0.85fr)_minmax(0,1.15fr)] gap-12 lg:gap-10 items-center">
                    {/* ── Left: Copy ── */}
                    <div className="max-w-xl">
                        {/* Headline */}
                        <motion.h1 variants={heroWordStagger} initial="hidden" animate="visible" className="mb-6">
                            {['Your', 'school.', 'Your', 'brand.'].map((word, i) => (
                                <motion.span
                                    key={i}
                                    variants={heroWord}
                                    className="inline-block mr-3"
                                    style={{
                                        fontFamily: 'var(--font-display), Georgia, serif',
                                        fontSize: 'clamp(38px, 5.2vw, 68px)',
                                        fontWeight: 300,
                                        lineHeight: 1.08,
                                        letterSpacing: '-0.03em',
                                        color: '#0F172A',
                                    }}
                                >
                                    {word}
                                </motion.span>
                            ))}
                            <br />
                            <span className="relative inline-block pb-3">
                                <motion.span
                                    variants={heroWord}
                                    className="inline-block mr-3"
                                    style={{
                                        fontFamily: 'var(--font-display), Georgia, serif',
                                        fontSize: 'clamp(38px, 5.2vw, 68px)',
                                        fontWeight: 500,
                                        fontStyle: 'italic',
                                        lineHeight: 1.08,
                                        letterSpacing: '-0.03em',
                                        color: '#0F172A',
                                    }}
                                >
                                    Launch
                                </motion.span>
                                <motion.span
                                    variants={heroWord}
                                    className="mr-3 inline-block"
                                    style={{
                                        fontFamily: 'var(--font-display), Georgia, serif',
                                        fontSize: 'clamp(38px, 5.2vw, 68px)',
                                        fontWeight: 500,
                                        fontStyle: 'italic',
                                        lineHeight: 1.08,
                                        letterSpacing: '-0.03em',
                                        color: '#0F172A',
                                    }}
                                >
                                    today.
                                </motion.span>
                                <motion.div
                                    aria-hidden="true"
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                    className="absolute bottom-0 left-0 h-1.5 origin-left rounded-full"
                                    style={{
                                        width: '100%',
                                        background: 'linear-gradient(90deg, #008D98, #10B981)',
                                    }}
                                />
                            </span>
                        </motion.h1>

                        {/* Sub-headline */}
                        <motion.p
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.42, duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
                            className="mb-8 leading-relaxed max-w-lg"
                            style={{
                                fontFamily: 'var(--font-body), system-ui, sans-serif',
                                fontSize: '18px',
                                lineHeight: 1.7,
                                color: '#475569',
                                fontWeight: 500,
                            }}
                        >
                            Join educators who chose ownership over renting.
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
                                className="group inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 cursor-pointer"
                                style={{
                                    background: 'linear-gradient(135deg, #008D98 0%, #006F78 100%)',
                                    boxShadow: '0 4px 16px rgba(0,141,152,0.25)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,141,152,0.35)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,141,152,0.25)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                Start for Free
                                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                            </Link>
                            <Link
                                href="/pricing"
                                className="inline-flex items-center px-7 py-3.5 text-sm font-semibold rounded-xl border transition-all duration-200 cursor-pointer"
                                style={{
                                    color: '#008D98',
                                    borderColor: '#E2E8F0',
                                    backgroundColor: 'rgba(255,255,255,0.7)',
                                    backdropFilter: 'blur(8px)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                                    e.currentTarget.style.borderColor = '#008D98';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,141,152,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.7)';
                                    e.currentTarget.style.borderColor = '#E2E8F0';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                See Pricing
                            </Link>
                        </motion.div>
                    </div>

                    {/* ── Right: Dashboard preview with 3D tilt ── */}
                    <motion.div
                        initial={{ opacity: 0, x: 40, rotateY: -5 }}
                        animate={{ opacity: 1, x: 0, rotateY: 0 }}
                        transition={{
                            delay: 0.9,
                            duration: 0.6,
                            ease: [0.16, 1, 0.3, 1],
                        }}
                        className="hidden lg:flex justify-center"
                        style={{ perspective: '1200px' }}
                    >
                        <button
                            type="button"
                            className="relative w-[min(56vw,880px)] overflow-hidden rounded-2xl text-left transition-all duration-500 xl:w-[min(57vw,920px)]"
                            style={{
                                border: '1px solid rgba(226,232,240,0.8)',
                                boxShadow: '0 32px 80px rgba(15,23,42,0.12), 0 12px 32px rgba(15,23,42,0.08), 0 0 0 1px rgba(255,255,255,0.5) inset',
                                transformStyle: 'preserve-3d',
                            }}
                            onClick={() => setPreviewImage(heroImage)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'rotateY(-2deg) rotateX(1deg) translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 40px 100px rgba(0,141,152,0.15), 0 16px 40px rgba(15,23,42,0.1), 0 0 0 1px rgba(0,141,152,0.1) inset';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'rotateY(0) rotateX(0) translateY(0)';
                                e.currentTarget.style.boxShadow = '0 32px 80px rgba(15,23,42,0.12), 0 12px 32px rgba(15,23,42,0.08), 0 0 0 1px rgba(255,255,255,0.5) inset';
                            }}
                        >
                            {/* Screenshot */}
                            <div className="relative aspect-[1919/938] overflow-hidden bg-[#F8FAFC]">
                                <Image
                                    src={heroImage.src}
                                    alt={heroImage.alt}
                                    fill
                                    priority
                                    sizes="(min-width: 1024px) 64vw, 100vw"
                                    className="object-cover"
                                />
                                <div
                                    className="pointer-events-none absolute inset-0"
                                    style={{
                                        boxShadow: 'inset 0 0 0 1px rgba(226,232,240,0.5)',
                                    }}
                                />
                            </div>
                        </button>
                    </motion.div>
                </div>
            </div>
            <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
        </section>
    );
}
