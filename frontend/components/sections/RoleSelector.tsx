'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import {
    Palette,
    Globe,
    Shield,
    Award,
    BarChart3,
    BookOpen,
    Users,
    GraduationCap,
    CheckCircle,
    Layers,
} from 'lucide-react';

const creatorBenefits = [
    { icon: Globe, text: 'Your own domain, your own brand — fully white-labeled' },
    { icon: BookOpen, text: 'Courses for any subject: lessons, quizzes, units, and resources' },
    { icon: Shield, text: 'Proctored exams with test codes, IP tracking, tab detection' },
    { icon: Award, text: 'Verifiable certificates with unique QR codes' },
    { icon: BarChart3, text: 'Student analytics and real-time progress tracking' },
    { icon: Palette, text: 'Custom logo, colors, and domain on paid plans' },
];

const learnerBenefits = [
    { icon: BookOpen, text: 'Rich course content with video, text, and interactive exercises' },
    { icon: CheckCircle, text: 'Answer MCQ, multi-select, reading, coding, web, and notebook questions' },
    { icon: GraduationCap, text: 'Take proctored exams that prove your skills' },
    { icon: Award, text: 'Earn verifiable certificates with QR code proof' },
    { icon: Users, text: 'Join any school that uses Mentrily — one account' },
    { icon: Layers, text: 'Track your progress across all enrolled courses' },
];

const personas = [
    {
        id: 'creator' as const,
        title: "I'm a Creator",
        subtitle: 'Educators, trainers & institutions',
        description: 'Build your branded school with courses, exams, and certificates.',
        benefits: creatorBenefits,
        accent: '#008D98',
    },
    {
        id: 'learner' as const,
        title: "I'm a Learner",
        subtitle: 'Students, professionals & self-learners',
        description: 'Enroll in courses, take exams, and earn verified certificates.',
        benefits: learnerBenefits,
        accent: '#10B981',
    },
];

export default function RoleSelector() {
    const [role, setRole] = useState<'creator' | 'learner'>('creator');
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });
    const activePersona = personas.find((p) => p.id === role)!;

    return (
        <section ref={ref} className="py-20 sm:py-28 relative overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
            {/* Subtle background mesh */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute animate-mesh-drift"
                    style={{
                        top: '10%',
                        left: '60%',
                        width: '600px',
                        height: '600px',
                        background: 'radial-gradient(circle, rgba(0,141,152,0.04) 0%, transparent 60%)',
                    }}
                />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section heading */}
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                    className="text-center mb-12"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#008D98' }} />
                        <span className="text-sm font-medium uppercase tracking-widest" style={{ color: '#008D98' }}>
                            Built for two roles
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
                        Who are you?
                    </h2>
                </motion.div>

                {/* Persona selector cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.1, duration: 0.48 }}
                    className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-14"
                >
                    {personas.map((persona) => (
                        <button
                            key={persona.id}
                            onClick={() => setRole(persona.id)}
                            className="relative p-5 rounded-2xl text-left transition-all duration-250 cursor-pointer group"
                            style={{
                                backgroundColor: role === persona.id ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                                border: role === persona.id ? `2px solid ${persona.accent}` : '2px solid #E2E8F0',
                                boxShadow:
                                    role === persona.id
                                        ? `0 4px 20px ${persona.accent}22, 0 2px 8px rgba(0,0,0,0.04)`
                                        : '0 1px 3px rgba(0,0,0,0.06)',
                            }}
                        >
                            {role === persona.id && (
                                <motion.div
                                    layoutId="persona-indicator"
                                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full"
                                    style={{ backgroundColor: persona.accent }}
                                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                />
                            )}
                            <h3
                                className="text-base font-semibold mb-0.5"
                                style={{
                                    color: role === persona.id ? persona.accent : '#0F172A',
                                    fontFamily: 'var(--font-body)',
                                }}
                            >
                                {persona.title}
                            </h3>
                            <p className="text-xs" style={{ color: '#64748B' }}>
                                {persona.subtitle}
                            </p>
                        </button>
                    ))}
                </motion.div>

                {/* Active persona content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={role}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3 }}
                        className="mx-auto max-w-5xl"
                    >
                        <div className="text-center">
                            <p
                                className="mx-auto mb-8 max-w-2xl text-balance text-lg leading-relaxed"
                                style={{ color: '#334155', fontFamily: 'var(--font-body)' }}
                            >
                                {activePersona.description}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {activePersona.benefits.map((item, i) => {
                                    const Icon = item.icon;
                                    return (
                                        <motion.div
                                            key={`${role}-${i}`}
                                            initial={{ opacity: 0, x: 12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.06, duration: 0.35 }}
                                            className="flex h-full items-start gap-3 rounded-xl p-4 text-left transition-all duration-200 cursor-pointer group"
                                            style={{
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #E2E8F0',
                                                boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#E2E8F0';
                                                e.currentTarget.style.boxShadow = `0 8px 24px ${activePersona.accent}18`;
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = '#E2E8F0';
                                                e.currentTarget.style.boxShadow = '0 2px 10px rgba(15,23,42,0.04)';
                                            }}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: `${activePersona.accent}12` }}
                                            >
                                                <Icon size={16} style={{ color: activePersona.accent }} />
                                            </div>
                                            <p
                                                className="text-sm leading-relaxed pt-1"
                                                style={{ color: '#475569', fontFamily: 'var(--font-body)' }}
                                            >
                                                {item.text}
                                            </p>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </section>
    );
}
