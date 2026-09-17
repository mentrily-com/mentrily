'use client';

import { motion } from 'motion/react';
import { Timer } from 'lucide-react';
import { MarketingPageHeader } from '@/components/layout/MarketingPageHeader';
import CTASection from '@/components/sections/CTASection';

function ComingSoon() {
    return (
        <section className="py-32 bg-white">
            <div className="max-w-4xl mx-auto px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-teal-50 text-teal-600 mb-8"
                >
                    <Timer size={40} />
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="text-4xl font-display text-slate-900 mb-6"
                    style={{ fontFamily: 'var(--font-display)' }}
                >
                    Something worth reading is <br />
                    <span className="italic text-teal-600">coming very soon.</span>
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="text-slate-600 text-lg mb-12 max-w-xl mx-auto leading-relaxed"
                >
                    We&apos;re currently crafting deep-dives on technical education, scaling bootcamps, and the future
                    of coding assessments.
                </motion.p>
            </div>
        </section>
    );
}

export default function BlogPage() {
    return (
        <main className="min-h-screen bg-white">
            <MarketingPageHeader
                title="The Mentrily Blog"
                description="Insights, guides, and stories for modern technical educators."
            />
            <ComingSoon />
            <CTASection />
        </main>
    );
}
