'use client';

import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import {
    Handshake,
    TrendingUp,
    ShieldCheck,
    Globe,
    Users,
    Briefcase,
    Zap,
    Scale,
    Check,
    ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import CTASection from '@/components/sections/CTASection';

const partnerBenefits = [
    {
        title: 'Generous Rev-Share',
        description:
            'Earn a significant percentage of every subscription from schools and institutions you bring to Mentrily.',
        icon: TrendingUp,
        color: '#10B981',
    },
    {
        title: 'Reseller Dashboard',
        description:
            'A dedicated portal to manage your leads, track conversions, and monitor your earnings in real-time.',
        icon: Briefcase,
        color: '#008D98',
    },
    {
        title: 'Priority Support',
        description:
            'Direct access to our partnership team and technical engineers to help you close deals and support your clients.',
        icon: Users,
        color: '#F59E0B',
    },
    {
        title: 'White-Label Options',
        description:
            'Offer Mentrily as your own solution. Custom branding, domains, and certificates for your institutional clients.',
        icon: ShieldCheck,
        color: '#6366F1',
    },
];

const partnershipTypes = [
    {
        title: 'Individual Affiliates',
        description:
            'Content creators, bloggers, and influencers who want to promote the best technical education platform to their audience.',
        icon: Zap,
        color: '#EC4899',
    },
    {
        title: 'Institutional Partners',
        description:
            'Universities, bootcamps, and government agencies looking for a scalable infrastructure for their technical programs.',
        icon: Scale,
        color: '#8B5CF6',
    },
    {
        title: 'Global Resellers',
        description:
            'Established software vendors and consultants who want to add Mentrily to their product portfolio.',
        icon: Globe,
        color: '#3B82F6',
    },
    {
        title: 'Integration Partners',
        description:
            'LMS providers and HR tech companies looking to integrate Mentrily’s coding playground into their own products.',
        icon: Handshake,
        color: '#14B8A6',
    },
];

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
        >
            <h2
                className="text-3xl sm:text-4xl font-display text-slate-900 mb-4"
                style={{ fontFamily: 'var(--font-display)' }}
            >
                {title}
            </h2>
            {subtitle && <p className="text-slate-600 max-w-2xl mx-auto">{subtitle}</p>}
        </motion.div>
    );
}

function Grid({ items }: { items: typeof partnerBenefits }) {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

    return (
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {items.map((item, i) => (
                <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="p-8 rounded-3xl border border-slate-100 bg-white hover:border-teal-500/20 hover:shadow-2xl hover:shadow-teal-500/5 transition-all duration-300 group"
                >
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110"
                        style={{ backgroundColor: `${item.color}10`, color: item.color }}
                    >
                        <item.icon size={28} />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h3>
                    <p className="text-slate-600 leading-relaxed text-sm">{item.description}</p>
                </motion.div>
            ))}
        </div>
    );
}

