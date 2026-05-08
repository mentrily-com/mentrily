'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useInView } from 'react-intersection-observer';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { siteConfig } from '../../config/site';
import { Mail, MessageSquare, FileText, Handshake, Check, Loader2, ArrowRight } from 'lucide-react';


const _contactSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Please enter a valid email'),
    category: z.string().min(1, 'Please select a category'),
    message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactFormData = z.infer<typeof _contactSchema>;

const categories = ['Sales', 'Technical Support', 'Billing', 'Partnership', 'General Inquiry'];

const useCaseCTAs = [
    {
        icon: MessageSquare,
        title: 'For Sales',
        description: 'Book a 20-min demo call.',
        cta: 'Book a Demo',
        href: 'https://calendly.com/sumanydv514/consult-with-mentrily',
        external: true,
    },
    {
        icon: Handshake,
        title: 'For Partnerships',
        description: 'Integrations, reseller agreements, institutional licenses.',
        cta: 'Learn More',
        href: '/partnership',
    },
];

import { Suspense } from 'react';

function ContactForm() {
    const searchParams = useSearchParams();
    const defaultCategory = searchParams.get('category') || '';
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });
    const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [submitError, setSubmitError] = useState('');

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<ContactFormData>();

    const onSubmit = async (data: ContactFormData) => {
        setSubmitState('loading');
        setSubmitError('');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const body = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(body.error || 'Failed to send message. Please try again later.');
            }

            setSubmitState('success');
            reset();
            setTimeout(() => setSubmitState('idle'), 3000);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to send message. Please try again later.');
            setSubmitState('error');
        }
    };

    return (
        <div ref={ref} className="pt-24 pb-0" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.48 }}
                    className="text-center mb-14"
                >
                    <h1
                        style={{
                            fontFamily: 'var(--font-display), Georgia, serif',
                            fontSize: 'clamp(36px, 5vw, 56px)',
                            fontWeight: 400,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            color: '#0F172A',
                        }}
                    >
                        Contact us
                    </h1>
                    <p
                        className="mt-4 max-w-lg mx-auto"
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '17px',
                            lineHeight: 1.65,
                            color: '#475569',
                        }}
                    >
                        We reply fast. Sales inquiries get a response within 4 hours.
                    </p>
                </motion.div>

                {/* Two-column layout */}
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 mb-20">
                    {/* LEFT: Form */}
                    <motion.div
                        initial={{ opacity: 0, x: -24 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.1, duration: 0.5 }}
                    >
                        <div
                            className="p-6 sm:p-8 rounded-2xl"
                            style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            }}
                        >
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        Name
                                    </label>
                                    <input
                                        {...register('name', { required: 'Name is required' })}
                                        className="w-full px-4 py-2.5 text-sm rounded-lg border outline-none transition-colors duration-150"
                                        style={{
                                            backgroundColor: '#F8FAFC',
                                            borderColor: errors.name ? '#EF4444' : '#E2E8F0',
                                            color: '#0F172A',
                                        }}
                                        onFocus={(e) => {
                                            if (!errors.name) e.currentTarget.style.borderColor = '#008D98';
                                        }}
                                        onBlur={(e) => {
                                            if (!errors.name) e.currentTarget.style.borderColor = '#E2E8F0';
                                        }}
                                        placeholder="Your name"
                                    />
                                    {errors.name && (
                                        <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                                            {errors.name.message}
                                        </p>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        {...register('email', {
                                            required: 'Email is required',
                                            pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
                                        })}
                                        className="w-full px-4 py-2.5 text-sm rounded-lg border outline-none transition-colors duration-150"
                                        style={{
                                            backgroundColor: '#F8FAFC',
                                            borderColor: errors.email ? '#EF4444' : '#E2E8F0',
                                            color: '#0F172A',
                                        }}
                                        onFocus={(e) => {
                                            if (!errors.email) e.currentTarget.style.borderColor = '#008D98';
                                        }}
                                        onBlur={(e) => {
                                            if (!errors.email) e.currentTarget.style.borderColor = '#E2E8F0';
                                        }}
                                        placeholder="you@school.com"
                                    />
                                    {errors.email && (
                                        <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                                            {errors.email.message}
                                        </p>
                                    )}
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        Category
                                    </label>
                                    <select
                                        {...register('category', { required: 'Please select a category' })}
                                        className="w-full px-4 py-2.5 text-sm rounded-lg border outline-none transition-colors duration-150 cursor-pointer"
                                        style={{
                                            backgroundColor: '#F8FAFC',
                                            borderColor: errors.category ? '#EF4444' : '#E2E8F0',
                                            color: '#0F172A',
                                        }}
                                        defaultValue={defaultCategory}
                                    >
                                        <option value="" disabled>
                                            Select a category
                                        </option>
                                        {categories.map((cat) => (
                                            <option key={cat} value={cat}>
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.category && (
                                        <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                                            {errors.category.message}
                                        </p>
                                    )}
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        Message
                                    </label>
                                    <textarea
                                        {...register('message', {
                                            required: 'Message is required',
                                            minLength: { value: 10, message: 'At least 10 characters' },
                                        })}
                                        rows={4}
                                        className="w-full px-4 py-2.5 text-sm rounded-lg border outline-none transition-colors duration-150 resize-none"
                                        style={{
                                            backgroundColor: '#F8FAFC',
                                            borderColor: errors.message ? '#EF4444' : '#E2E8F0',
                                            color: '#0F172A',
                                        }}
                                        onFocus={(e) => {
                                            if (!errors.message) e.currentTarget.style.borderColor = '#008D98';
                                        }}
                                        onBlur={(e) => {
                                            if (!errors.message) e.currentTarget.style.borderColor = '#E2E8F0';
                                        }}
                                        placeholder="How can we help?"
                                    />
                                    {errors.message && (
                                        <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                                            {errors.message.message}
                                        </p>
                                    )}
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={submitState === 'loading'}
                                    className="w-full py-3 text-sm font-semibold text-white rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
                                    style={{
                                        backgroundColor: submitState === 'success' ? '#10B981' : '#008D98',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (submitState === 'idle') e.currentTarget.style.backgroundColor = '#006F78';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (submitState === 'idle') e.currentTarget.style.backgroundColor = '#008D98';
                                    }}
                                >
                                    {submitState === 'loading' && <Loader2 size={16} className="animate-spin" />}
                                    {submitState === 'success' && <Check size={16} />}
                                    {(submitState === 'idle' || submitState === 'error') && 'Send Message'}
                                    {submitState === 'loading' && 'Sending...'}
                                    {submitState === 'success' && "We've received your message."}
                                </button>
                                {submitError && (
                                    <p className="text-sm" style={{ color: '#EF4444' }}>
                                        {submitError}
                                    </p>
                                )}
                            </form>
                        </div>
                    </motion.div>

                    {/* RIGHT: Info */}
                    <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="space-y-8"
                    >
                        {/* Email */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Mail size={18} style={{ color: '#008D98' }} />
                                <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                                    Email
                                </h3>
                            </div>
                            <a
                                href={`mailto:support@${siteConfig.domain}`}
                                className="text-sm transition-colors duration-150 cursor-pointer"
                                style={{ color: '#008D98' }}
                            >
                                support@{siteConfig.domain}
                            </a>
                        </div>

                        {/* Use-case CTA cards */}
                        <div className="space-y-3">
                            {useCaseCTAs.map((card) => {
                                const Icon = card.icon;
                                return (
                                    <div
                                        key={card.title}
                                        className="p-5 rounded-2xl transition-all duration-300 cursor-pointer group"
                                        style={{
                                            backgroundColor: card.title.includes('Partnership') ? '#F0FDFA' : '#FFFFFF',
                                            border: card.title.includes('Partnership') ? '1px solid #99F6E4' : '1px solid #E2E8F0',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.06)';
                                            if (!card.title.includes('Partnership')) e.currentTarget.style.borderColor = '#CBD5E1';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                                            if (!card.title.includes('Partnership')) e.currentTarget.style.borderColor = '#E2E8F0';
                                        }}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                                                style={{ backgroundColor: card.title.includes('Partnership') ? '#CCFBF1' : '#E6F7F8' }}
                                            >
                                                <Icon size={20} style={{ color: '#008D98' }} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h4
                                                        className="text-sm font-bold"
                                                        style={{ color: '#0F172A' }}
                                                    >
                                                        {card.title}
                                                    </h4>
                                                </div>
                                                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#475569' }}>
                                                    {card.description}
                                                </p>
                                                <Link
                                                    href={card.href}
                                                    target={card.external ? "_blank" : undefined}
                                                    rel={card.external ? "noopener noreferrer" : undefined}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold transition-all duration-200 group-hover:gap-2"
                                                    style={{ color: '#008D98' }}
                                                >
                                                    {card.cta} <ArrowRight size={14} className="transition-transform" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

export default function ContactPage() {
    return (
        <Suspense fallback={
            <div className="pt-32 pb-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
            </div>
        }>
            <ContactForm />
        </Suspense>
    );
}
