'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { Star } from 'lucide-react';

const testimonials = [
    {
        quote: 'I was spending more time fighting Moodle than teaching. With Mentrily, I built a full course in a weekend: lessons, quizzes, assignments, exams, and certificates — all under my brand.',
        name: 'Priya Sharma',
        title: 'Academy Founder, SkillCraft Learning',
        initials: 'PS',
        color: '#008D98',
        stars: 5,
    },
    {
        quote: 'We onboarded 400 learners last quarter using Mentrily. The course builder, proctored assessments, progress tracking, and certificate verification gave our training team one place to manage everything.',
        name: 'Marcus Chen',
        title: 'Corporate Training Lead, Finova Inc.',
        initials: 'MC',
        color: '#10B981',
        stars: 5,
    },
    {
        quote: 'As a solo educator, I needed something simpler than Canvas but more serious than a shared folder. I can teach, test, review submissions, and issue certificates without stitching five tools together.',
        name: 'Fatima Osei',
        title: 'Independent Educator, Data Fluency',
        initials: 'FO',
        color: '#F59E0B',
        stars: 5,
    },
];

export default function Testimonials() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    return (
        <section ref={ref} className="py-20 sm:py-28" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section heading */}
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                    className="text-center mb-14"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#008D98' }} />
                        <span className="text-sm font-medium uppercase tracking-widest" style={{ color: '#008D98' }}>
                            Testimonials
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
                        Educators trust Mentrily
                    </h2>
                    <p
                        className="mt-3 text-sm"
                        style={{ color: '#64748B' }}
                    >
                        Hear from creators who made the switch.
                    </p>
                </motion.div>

                {/* Quote cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={t.name}
                            initial={{ opacity: 0, y: 28 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{
                                delay: 0.15 + i * 0.12,
                                duration: 0.48,
                                ease: [0.25, 0.1, 0.25, 1],
                            }}
                            className="relative p-6 rounded-2xl transition-all duration-250 cursor-pointer group"
                            style={{
                                background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFF 100%)',
                                border: '1px solid #E2E8F0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-3px)';
                                e.currentTarget.style.boxShadow =
                                    '0 8px 24px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)';
                                e.currentTarget.style.borderColor = t.color + '30';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow =
                                    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                            }}
                        >
                            {/* Large quote icon with gradient */}
                            <div className="mb-4">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                                    <defs>
                                        <linearGradient id={`quote-grad-${i}`} x1="0" y1="0" x2="24" y2="24">
                                            <stop offset="0%" stopColor="#008D98" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"
                                        fill={`url(#quote-grad-${i})`}
                                    />
                                    <path
                                        d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"
                                        fill={`url(#quote-grad-${i})`}
                                    />
                                </svg>
                            </div>

                            {/* Star rating */}
                            <div className="flex items-center gap-0.5 mb-3">
                                {Array.from({ length: t.stars }).map((_, si) => (
                                    <Star
                                        key={si}
                                        size={14}
                                        fill="#F59E0B"
                                        stroke="#F59E0B"
                                        strokeWidth={0}
                                    />
                                ))}
                            </div>

                            <p
                                className="text-sm leading-relaxed mb-6"
                                style={{ color: '#475569', fontFamily: 'var(--font-body)' }}
                            >
                                &ldquo;{t.quote}&rdquo;
                            </p>

                            {/* Separator */}
                            <div className="h-px mb-4" style={{ backgroundColor: '#F1F5F9' }} />

                            {/* Attribution */}
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                                    style={{
                                        background: `linear-gradient(135deg, ${t.color}, ${t.color}CC)`,
                                        boxShadow: `0 2px 8px ${t.color}30`,
                                    }}
                                >
                                    {t.initials}
                                </div>
                                <div>
                                    <p className="text-sm font-medium" style={{ color: '#0F172A' }}>
                                        {t.name}
                                    </p>
                                    <p className="text-xs" style={{ color: '#94A3B8' }}>
                                        {t.title}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
