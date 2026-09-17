import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardCheck, GraduationCap, SlidersHorizontal, Wand2 } from 'lucide-react';
import { COMMANDS } from '@/app/components/AiStudio/commands';
import AiLandingPreview from '@/app/components/AiPublic/AiLandingPreview';
import { siteConfig } from '@/app/config/site';

const TITLE = 'Mentrily AI: AI Course, Exam and Quiz Generator for Teachers';
const DESCRIPTION =
    'Describe a course and Mentrily AI builds it: an editable outline, lessons, quizzes and coding exercises with checked answers, inserted straight into your Mentrily builder. Free to start.';

export const metadata: Metadata = {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical: '/ai' },
    keywords: [
        'ai course generator',
        'ai exam generator',
        'ai quiz generator',
        'ai for teachers',
        'ai lesson plan generator',
        'ai rubric generator',
        'mentrily ai',
    ],
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        url: '/ai',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: TITLE,
        description: DESCRIPTION,
    },
};

const STEPS = [
    {
        icon: Wand2,
        title: 'Describe it',
        body: 'Type /course, /exam or /quiz and say what to teach and to whom. Choose question types, difficulty and length.',
    },
    {
        icon: SlidersHorizontal,
        title: 'Shape the outline',
        body: 'Rename, reorder and retype items and set marks. Nothing is written until the outline looks right to you.',
    },
    {
        icon: ClipboardCheck,
        title: 'Write and insert',
        body: 'Lessons and questions are written section by section, checked, and inserted into your builder in one click.',
    },
];

const QUALITY = [
    'Coding exercises are run against their own test cases before they reach you.',
    'Every question is validated: real options, exactly one answer for single choice, sensible marks.',
    'Nothing is published on its own. You review each item and choose what goes into your course.',
];

const FAQS = [
    {
        q: 'What is Mentrily AI?',
        a: 'Mentrily AI is the AI assistant built into Mentrily for teachers and course creators. It plans and writes courses, exams and quizzes, explains concepts, writes rubrics and lesson plans, and sends what it makes straight into your Mentrily builder.',
    },
    {
        q: 'Is Mentrily AI free?',
        a: 'Yes. Every free account includes monthly AI credits for chatting and planning outlines. Paid plans add more credits, full course and exam writing, your own content as reference, and the strongest model.',
    },
    {
        q: 'Do I need an account to try it?',
        a: 'You can open the chat and explore every command without an account. Sending a message needs a free account, so your chats and drafts are saved.',
    },
    {
        q: 'What kinds of questions can it write?',
        a: 'Reading lessons, single choice and multiple choice questions, coding exercises with test cases, web projects and Python notebooks.',
    },
    {
        q: 'Can it use my existing courses?',
        a: 'Yes. On paid plans you can attach your own courses and exams as reference, so new questions and answers stay consistent with what you already teach.',
    },
    {
        q: 'Can I edit what it writes?',
        a: 'Everything it produces is a draft. You edit the outline before any content is written, choose which items to insert, and keep editing them in the course or exam builder.',
    },
];

const BUILD_IDS = new Set(['course', 'exam', 'quiz']);

