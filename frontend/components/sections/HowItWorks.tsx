'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { UserPlus, BookOpen, Rocket } from 'lucide-react';

const steps = [
    {
        icon: UserPlus,
        title: 'Sign up as a Creator',
        description: 'Free forever. No credit card required.',
        detail: 'Get your personal school in under 2 minutes.',
    },
    {
        icon: BookOpen,
        title: 'Build your school',
        description: 'Courses, lessons, quizzes, assignments, and exams.',
        detail: 'Use the drag-and-drop builder or AI generation.',
    },
    {
        icon: Rocket,
        title: 'Launch and grow',
        description: 'Invite students, issue certificates, track progress.',
        detail: 'Scale from 1 to 1,000+ learners seamlessly.',
    },
];

export default function HowItWorks() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    return (
        <section
            ref={ref}
            className="py-20 sm:py-28 relative overflow-hidden"
            style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}
        >
            {/* Background accent */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute"
                    style={{
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '800px',
                        height: '400px',
                        background: 'radial-gradient(ellipse at center, rgba(0,141,152,0.03) 0%, transparent 70%)',
                    }}
                />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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
                    <div className="hidden lg:block absolute top-[60px] left-[16%] right-[16%]">
                        <div className="relative h-0.5" style={{ backgroundColor: '#E2E8F0' }}>
                            <motion.div
                                initial={{ width: '0%' }}
                                animate={inView ? { width: '100%' } : {}}
                                transition={{ delay: 0.4, duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
                                className="absolute inset-y-0 left-0 h-full rounded-full"
                                style={{
                                    background: 'linear-gradient(90deg, #008D98, #10B981)',
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-8 lg:gap-12 relative z-10">
                        {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <motion.div
                                    key={step.title}
                                    initial={{ opacity: 0, y: 28 }}
                                    animate={inView ? { opacity: 1, y: 0 } : {}}
                                    transition={{
                                        delay: 0.15 + i * 0.18,
                                        duration: 0.48,
                                        ease: [0.25, 0.1, 0.25, 1],
                                    }}
                                    className="text-center group"
                                >
                                    {/* Step card */}
                                    <div className="flex justify-center mb-5">
                                        <div
                                            className="w-[120px] h-[120px] rounded-3xl flex flex-col items-center justify-center relative transition-all duration-300"
                                            style={{
                                                backgroundColor: 'rgba(255,255,255,0.85)',
                                                backdropFilter: 'blur(12px)',
                                                border: '1px solid rgba(226,232,240,0.8)',
                                                boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow =
                                                    '0 8px 32px rgba(0,141,152,0.12), 0 2px 8px rgba(0,0,0,0.04)';
                                                e.currentTarget.style.borderColor = 'rgba(0,141,152,0.2)';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow =
                                                    '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)';
                                                e.currentTarget.style.borderColor = 'rgba(226,232,240,0.8)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <Icon size={32} style={{ color: '#008D98' }} />
                                            {/* Step number badge */}
                                            <span
                                                className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                                style={{
                                                    background: 'linear-gradient(135deg, #008D98, #006F78)',
                                                    boxShadow: '0 2px 8px rgba(0,141,152,0.3)',
                                                }}
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
                                        className="text-sm leading-relaxed max-w-xs mx-auto mb-1"
                                        style={{ color: '#475569' }}
                                    >
                                        {step.description}
                                    </p>
                                    <p className="text-xs" style={{ color: '#94A3B8' }}>
                                        {step.detail}
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
