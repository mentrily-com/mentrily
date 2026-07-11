'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';

export default function AboutPage() {
    return (
        <div className="pt-24" style={{ backgroundColor: '#FFFFFF' }}>
            <OpeningDeclaration />
            <Mission />
            <ProductPhilosophy />
            <Values />
            <Timeline />
            {/* <Team /> */}
        </div>
    );
}

/* ── Opening Declaration ── */
function OpeningDeclaration() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    return (
        <section ref={ref} className="py-16 sm:py-24">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.h1
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                    className="mb-8"
                    style={{
                        fontFamily: 'var(--font-display), Georgia, serif',
                        fontSize: 'clamp(32px, 4.5vw, 48px)',
                        fontWeight: 300,
                        fontStyle: 'italic',
                        lineHeight: 1.2,
                        letterSpacing: '-0.02em',
                        color: '#0F172A',
                    }}
                >
                    Most LMS tools were built in a world where teaching tech meant uploading a PDF.
                </motion.h1>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.15, duration: 0.48 }}
                    className="space-y-4"
                >
                    <p
                        className="leading-relaxed"
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '17px',
                            lineHeight: 1.65,
                            color: '#475569',
                        }}
                    >
                        The world moved on. Bootcamps replaced textbooks. Live coding replaced slide decks. Students
                        expect to write code, run it, and get feedback — not download a Word document. But the tools
                        educators use haven&apos;t caught up. Moodle is a maze. Canvas is built for universities with IT
                        departments. Google Classroom is a shared folder.
                    </p>
                    <p
                        className="leading-relaxed"
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '17px',
                            lineHeight: 1.65,
                            color: '#475569',
                        }}
                    >
                        Mentrily exists because we believe every educator deserves a platform that matches how people
                        actually learn to code today. A platform that&apos;s theirs — their brand, their domain, their
                        school. Not a marketplace. Not a plugin. A school.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}

/* ── Mission ── */
function Mission() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    return (
        <section
            ref={ref}
            className="py-16 sm:py-20"
            style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}
        >
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48 }}
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-0.5" style={{ backgroundColor: '#008D98' }} />
                    </div>
                    <p
                        style={{
                            fontFamily: 'var(--font-display), Georgia, serif',
                            fontSize: 'clamp(20px, 3vw, 28px)',
                            fontWeight: 400,
                            lineHeight: 1.4,
                            color: '#0F172A',
                        }}
                    >
                        We built Mentrily so that any educator — from a solo bootcamp founder to a university department
                        — can launch a school that actually matches how people learn to code today.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}