function StartChatting({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
    return (
        <Link
            href="/chat"
            className={`group inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition ${
                tone === 'dark' ? 'bg-white text-slate-900 hover:bg-slate-100' : 'text-white'
            }`}
            style={
                tone === 'light'
                    ? {
                          background: 'linear-gradient(135deg, #008D98 0%, #006F78 100%)',
                          boxShadow: '0 4px 16px rgba(0,141,152,0.25)',
                      }
                    : undefined
            }
        >
            Start chatting
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
    );
}

export default function AiLandingPage() {
    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Mentrily AI',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            url: `${siteConfig.url}/ai`,
            description: DESCRIPTION,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            publisher: { '@type': 'Organization', name: siteConfig.company, url: siteConfig.url },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
        },
    ];

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            {/* Hero */}
            <section className="relative overflow-hidden pb-24 pt-28 sm:pt-36" style={{ backgroundColor: '#FAFBFF' }}>
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(#CBD5E1 0.8px, transparent 0.8px)',
                        backgroundSize: '28px 28px',
                        opacity: 0.25,
                    }}
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-40 -top-40 h-[760px] w-[760px]"
                    style={{ background: 'radial-gradient(circle, rgba(0,141,152,0.09) 0%, transparent 60%)' }}
                />
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
                        <h1
                            className="text-slate-900"
                            style={{
                                fontFamily: 'var(--font-display), Georgia, serif',
                                fontSize: 'clamp(40px, 5.6vw, 76px)',
                                fontWeight: 300,
                                lineHeight: 1.04,
                                letterSpacing: '-0.03em',
                            }}
                        >
                            Describe the course.
                            <br className="hidden sm:block" /> Mentrily AI builds it.
                        </h1>
                        <div className="lg:pb-2">
                            <p className="max-w-lg text-lg leading-relaxed text-slate-600">
                                Mentrily AI turns one sentence into an outline you can edit, writes the lessons and
                                questions, checks the answers, and puts everything in your course or exam builder.
                            </p>
                            <div className="mt-7 flex flex-wrap items-center gap-4">
                                <StartChatting />
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white/70 px-7 py-3.5 text-sm font-semibold text-[#008D98] backdrop-blur hover:border-[#008D98] hover:bg-white"
                                >
                                    See pricing
                                </Link>
                            </div>
                            <p className="mt-4 text-sm text-slate-500">Free to start. No credit card needed.</p>
                        </div>
                    </div>
                    <div className="mt-14 lg:mt-16">
                        <AiLandingPreview />
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="border-t border-slate-100 bg-white">
                <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
                    <h2
                        className="max-w-2xl text-slate-900"
                        style={{
                            fontFamily: 'var(--font-display), Georgia, serif',
                            fontSize: 'clamp(30px, 3.4vw, 42px)',
                            fontWeight: 400,
                            lineHeight: 1.12,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        From one sentence to a course you can publish
                    </h2>
                    <ol className="mt-12 grid gap-10 md:grid-cols-3">
                        {STEPS.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <li key={step.title} className="relative">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="text-[var(--brand)]"
                                            style={{
                                                fontFamily: 'var(--font-display), Georgia, serif',
                                                fontSize: 40,
                                                lineHeight: 1,
                                            }}
                                        >
                                            {i + 1}
                                        </span>
                                        <Icon size={18} className="text-slate-400" aria-hidden />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                                    <p className="mt-2 text-[15px] leading-7 text-slate-600">{step.body}</p>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </section>

            {/* Commands */}
            <section style={{ backgroundColor: '#F8FAFC' }}>
                <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.5fr] lg:px-8">
                    <div>
                        <h2
                            className="text-slate-900"
                            style={{
                                fontFamily: 'var(--font-display), Georgia, serif',
                                fontSize: 'clamp(30px, 3.4vw, 42px)',
                                fontWeight: 400,
                                lineHeight: 1.12,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            One assistant for building and teaching
                        </h2>
                        <p className="mt-4 text-[15px] leading-7 text-slate-600">
                            Type{' '}
                            <kbd className="rounded border border-slate-300 bg-white px-1.5 font-mono text-xs text-slate-700">
                                /
                            </kbd>{' '}
                            in the chat to pick a command, or just ask about what you teach.
                        </p>
                    </div>
                    <div className="grid gap-10 sm:grid-cols-2">
                        {[
                            { heading: 'Build content', items: COMMANDS.filter((c) => BUILD_IDS.has(c.command.id)) },
                            { heading: 'Teach better', items: COMMANDS.filter((c) => !BUILD_IDS.has(c.command.id)) },
                        ].map((group) => (
                            <div key={group.heading}>
                                <h3 className="text-sm font-semibold text-slate-900">{group.heading}</h3>
                                <ul className="mt-4 space-y-4">
                                    {group.items.map((c) => {
                                        const Icon = c.icon;
                                        return (
                                            <li key={c.label} className="flex gap-3">
                                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200">
                                                    <Icon size={16} aria-hidden />
                                                </span>
                                                <span>
                                                    <span className="block font-mono text-sm text-slate-900">
                                                        /{c.label}
                                                    </span>
                                                    <span className="block text-sm text-slate-600">
                                                        {c.description}
                                                    </span>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Builder + quality */}
            <section className="bg-white">
                <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 md:grid-cols-2 lg:px-8">
                    <div>
                        <GraduationCap size={22} className="text-[var(--brand)]" aria-hidden />
                        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                            Also right where you build
                        </h2>
                        <p className="mt-3 text-[15px] leading-7 text-slate-600">
                            Open <strong className="font-semibold text-slate-800">AI Generate</strong> inside the course
                            or exam builder for the same outline-first flow. On any single question, the AI menu makes
                            it harder or easier, writes better wrong answers, or rewrites it, and shows you the change
                            before you keep it.
                        </p>
                    </div>
                    <div>
                        <CheckCircle2 size={22} className="text-[var(--brand)]" aria-hidden />
                        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                            Checked before you see it
                        </h2>
                        <ul className="mt-3 space-y-3">
                            {QUALITY.map((line) => (
                                <li key={line} className="flex gap-2.5 text-[15px] leading-7 text-slate-600">
                                    <CheckCircle2 size={16} className="mt-1.5 shrink-0 text-emerald-600" aria-hidden />
                                    {line}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="border-t border-slate-100 bg-white">
                <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
                    <h2
                        className="text-slate-900"
                        style={{
                            fontFamily: 'var(--font-display), Georgia, serif',
                            fontSize: 'clamp(30px, 3.4vw, 42px)',
                            fontWeight: 400,
                            lineHeight: 1.12,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        Questions teachers ask
                    </h2>
                    <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
                        {FAQS.map((f) => (
                            <details key={f.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-900">
                                    {f.q}
                                    <span
                                        aria-hidden
                                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition group-open:rotate-45"
                                    >
                                        +
                                    </span>
                                </summary>
                                <p className="mt-3 text-[15px] leading-7 text-slate-600">{f.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Closing CTA */}
            <section
                className="relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #0F3035 70%, #0A2527 100%)' }}
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-32 -top-48 h-[640px] w-[640px]"
                    style={{ background: 'radial-gradient(circle, rgba(0,141,152,0.18) 0%, transparent 60%)' }}
                />
                <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
                    <div>
                        <h2
                            className="text-white"
                            style={{
                                fontFamily: 'var(--font-display), Georgia, serif',
                                fontSize: 'clamp(30px, 3.6vw, 44px)',
                                fontWeight: 300,
                                lineHeight: 1.1,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Your next course is one message away.
                        </h2>
                        <p className="mt-3 text-slate-300">Free accounts include monthly AI credits.</p>
                    </div>
                    <StartChatting tone="dark" />
                </div>
            </section>
        </>
    );
}
