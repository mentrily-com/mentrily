'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';

interface MarketingPageHeaderProps {
    title: string;
    description: string;
    badge?: string;
}

export function MarketingPageHeader({ title, description, badge }: MarketingPageHeaderProps) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

    return (
        <section ref={ref} className="pt-24 pb-12 sm:pt-32 sm:pb-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5 }}
                >
                    {badge && (
                        <span
                            className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-6"
                            style={{ backgroundColor: '#E6F7F8', color: '#008D98' }}
                        >
                            {badge}
                        </span>
                    )}
                    <h1
                        style={{
                            fontFamily: 'var(--font-display), Georgia, serif',
                            fontSize: 'clamp(36px, 5vw, 64px)',
                            fontWeight: 400,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            color: '#0F172A',
                        }}
                    >
                        {title}
                    </h1>
                    <p
                        className="mt-6 text-lg sm:text-xl max-w-2xl mx-auto"
                        style={{
                            fontFamily: 'var(--font-body)',
                            lineHeight: 1.6,
                            color: '#475569',
                        }}
                    >
                        {description}
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