/* ── Product Philosophy ── */
function ProductPhilosophy() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    return (
        <section ref={ref} className="py-16 sm:py-20" style={{ borderTop: '1px solid #E2E8F0' }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48 }}
                    className="text-center mb-12"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-0.5" style={{ backgroundColor: '#008D98' }} />
                    </div>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
                    <motion.div
                        initial={{ opacity: 0, x: -24 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.1, duration: 0.5 }}
                    >
                        <h3
                            className="mb-6"
                            style={{
                                fontFamily: 'var(--font-display), Georgia, serif',
                                fontSize: '22px',
                                fontWeight: 400,
                                color: '#0F172A',
                            }}
                        >
                            Built for educators who code.
                        </h3>
                        <ul className="space-y-4">
                            {[
                                'Create courses with embedded coding exercises, not just quizzes.',
                                'Set up proctored exams with real security — not honor system checkboxes.',
                                'Issue certificates that verify on-demand, no PDF forgery possible.',
                                'Build course units, tests, guidelines, and coding templates from one focused studio.',
                                'Track learner progress around real submissions, attempts, and practical work.',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <div
                                        className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                                        style={{ backgroundColor: '#008D98' }}
                                    />
                                    <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                                        {item}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        <h3
                            className="mb-6"
                            style={{
                                fontFamily: 'var(--font-display), Georgia, serif',
                                fontSize: '22px',
                                fontWeight: 400,
                                color: '#0F172A',
                            }}
                        >
                            Built for coders who teach.
                        </h3>
                        <ul className="space-y-4">
                            {[
                                '33 programming languages with sandboxed execution. Not a plugin — built in.',
                                'Web editor and Python notebooks for interactive exercises.',
                                'AI exam generation — let the AI read your course content and write the quiz.',
                                'Reusable test cases and starter code keep grading consistent across every cohort.',
                                'Fast previews, saved attempts, and submission history make debugging teachable.',
                            ].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <div
                                        className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                                        style={{ backgroundColor: '#008D98' }}
                                    />
                                    <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                                        {item}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

/* ── Values ── */
function Values() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    const values = [
        {
            title: 'Ownership over renting',
            description: 'Your school, your data, your brand. Not a marketplace.',
        },
        {
            title: 'Simplicity that scales',
            description: "Free plan works immediately. Pro plan doesn't require an IT team.",
        },
        {
            title: 'Code as a first-class citizen',
            description: 'Not an afterthought plugin. 33 languages, sandboxed, graded instantly.',
        },
        {
            title: 'Your brand, not ours',
            description: 'We disappear. Your students see your school, not Mentrily.',
        },
    ];

    return (
        <section
            ref={ref}
            className="py-16 sm:py-20"
            style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}
        >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48 }}
                    className="text-center mb-12"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-0.5" style={{ backgroundColor: '#008D98' }} />
                    </div>
                </motion.div>

                <div className="grid sm:grid-cols-2 gap-5">
                    {values.map((val, i) => (
                        <motion.div
                            key={val.title}
                            initial={{ opacity: 0, y: 28 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{
                                delay: 0.1 + i * 0.12,
                                duration: 0.48,
                            }}
                            className="p-6 rounded-2xl transition-all duration-200 cursor-pointer"
                            style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                                e.currentTarget.style.borderColor = '#CBD5E1';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                            }}
                        >
                            <h4
                                className="text-base font-semibold mb-2"
                                style={{ color: '#0F172A', fontFamily: 'var(--font-body)' }}
                            >
                                {val.title}
                            </h4>
                            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                                {val.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ── Timeline ── */
function Timeline() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    const milestones = [
        { year: '2023', label: 'Founded' },
        { year: '2024', label: '100+ courses tested' },
        { year: '2025', label: '33-language live code execution shipped' },
        { year: '2026', label: 'AI exam generation + verifiable certificates' },
    ];

    return (
        <section ref={ref} className="py-16 sm:py-20" style={{ borderTop: '1px solid #E2E8F0' }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48 }}
                    className="text-center mb-14"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-0.5" style={{ backgroundColor: '#008D98' }} />
                    </div>
                </motion.div>

                {/* Desktop horizontal timeline */}
                <div className="hidden sm:block relative">
                    {/* Connecting line */}
                    <div className="absolute top-6 left-[12%] right-[12%] h-0.5" style={{ backgroundColor: '#E2E8F0' }}>
                        <motion.div
                            initial={{ width: '0%' }}
                            animate={inView ? { width: '100%' } : {}}
                            transition={{ delay: 0.2, duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
                            className="h-full"
                            style={{ backgroundColor: '#E6F7F8' }}
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-4 relative z-10">
                        {milestones.map((m, i) => (
                            <motion.div
                                key={m.year}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={inView ? { opacity: 1, scale: 1 } : {}}
                                transition={{
                                    delay: 0.3 + i * 0.25,
                                    duration: 0.3,
                                    ease: [0.25, 0.1, 0.25, 1],
                                }}
                                className="text-center"
                            >
                                {/* Dot */}
                                <div className="flex justify-center mb-4">
                                    <motion.div
                                        animate={
                                            inView
                                                ? {
                                                      boxShadow: [
                                                          '0 0 0 0 rgba(0,141,152,0.22)',
                                                          '0 0 0 10px rgba(0,141,152,0)',
                                                          '0 0 0 0 rgba(0,141,152,0)',
                                                      ],
                                                  }
                                                : {}
                                        }
                                        transition={{
                                            delay: 0.7 + i * 0.2,
                                            duration: 1.6,
                                            repeat: Infinity,
                                            repeatDelay: 1.4,
                                        }}
                                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold"
                                        style={{
                                            backgroundColor: '#E6F7F8',
                                            border: '2px solid #008D98',
                                            color: '#008D98',
                                            fontFamily: 'var(--font-body)',
                                        }}
                                    >
                                        {m.year}
                                    </motion.div>
                                </div>
                                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>
                                    {m.label}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Mobile vertical timeline */}
                <div className="sm:hidden space-y-6">
                    {milestones.map((m, i) => (
                        <motion.div
                            key={m.year}
                            initial={{ opacity: 0, x: -20 }}
                            animate={inView ? { opacity: 1, x: 0 } : {}}
                            transition={{ delay: 0.1 + i * 0.15, duration: 0.48 }}
                            className="flex items-center gap-4"
                        >
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                                style={{
                                    backgroundColor: '#E6F7F8',
                                    border: '2px solid #008D98',
                                    color: '#008D98',
                                }}
                            >
                                {m.year}
                            </div>
                            <p className="text-sm font-medium" style={{ color: '#0F172A' }}>
                                {m.label}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ── Team ── */
function Team() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    const members = [
        {
            initials: 'SY',
            name: 'Suman Yadav',
            title: 'Founder',
            bio: 'Builds practical learning tools for educators who want coding, exams, and certificates in one place.',
            color: '#008D98',
        },
        {
            initials: 'DY',
            name: 'DK Yadav',
            title: 'Co-founder',
            bio: 'Focuses on the product and engineering systems that keep course creation and exam delivery reliable.',
            color: '#10B981',
        },
    ];

    return (
        <section
            ref={ref}
            className="py-16 sm:py-20"
            style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}
        >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48 }}
                    className="text-center mb-12"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-0.5" style={{ backgroundColor: '#008D98' }} />
                    </div>
                </motion.div>

                <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
                    {members.map((m, i) => (
                        <motion.div
                            key={m.name}
                            initial={{ opacity: 0, y: 28 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ delay: 0.1 + i * 0.1, duration: 0.48 }}
                            className="text-center p-6 rounded-2xl transition-all duration-200"
                            style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            }}
                        >
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-semibold text-white mx-auto mb-4"
                                style={{ backgroundColor: m.color }}
                            >
                                {m.initials}
                            </div>
                            <h4 className="text-sm font-semibold mb-0.5" style={{ color: '#0F172A' }}>
                                {m.name}
                            </h4>
                            <p className="text-xs mb-3" style={{ color: '#008D98' }}>
                                {m.title}
                            </p>
                            <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>
                                {m.bio}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
