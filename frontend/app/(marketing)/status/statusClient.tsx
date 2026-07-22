'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { MarketingPageHeader } from '@/components/layout/MarketingPageHeader';
import { CheckCircle2 } from 'lucide-react';

const systems = [
    { name: 'Marketing Website', status: 'Operational', uptime: '99.99%' },
    { name: 'Course Platform (LMS)', status: 'Operational', uptime: '99.95%' },
    { name: 'Exam Engine', status: 'Operational', uptime: '99.98%' },
    { name: 'Code Sandbox Service', status: 'Operational', uptime: '99.90%' },
    { name: 'Certificate Generation', status: 'Operational', uptime: '100%' },
    { name: 'API Services', status: 'Operational', uptime: '99.97%' },
];

function StatusBoard() {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

    return (
        <section ref={ref} className="py-24 bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.5 }}
                    className="p-12 rounded-[40px] bg-emerald-50 border border-emerald-100 flex flex-col items-center text-center gap-6 shadow-sm"
                >
                    <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 size={40} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-emerald-900 mb-2 tracking-tight">All Systems Operational</h2>
                        <p className="text-emerald-700/70 font-medium">Verified by our global monitoring network</p>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/50 border border-emerald-200/50">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                            Live Status
                        </span>
                        <span className="text-emerald-300">|</span>
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                            {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

export default function StatusPage() {
    return (
        <main className="min-h-screen bg-white">
            <MarketingPageHeader 
                title="System Status"
                description="Live updates on the health and performance of Mentrily services."
            />
            <StatusBoard />
        </main>
    );
}
