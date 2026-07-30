'use client';

import { motion } from 'motion/react';
import { MarketingPageHeader } from '@/components/layout/MarketingPageHeader';
import CTASection from '@/components/sections/CTASection';
import { Book, Code2, Terminal, Zap, Puzzle, Lock } from 'lucide-react';

const docCategories = [
    {
        title: 'Getting Started',
        description: 'Learn how to integrate Mentrily into your existing workflow and make your first API request.',
        icon: Zap,
        link: '#',
        color: '#008D98'
    },
    {
        title: 'Authentication',
        description: 'Secure your requests with API keys and OAuth2. Learn about scopes and permissions.',
        icon: Lock,
        link: '#',
        color: '#6366F1'
    },
    {
        title: 'REST API Reference',
        description: 'Comprehensive documentation for all our endpoints including Users, Courses, and Results.',
        icon: Terminal,
        link: '#',
        color: '#EC4899'
    },
    {
        title: 'Webhooks',
        description: 'Receive real-time notifications about student progress, exam completions, and more.',
        icon: Puzzle,
        link: '#',
        color: '#F59E0B'
    },
    {
        title: 'SDKs & Libraries',
        description: 'Official libraries for Node.js, Python, and Go to help you build faster.',
        icon: Code2,
        link: '#',
        color: '#10B981'
    },
    {
        title: 'Guides & Tutorials',
        description: 'Step-by-step guides on common integration patterns and best practices.',
        icon: Book,
        link: '#',
        color: '#3B82F6'
    }
];

function ComingSoon() {
    return (
        <section className="py-32 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="p-16 rounded-[48px] border border-slate-100 bg-slate-50/50 backdrop-blur-xl relative overflow-hidden"
                >
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                    
                    <div className="relative z-10">
                        <div className="w-20 h-20 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center justify-center mx-auto mb-8">
                            <Zap size={40} className="text-teal-600 animate-pulse" />
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-display text-slate-900 mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                            Coming <span className="italic text-teal-600 font-medium">Soon</span>
                        </h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            We&apos;re putting the finishing touches on our developer portal. 
                            Soon you&apos;ll be able to build, integrate, and automate with the Mentrily platform.
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

export default function DocsPage() {
    return (
        <main className="min-h-screen bg-white">
            <MarketingPageHeader 
                title="Built for developers, by developers"
                description="Everything you need to build, integrate, and automate with the Mentrily platform."
            />
            <ComingSoon />
            <CTASection />
        </main>
    );
}
