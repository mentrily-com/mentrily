'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { MarketingPageHeader } from '@/components/layout/MarketingPageHeader';
import CTASection from '@/components/sections/CTASection';

const changes = [
    {
        version: 'v2.4.0',
        date: 'May 1, 2026',
        title: 'AI Exam Generation & webcam Monitoring',
        type: 'Major',
        items: [
            'Added AI-driven exam generation from course content.',
            'Implemented webcam monitoring for proctored exams.',
            'Enhanced sandboxed execution for Python and Node.js.',
            'New certificate templates with dynamic branding.'
        ]
    },
    {
        version: 'v2.3.5',
        date: 'April 15, 2026',
        title: 'Performance Improvements & Bug Fixes',
        type: 'Minor',
        items: [
            'Improved dashboard load times by 40%.',
            'Fixed an issue with certificate downloads on mobile.',
            'Updated Lucide icon library to the latest version.',
            'Resolved edge case in time-limited exams.'
        ]
    },
    {
        version: 'v2.3.0',
        date: 'March 20, 2026',
        title: 'Multi-language Support for Certificates',
        type: 'Feature',
        items: [
            'Added support for 12 new languages in certificates.',
            'New custom domain integration for Pro users.',
            'Improved learner progress dashboard with heatmaps.',
            'Direct export of student results to CSV/JSON.'
        ]
    }
];

function ChangelogList() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });

    return (
        <section ref={ref} className="py-20 bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="relative border-l border-slate-200 ml-4 sm:ml-0 pl-8 sm:pl-0">
                    {changes.map((change, i) => (
                        <motion.div
                            key={change.version}
                            initial={{ opacity: 0, x: -20 }}
                            animate={inView ? { opacity: 1, x: 0 } : {}}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className="relative mb-20 last:mb-0 sm:grid sm:grid-cols-[160px_1fr] sm:gap-12"
                        >
                            {/* Dot on line */}
                            <div className="absolute -left-[41px] sm:left-[151px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-teal-500 z-10" />
                            
                            <div className="mb-4 sm:mb-0">
                                <time className="text-sm font-semibold text-teal-600 block mb-1">
                                    {change.date}
                                </time>
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                    {change.type}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">
                                    {change.title} <span className="text-slate-400 font-normal ml-2">{change.version}</span>
                                </h3>
                                <ul className="space-y-3">
                                    {change.items.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-slate-600">
                                            <div className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                            <span className="text-sm leading-relaxed">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function ChangelogPage() {
    return (
        <main className="min-h-screen bg-white">
            <MarketingPageHeader 
                title="What's new in Mentrily"
                description="Stay up to date with the latest features, improvements, and fixes we've shipped to help you run a better school."
            />
            <ChangelogList />
            <CTASection />
        </main>
    );
}
