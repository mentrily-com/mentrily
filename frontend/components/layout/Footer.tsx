'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { siteConfig } from '@/app/config/site';
import { BrandLogo } from '@/components/brand/BrandLogo';

const productLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Changelog', href: '/changelog' },
    { label: 'Roadmap', href: '/roadmap' },
    { label: 'API Docs', href: '/docs' },
];

const companyLinks = [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Partnership', href: '/partnership' },
    { label: 'Contact', href: '/contact' },
    { label: 'Status Page', href: '/status' },
];

const playgroundLinks = [
    { label: 'All Online Compilers', href: '/online-compilers' },
    { label: 'Python Compiler', href: '/online-python-compiler' },
    { label: 'C Compiler', href: '/online-c-compiler' },
    { label: 'C++ Compiler', href: '/online-cpp-compiler' },
    { label: 'Java Compiler', href: '/online-java-compiler' },
    { label: 'JavaScript Compiler', href: '/online-javascript-compiler' },
    { label: 'HTML Editor', href: '/online-html-editor' },
    { label: 'Python Notebook', href: '/online-python-notebook' },
];

export default function Footer() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus('loading');
        try {
            const res = await fetch('/api/marketing/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (res.ok) {
                setStatus('success');
                setEmail('');
                setTimeout(() => setStatus('idle'), 5000);
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('Newsletter error:', error);
            setStatus('error');
        }
    };

    return (
        <footer
            style={{
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
            }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12">
                    {/* Col 1: Brand */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <BrandLogo className="h-9 max-w-[180px]" />
                        <p className="mt-3 text-sm leading-relaxed max-w-xs" style={{ color: '#475569' }}>
                            The course platform for educators who want courses, exams, certificates, and learner
                            progress in one place.
                        </p>
                        {/* GitHub link disabled for now
                        <div className="flex gap-4 mt-5">
                            <a
                                href={siteConfig.links.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="GitHub"
                                className="cursor-pointer"
                                style={{ color: '#94A3B8' }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                                </svg>
                            </a>
                        </div>
                        */}
                    </div>

                    {/* Col 2: Product */}
                    <div>
                        <h4 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>
                            Product
                        </h4>
                        <ul className="space-y-2.5">
                            {productLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm transition-colors duration-150 cursor-pointer"
                                        style={{ color: '#475569' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#008D98')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Col 3: Company */}
                    <div>
                        <h4 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>
                            Company
                        </h4>
                        <ul className="space-y-2.5">
                            {companyLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm transition-colors duration-150 cursor-pointer"
                                        style={{ color: '#475569' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#008D98')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Col 4: Playground */}
                    <div>
                        <h4 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>
                            Playground
                        </h4>
                        <ul className="space-y-2.5">
                            {playgroundLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm transition-colors duration-150 cursor-pointer"
                                        style={{ color: '#475569' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#008D98')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Col 5: Newsletter */}
                    <div>
                        <h4 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>
                            Newsletter
                        </h4>
                        <p className="text-sm mb-4" style={{ color: '#475569' }}>
                            Get product updates and tips for educators.
                        </p>
                        <form onSubmit={handleSubscribe} className="flex gap-2">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@school.com"
                                required
                                className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-colors duration-150 min-w-0"
                                style={{
                                    backgroundColor: '#F1F5F9',
                                    borderColor: '#E2E8F0',
                                    color: '#0F172A',
                                }}
                                onFocus={(e) => (e.currentTarget.style.borderColor = '#008D98')}
                                onBlur={(e) => (e.currentTarget.style.borderColor = '#E2E8F0')}
                            />
                                <button
                                    type="submit"
                                    disabled={status === 'loading'}
                                    className="px-3 py-2 text-sm font-medium text-white rounded-lg transition-colors duration-150 cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-70"
                                    style={{ backgroundColor: '#008D98' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006F78')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008D98')}
                                >
                                    {status === 'loading' ? (
                                        'Joining...'
                                    ) : status === 'success' ? (
                                        'Subscribed!'
                                    ) : (
                                        <>
                                            Subscribe <ArrowRight size={14} />
                                        </>
                                    )}
                                </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t px-4 sm:px-6 lg:px-8" style={{ borderColor: '#E2E8F0' }}>
                <div className="max-w-7xl mx-auto py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs" style={{ color: '#94A3B8' }}>
                        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
                    </p>
                    <div className="flex items-center gap-5">
                        <Link
                            href="#"
                            className="text-xs transition-colors duration-150 cursor-pointer"
                            style={{ color: '#94A3B8' }}
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            href="#"
                            className="text-xs transition-colors duration-150 cursor-pointer"
                            style={{ color: '#94A3B8' }}
                        >
                            Terms of Service
                        </Link>
                        <span className="text-xs" style={{ color: '#94A3B8' }}>
                            Made with ❤️ for educators worldwide.
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
