'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { MarketingPageHeader } from '@/components/layout/MarketingPageHeader';
import CTASection from '@/components/sections/CTASection';
import { Circle, Clock } from 'lucide-react';

const roadmapItems = [
    {
        quarter: 'Q2 2026',
        status: 'In Progress',
        title: 'Native Mobile Apps',
        description: 'iOS and Android apps for learners to take courses and exams on the go, with offline support.',
        items: ['Offline mode for lessons', 'Push notifications for deadlines', 'Mobile-optimized code editor'],
    },
    {
        quarter: 'Q3 2026',
        status: 'Planned',
        title: 'Enterprise SSO & SCIM',
        description: 'Advanced identity management for large organizations and universities.',
        items: ['Okta/Azure AD integration', 'Automatic user provisioning', 'Audit logs for security compliance'],
    },
    {
        quarter: 'Q4 2026',
        status: 'Researching',
        title: 'Virtual Classrooms',
        description: 'Integrated live video sessions with real-time code sharing and interactive whiteboards.',
        items: ['Peer-to-peer video', 'Shared code editor', 'Student hand-raising & polls'],
    },
];

function RoadmapList() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });

    return (
        <section ref={ref} className="py-20 bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid md:grid-cols-3 gap-8">
                    {roadmapItems.map((item, i) => (
                        <motion.div
                            key={item.quarter}
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className="p-8 rounded-3xl border border-slate-100 bg-slate-50/50 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold uppercase tracking-widest text-teal-600">
                                    {item.quarter}
                                </span>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                                    {item.status === 'In Progress' && <Clock size={12} className="text-amber-500" />}
                                    {item.status === 'Planned' && <Circle size={12} className="text-slate-400" />}
                                    {item.status === 'Researching' && (
                                        <Circle size={12} className="text-slate-400 border-dashed" />
                                    )}
                                    {item.status}
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                            <p className="text-sm text-slate-600 leading-relaxed mb-6 flex-1">{item.description}</p>

                            <ul className="space-y-3 pt-6 border-t border-slate-200">
                                {item.items.map((sub, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-500">
                                        <div className="mt-1 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                                        {sub}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function RoadmapPage() {
    return (
        <main className="min-h-screen bg-white">
            <MarketingPageHeader
                title="Our vision for the future"
                description="See what we're working on and what's coming next to Mentrily. We're building the future of technical education."
            />
            <RoadmapList />
            <CTASection />
        </main>
    );
}
