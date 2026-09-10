'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { MarketingPageHeader } from '@/components/layout/MarketingPageHeader';
import CTASection from '@/components/sections/CTASection';
import { ArrowUpRight, MapPin, Briefcase, Heart } from 'lucide-react';

const jobs = [
    {
        title: 'Senior Full Stack Engineer',
        department: 'Engineering',
        location: 'Remote',
        type: 'Full-time',
    },
    {
        title: 'Product Designer',
        department: 'Product',
        location: 'Remote',
        type: 'Full-time',
    },
    {
        title: 'Customer Success Manager',
        department: 'Operations',
        location: 'Remote',
        type: 'Full-time',
    },
];

function JobBoard() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });

    return (
        <section ref={ref} className="py-20 bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Open Positions</h2>
                    <p className="text-slate-600">Join our mission to democratize technical education worldwide.</p>
                </div>

                <div className="space-y-4">
                    {jobs.map((job, i) => (
                        <motion.a
                            key={job.title}
                            href="https://forms.gle/mTR3Rv5ZQGejrQndA"
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, x: -20 }}
                            animate={inView ? { opacity: 1, x: 0 } : {}}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className="group p-6 rounded-2xl border border-slate-100 hover:border-teal-500/20 hover:bg-teal-50/10 transition-all duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-600 transition-colors mb-2">
                                    {job.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Briefcase size={12} /> {job.department}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MapPin size={12} /> {job.location}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{job.type}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-end">
                                <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-teal-500 group-hover:border-teal-500 group-hover:text-white transition-all duration-300">
                                    <ArrowUpRight size={18} />
                                </div>
                            </div>
                        </motion.a>
                    ))}
                </div>

                <div className="mt-16 p-8 rounded-3xl bg-slate-50 border border-slate-200 text-center">
                    <Heart className="mx-auto text-rose-500 mb-4" size={32} />
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Don&apos;t see a fit?</h3>
                    <p className="text-sm text-slate-600 mb-6">
                        We&apos;re always looking for talented people who share our passion for education.
                    </p>
                    <a
                        href="https://forms.gle/mTR3Rv5ZQGejrQndA"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-teal-600 hover:text-teal-700 transition-colors"
                    >
                        Send us an open application →
                    </a>
                </div>
            </div>
        </section>
    );
}

export default function CareersPage() {
    return (
        <main className="min-h-screen bg-white">
            <MarketingPageHeader
                title="Join the team building the future of learning"
                description="Mentrily is a fully remote team of educators, designers, and engineers dedicated to making technical education accessible and effective."
            />
            <JobBoard />
            <CTASection />
        </main>
    );
}
