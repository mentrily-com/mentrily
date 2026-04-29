'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { Palette, Globe, Shield, Award, BarChart3, BookOpen, Users, GraduationCap, CheckCircle } from 'lucide-react';

const creatorBenefits = [
    { icon: Globe, text: 'Your own domain, your own brand — fully white-labeled' },
    { icon: BookOpen, text: 'Courses for any subject with lessons, quizzes, units, and resources' },
    { icon: Shield, text: 'Proctored exams with test codes, IP tracking, tab detection' },
    { icon: Award, text: 'Verifiable certificates with unique QR codes' },
    { icon: BarChart3, text: 'Student analytics and progress tracking' },
    { icon: Palette, text: 'Custom logo, colors, and domain on paid plans' },
];

const learnerBenefits = [
    { icon: BookOpen, text: 'Rich course content with video, text, and interactive exercises' },
    { icon: CheckCircle, text: 'Answer MCQ, multi-select, reading, coding, web, and notebook questions' },
    { icon: GraduationCap, text: 'Take proctored exams that prove your skills' },
    { icon: Award, text: 'Earn verifiable certificates with QR code proof' },
    { icon: Users, text: 'Join any school that uses Mentrily — one account' },
    { icon: CheckCircle, text: 'Track your progress across all enrolled courses' },
];

export default function RoleSelector() {
    const [role, setRole] = useState<'creator' | 'learner'>('creator');
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });
    const benefits = role === 'creator' ? creatorBenefits : learnerBenefits;

    return (
        <section ref={ref} className="py-20 sm:py-28" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

                {/* Tab strip */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.1, duration: 0.48 }}
                    className="flex justify-center mb-14"
                >
                    <div
                        className="inline-flex p-1 rounded-lg relative"
                        style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }}
                    >
                        {/* Sliding pill */}
                        <motion.div
                            className="absolute top-1 bottom-1 rounded-md"
                            style={{
                                backgroundColor: '#FFFFFF',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                                width: 'calc(50% - 4px)',
                            }}
                            animate={{ left: role === 'creator' ? '4px' : 'calc(50%)' }}
                            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        />
                        <button
                            onClick={() => setRole('creator')}
                            className="relative z-10 px-6 sm:px-8 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 cursor-pointer"
                            style={{ color: role === 'creator' ? '#008D98' : '#475569' }}
                        >
                            I&apos;m a Creator
                        </button>
                        <button
                            onClick={() => setRole('learner')}
                            className="relative z-10 px-6 sm:px-8 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 cursor-pointer"
                            style={{ color: role === 'learner' ? '#008D98' : '#475569' }}
                        >
                            I&apos;m a Learner
                        </button>
                    </div>
                </motion.div>

                {/* Benefits grid */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={role}
                        initial={{ opacity: 0, x: role === 'creator' ? -12 : 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: role === 'creator' ? 12 : -12 }}
                        transition={{ duration: 0.2 }}
                        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto"
                    >
                        {benefits.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <motion.div
                                    key={`${role}-${i}`}
                                    initial={{ opacity: 0, y: 28 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.09, duration: 0.48 }}
                                    className="flex items-start gap-4 p-5 rounded-2xl transition-all duration-200 cursor-pointer group"
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
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: '#E6F7F8' }}
                                    >
                                        <Icon size={20} style={{ color: '#008D98' }} />
                                    </div>
                                    <p
                                        className="text-sm leading-relaxed"
                                        style={{ color: '#475569', fontFamily: 'var(--font-body)' }}
                                    >
                                        {item.text}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                </AnimatePresence>
            </div>
        </section>
    );
}