function PartnershipHero() {
    return (
        <section className="pt-24 pb-20 sm:pt-32 sm:pb-32 bg-white overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Left: Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                    >
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
                            Grow with Mentrily. <br />
                            <span className="italic text-teal-600">Empower</span> the next generation.
                        </h1>
                        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-xl leading-relaxed mb-10">
                            Join our partnership program and help schools worldwide deliver world-class technical
                            education. Earn recurring commissions and get exclusive support.
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <Link
                                href="/contact?category=Partnership"
                                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2"
                            >
                                Apply to Partner <ArrowRight size={18} />
                            </Link>
                            <Link
                                href="#perks"
                                className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                            >
                                View Benefits
                            </Link>
                        </div>
                    </motion.div>

                    {/* Right: The "Really Good" Visual */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="relative flex items-center justify-center lg:justify-end"
                    >
                        <div className="relative w-full max-w-[480px] aspect-[4/3]">
                            <div className="absolute -inset-4 bg-gradient-to-tr from-teal-500/10 to-blue-500/10 blur-3xl rounded-full" />

                            <motion.div
                                initial={{ y: 20, rotate: -2 }}
                                animate={{ y: 0, rotate: -4 }}
                                transition={{ delay: 0.2 }}
                                className="absolute inset-0 bg-slate-800/40 backdrop-blur-md border border-white/5 rounded-[2rem] shadow-xl"
                            />

                            <motion.div
                                initial={{ y: 10, rotate: 0 }}
                                animate={{ y: -20, rotate: -2 }}
                                transition={{ delay: 0.1 }}
                                className="absolute inset-0 bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl p-8 flex flex-col justify-end overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-12 opacity-5">
                                    <TrendingUp size={160} className="text-white" />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-2">
                                        Revenue Growth
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-white text-3xl font-bold">+124%</span>
                                        <span className="text-white/40 text-sm">YoY Increase</span>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                                className="absolute inset-0 bg-white rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] p-10 flex flex-col justify-between border border-slate-100"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
                                        <Handshake size={32} className="text-teal-600" />
                                    </div>
                                    <div className="px-4 py-1.5 rounded-full bg-teal-50 border border-teal-100 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                        <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                                            Verified Program
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Official Reseller</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                        You are officially authorized to distribute Mentrily licenses and provide
                                        implementation services.
                                    </p>

                                    <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                            {[1, 2, 3].map((i) => (
                                                <div
                                                    key={i}
                                                    className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden"
                                                >
                                                    <img
                                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`}
                                                        alt="Partner"
                                                    />
                                                </div>
                                            ))}
                                            <div className="w-8 h-8 rounded-full border-2 border-white bg-teal-500 flex items-center justify-center text-[10px] font-bold text-white">
                                                +40
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-teal-600 font-bold text-xs uppercase tracking-wider">
                                            Partner Status <Check size={14} />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

export default function PartnershipPage() {
    return (
        <main className="min-h-screen bg-[#FDFDFF]">
            <PartnershipHero />

            {/* Benefits Section */}
            <section id="perks" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-100">
                <SectionTitle
                    title="Why partner with Mentrily?"
                    subtitle="We provide the tools, support, and infrastructure you need to successfully resell and implement Mentrily for your clients."
                />
                <Grid items={partnerBenefits} />
            </section>

            {/* Types of Partnerships */}
            <section className="py-24 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <SectionTitle
                        title="Partnership tracks"
                        subtitle="We have tailored programs for different types of partners. Choose the one that fits your business model."
                    />
                    <Grid items={partnershipTypes} />
                </div>
            </section>

            {/* Deep Dive / Reselling */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2
                            className="text-3xl sm:text-4xl font-display text-slate-900 mb-6"
                            style={{ fontFamily: 'var(--font-display)' }}
                        >
                            Scale your business with Mentrily
                        </h2>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            Our program is designed for companies that want to offer a complete technical education
                            solution. Whether you are an educational consultant or a software vendor, Mentrily fits
                            perfectly into your portfolio.
                        </p>
                        <div className="space-y-4">
                            {[
                                'Up to 30% recurring commission',
                                'Dedicated account manager',
                                'Co-branded marketing materials',
                                'Technical training and certification',
                                'Lead protection and registration',
                            ].map((feature) => (
                                <div key={feature} className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-teal-600" />
                                    </div>
                                    <span className="text-slate-700 font-medium">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="p-8 rounded-[2.5rem] bg-teal-50 border border-teal-100"
                    >
                        <div className="grid grid-cols-2 gap-8">
                            <div className="p-6 rounded-2xl bg-white shadow-sm">
                                <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-2">
                                    Success Rate
                                </p>
                                <p className="text-3xl font-bold text-slate-900">98%</p>
                                <p className="text-xs text-slate-500 mt-1">Client retention</p>
                            </div>
                            <div className="p-6 rounded-2xl bg-white shadow-sm">
                                <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-2">
                                    Onboarding
                                </p>
                                <p className="text-3xl font-bold text-slate-900">24h</p>
                                <p className="text-xs text-slate-500 mt-1">Setup time</p>
                            </div>
                            <div className="col-span-2 p-6 rounded-2xl bg-white shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-2">
                                        Global Support
                                    </p>
                                    <p className="text-xl font-bold text-slate-900">24/7 Availability</p>
                                </div>
                                <Globe size={32} className="text-teal-500 opacity-20" />
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            <CTASection
                title="Ready to start your partnership?"
                description="Apply today and one of our partnership managers will get in touch with you within 24 hours."
                ctaText="Apply Now"
                ctaHref="/contact?category=Partnership"
            />
        </main>
    );
}
