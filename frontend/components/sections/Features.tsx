'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import BrowserFrame from '@/components/ui/BrowserFrame';

export default function Features() {
    return (
        <section className="py-20 sm:py-28" style={{ backgroundColor: '#FFFFFF' }} id="features">
            <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section heading */}
                <div className="text-center mb-16 sm:mb-20">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#008D98' }} />
                        <span className="text-sm font-medium uppercase tracking-widest" style={{ color: '#008D98' }}>
                            Platform
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
                        Everything your school needs
                    </h2>
                </div>

                <div className="space-y-24 sm:space-y-32">
                    {/* Feature 1: Course Builder */}
                    <FeatureRow
                        title="Build courses for any subject."
                        description="Create structured modules with reading lessons, MCQs, multi-select questions, assignments, tests, guidelines, and certificates. Add coding, web, or notebook tasks when you need them, but the same builder works for business, school, training, exam prep, and skills programs."
                        mockup={<CourseExamBuilderMockup />}
                        direction="left"
                    />

                    {/* Feature 2: Proctored Exams */}
                    <FeatureRow
                        title="Assessments for every subject."
                        description="Build quizzes, tests, and proctored exams with MCQ, multi-select, reading, web, notebook, and coding questions. Test codes, invite links, IP allowlists, timers, tab-switch limits, and AI proctoring help keep high-stakes exams controlled."
                        mockup={<ExamMockup />}
                        direction="right"
                    />

                    {/* Feature 3: Interactive Workspaces */}
                    <FeatureRow
                        title="Go interactive when the course needs it."
                        description="For technical or hands-on programs, students can run code, build web pages, and work in Python notebooks directly in the browser. For non-coding courses, keep things simple with lessons, quizzes, submissions, exams, progress tracking, and certificates."
                        mockup={<QuestionShowcase />}
                        direction="left"
                    />
                </div>
            </div>
        </section>
    );
}

function FeatureRow({
    title,
    description,
    mockup,
    direction,
}: {
    title: string;
    description: string;
    mockup: React.ReactNode;
    direction: 'left' | 'right';
}) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12 });

    const textX = direction === 'left' ? -24 : 24;
    const mockupX = direction === 'left' ? 24 : -24;

    return (
        <div
            ref={ref}
            className={`grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-14 xl:gap-16 items-center ${
                direction === 'right' ? 'lg:flex-row-reverse' : ''
            }`}
            style={{ direction: direction === 'right' ? 'rtl' : 'ltr' }}
        >
            <motion.div
                initial={{ opacity: 0, x: textX }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ direction: 'ltr' }}
            >
                <h3
                    className="mb-4"
                    style={{
                        fontFamily: 'var(--font-display), Georgia, serif',
                        fontSize: 'clamp(24px, 3vw, 30px)',
                        fontWeight: 400,
                        lineHeight: 1.2,
                        color: '#0F172A',
                    }}
                >
                    {title}
                </h3>
                <p
                    className="leading-relaxed max-w-md"
                    style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '17px',
                        lineHeight: 1.65,
                        color: '#475569',
                    }}
                >
                    {description}
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: mockupX }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="transition-transform duration-300 lg:-mx-3 xl:-mx-6"
                style={{ direction: 'ltr' }}
                whileHover={{ y: -4 }}
            >
                <BrowserFrame>{mockup}</BrowserFrame>
            </motion.div>
        </div>
    );
}

const questionShowcaseSlides = [
    {
        src: '/images/feature-coding-question.png',
        alt: 'Mentrily coding question with test cases and execution output',
    },
    {
        src: '/images/feature-web-question.png',
        alt: 'Mentrily web question with editor files and live preview',
    },
    {
        src: '/images/feature-notebook-question.png',
        alt: 'Mentrily Python notebook question with console output and chart',
    },
];

/* ── Product Screenshot Slider: Coding / Web / Notebook ── */
function QuestionShowcase() {
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setActiveSlide((current) => (current + 1) % questionShowcaseSlides.length);
        }, 3500);

        return () => window.clearInterval(interval);
    }, []);

    return (
        <div className="relative overflow-hidden bg-[#F8FAFC]">
            <div className="relative aspect-[1920/939]">
                {questionShowcaseSlides.map((slide, index) => (
                    <motion.div
                        key={slide.src}
                        className="absolute inset-0"
                        initial={false}
                        animate={{
                            opacity: activeSlide === index ? 1 : 0,
                            scale: activeSlide === index ? 1 : 1.012,
                        }}
                        transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
                        aria-hidden={activeSlide !== index}
                    >
                        <Image
                            src={slide.src}
                            alt={slide.alt}
                            fill
                            sizes="(min-width: 1280px) 780px, (min-width: 1024px) 64vw, 100vw"
                            className="object-cover"
                            priority={index === 0}
                        />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

/* ── Mockup: Exam Interface ── */
function ExamMockup() {
    return (
        <div className="relative aspect-[16/9] overflow-hidden bg-[#F8FAFC]">
            <Image
                src="/images/exam-image.png"
                alt="Mentrily proctored exam interface with timer, locked sections, question workspace, and webcam monitoring"
                fill
                sizes="(min-width: 1280px) 780px, (min-width: 1024px) 64vw, 100vw"
                className="object-cover"
            />
        </div>
    );
}

/* ── Mockup: Course and Exam Builder ── */
function CourseExamBuilderMockup() {
    return (
        <div className="relative aspect-[1920/939] overflow-hidden bg-[#F8FAFC]">
            <Image
                src="/images/course-exam-builder.png"
                alt="Mentrily course builder with units, questions, tests, AI generation, and exam linking"
                fill
                sizes="(min-width: 1280px) 780px, (min-width: 1024px) 64vw, 100vw"
                className="object-cover"
            />
        </div>
    );
}
