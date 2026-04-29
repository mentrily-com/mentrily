'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { UserPlus, BookOpen, Rocket } from 'lucide-react';

const steps = [
    {
        icon: UserPlus,
        title: 'Sign up as a Creator',
        description: 'Free forever. No credit card required.',
    },
    {
        icon: BookOpen,
        title: 'Build your school',
        description: 'Courses, lessons, quizzes, assignments, and exams.',
    },
    {
        icon: Rocket,
        title: 'Launch and grow',
        description: 'Invite students, issue certificates, track progress.',
    },
];

export default function HowItWorks() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    return (
        <section
            ref={ref}
            className="py-20 sm:py-28"
            style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}
        >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section heading */}
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                    className="text-center mb-16"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#008D98' }} />
                        <span className="text-sm font-medium uppercase tracking-widest" style={{ color: '#008D98' }}>
                            How it works
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
                        Three steps to your own school
                    </h2>
                </motion.div>

                {/* Steps */}
                <div className="relative">
                    {/* Connecting line (desktop only) */}
                    <motion.div
                        initial={{ width: '0%' }}
                        animate={inView ? { width: '100%' } : {}}
                        transition={{ delay: 0.3, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                        className="hidden lg:block absolute top-12 left-[16%] h-0.5"
                        style={{
                            backgroundColor: '#E6F7F8',
                            right: '16%',
                            width: 'calc(68%)',
                            maxWidth: 'calc(68%)',
                        }}
                    />

                    <div className="grid sm:grid-cols-3 gap-8 lg:gap-12 relative z-10">
                        {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <motion.div
                                    key={step.title}
                                    initial={{ opacity: 0, y: 28 }}
                                    animate={inView ? { opacity: 1, y: 0 } : {}}
                                    transition={{
                                        delay: 0.15 + i * 0.15,
                                        duration: 0.48,
                                        ease: [0.25, 0.1, 0.25, 1],
                                    }}
                                    className="text-center"
                                >
                                    {/* Step circle */}
                                    <div className="flex justify-center mb-5">
                                        <div
                                            className="w-24 h-24 rounded-2xl flex items-center justify-center relative"
                                            style={{
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #E2E8F0',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                            }}
                                        >
                                            <Icon size={32} style={{ color: '#008D98' }} />
                                            <span
                                                className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                                                style={{ backgroundColor: '#008D98' }}
                                            >
                                                {i + 1}
                                            </span>
                                        </div>
                                    </div>

                                    <h3
                                        className="text-lg font-semibold mb-2"
                                        style={{ color: '#0F172A', fontFamily: 'var(--font-body)' }}
                                    >
                                        {step.title}
                                    </h3>
                                    <p
                                        className="text-sm leading-relaxed max-w-xs mx-auto"
                                        style={{ color: '#475569' }}
                                    >
                                        {step.description}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
