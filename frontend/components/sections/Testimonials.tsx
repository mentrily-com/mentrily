'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { Quote } from 'lucide-react';

const testimonials = [
    {
        quote: 'I was spending more time fighting Moodle than teaching. With Mentrily, I built a full course in a weekend: lessons, quizzes, assignments, exams, and certificates — all under my brand.',
        name: 'Priya Sharma',
        title: 'Academy Founder, SkillCraft Learning',
        initials: 'PS',
        color: '#008D98',
    },
    {
        quote: 'We onboarded 400 learners last quarter using Mentrily. The course builder, proctored assessments, progress tracking, and certificate verification gave our training team one place to manage everything.',
        name: 'Marcus Chen',
        title: 'Corporate Training Lead, Finova Inc.',
        initials: 'MC',
        color: '#10B981',
    },
    {
        quote: 'As a solo educator, I needed something simpler than Canvas but more serious than a shared folder. I can teach, test, review submissions, and issue certificates without stitching five tools together.',
        name: 'Fatima Osei',
        title: 'Independent Educator, Data Fluency',
        initials: 'FO',
        color: '#F59E0B',
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
                            className="p-6 rounded-2xl transition-all duration-200 cursor-pointer"
                            style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow =
                                    '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)';
                                e.currentTarget.style.borderColor = '#CBD5E1';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow =
                                    '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                            }}
                        >
                            <Quote size={24} style={{ color: '#E6F7F8' }} className="mb-4" />
                            <p
                                className="text-sm leading-relaxed mb-6"
                                style={{ color: '#475569', fontFamily: 'var(--font-body)' }}
                            >
                                {t.quote}
                            </p>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                                    style={{ backgroundColor: t.color }}
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
