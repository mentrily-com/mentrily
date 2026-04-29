'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import BrowserFrame from '@/components/ui/BrowserFrame';
import ImagePreviewModal, { type PreviewImage } from '@/components/ui/ImagePreviewModal';

export default function Features() {
    const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

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
                    <p
                        className="mt-4 max-w-xl mx-auto"
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '16px',
                            lineHeight: 1.65,
                            color: '#64748B',
                        }}
                    >
                        From course creation to certificate delivery — one platform, zero stitching.
                    </p>
                </div>

                <div className="space-y-20 sm:space-y-28">
                    {/* Feature 1: Course Builder */}
                    <FeatureRow
                        badge="Course Builder"
                        badgeColor="#008D98"
                        title="Build courses for any subject."
                        description="Create structured modules with reading lessons, MCQs, multi-select questions, assignments, tests, guidelines, and certificates. Add coding, web, or notebook tasks when you need them."
                        highlights={[
                            'Drag-and-drop unit organizer',
                            '33 programming languages',
                            'AI-powered content generation',
                        ]}
                        mockup={<CourseExamBuilderMockup onPreview={setPreviewImage} />}
                        direction="left"
                    />

                    {/* Feature 2: Proctored Exams */}
                    <FeatureRow
                        badge="Exam Engine"
                        badgeColor="#F59E0B"
                        title="Assessments for every subject."
                        description="Build quizzes, tests, and proctored exams with MCQ, multi-select, reading, web, notebook, and coding questions. Keep high-stakes exams controlled and fair."
                        highlights={[
                            'Test codes & invite links',
                            'AI proctoring & tab detection',
                            'Timer, IP allowlists & webcam',
                        ]}
                        mockup={<ExamMockup onPreview={setPreviewImage} />}
                        direction="right"
                    />

                    {/* Feature 3: Interactive Workspaces */}
                    <FeatureRow
                        badge="Interactive Workspaces"
                        badgeColor="#10B981"
                        title="Go interactive when the course needs it."
                        description="For technical programs, students can run code, build web pages, and work in Python notebooks directly in the browser. For non-coding courses, keep things simple."
                        highlights={[
                            'Browser-based code editor',
                            'Live web preview with HTML/CSS/JS',
                            'Python notebooks with chart output',
                        ]}
                        mockup={<QuestionShowcase onPreview={setPreviewImage} />}
                        direction="left"
                    />
                </div>
            </div>
            <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
        </section>
    );
}

function FeatureRow({
    badge,
    badgeColor,
    title,
    description,
    highlights,
    mockup,
    direction,
}: {
    badge: string;
    badgeColor: string;
    title: string;
    description: string;
    highlights: string[];
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
                {/* Feature badge */}
                <div
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-4"
                    style={{
                        backgroundColor: `${badgeColor}12`,
                        color: badgeColor,
                        border: `1px solid ${badgeColor}25`,
                    }}
                >
                    {badge}
                </div>

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
                    className="leading-relaxed max-w-md mb-5"
                    style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '16px',
                        lineHeight: 1.65,
                        color: '#475569',
                    }}
                >
                    {description}
                </p>

                {/* Highlight bullets */}
                <ul className="space-y-2">
                    {highlights.map((item) => (
                        <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: '#475569' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={badgeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {item}
                        </li>
                    ))}
                </ul>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: mockupX }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="transition-transform duration-300 lg:-mx-3 xl:-mx-6"
                style={{ direction: 'ltr' }}
            >
                <div
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <BrowserFrame>{mockup}</BrowserFrame>
                </div>
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
function QuestionShowcase({ onPreview }: { onPreview: (image: PreviewImage) => void }) {
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setActiveSlide((current) => (current + 1) % questionShowcaseSlides.length);
        }, 3500);

        return () => window.clearInterval(interval);
    }, []);

    const activeImage = questionShowcaseSlides[activeSlide];

    return (
        <div
            role="button"
            tabIndex={0}
            className="relative w-full overflow-hidden bg-[#F8FAFC] text-left"
            onClick={() => onPreview(activeImage)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPreview(activeImage);
                }
            }}
        >
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
            {/* Slide indicator dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {questionShowcaseSlides.map((_, index) => (
                    <button
                        key={index}
                        onClick={(event) => {
                            event.stopPropagation();
                            setActiveSlide(index);
                        }}
                        className="transition-all duration-200 rounded-full cursor-pointer"
                        style={{
                            width: activeSlide === index ? '20px' : '6px',
                            height: '6px',
                            backgroundColor: activeSlide === index ? '#008D98' : 'rgba(255,255,255,0.6)',
                            border: activeSlide === index ? 'none' : '1px solid rgba(0,0,0,0.1)',
                        }}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}

/* ── Mockup: Exam Interface ── */
function ExamMockup({ onPreview }: { onPreview: (image: PreviewImage) => void }) {
    const image = {
        src: '/images/exam-image.png',
        alt: 'Mentrily proctored exam interface with timer, locked sections, question workspace, and webcam monitoring',
    };

    return (
        <button
            type="button"
            className="relative block aspect-[16/9] w-full overflow-hidden bg-[#F8FAFC] text-left"
            onClick={() => onPreview(image)}
        >
            <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 1280px) 780px, (min-width: 1024px) 64vw, 100vw"
                className="object-cover"
            />
        </button>
    );
}

/* ── Mockup: Course and Exam Builder ── */
function CourseExamBuilderMockup({ onPreview }: { onPreview: (image: PreviewImage) => void }) {
    const image = {
        src: '/images/course-exam-builder.png',
        alt: 'Mentrily course builder with units, questions, tests, AI generation, and exam linking',
    };

    return (
        <button
            type="button"
            className="relative block aspect-[1920/939] w-full overflow-hidden bg-[#F8FAFC] text-left"
            onClick={() => onPreview(image)}
        >
            <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 1280px) 780px, (min-width: 1024px) 64vw, 100vw"
                className="object-cover"
            />
        </button>
    );
}
