'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

const navLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
];

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 16);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileOpen]);

    return (
        <>
            <header
                className="fixed top-0 left-0 right-0 z-50 transition-all duration-250"
                style={{
                    backgroundColor: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
                    backdropFilter: scrolled ? 'blur(12px)' : 'none',
                    boxShadow: scrolled ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                }}
            >
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center cursor-pointer" aria-label="Home">
                        <BrandLogo className="h-9 max-w-[178px] sm:h-10 sm:max-w-[200px]" priority />
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="relative text-sm font-medium transition-colors duration-150 cursor-pointer group"
                                style={{ color: '#475569' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#008D98')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
                            >
                                {link.label}
                                <span
                                    className="absolute -bottom-1 left-0 h-0.5 w-full origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
                                    style={{ backgroundColor: '#008D98' }}
                                />
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTAs */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link
                            href="/login"
                            className="px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-150 cursor-pointer"
                            style={{
                                color: '#475569',
                                borderColor: '#E2E8F0',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#F8FAFC';
                                e.currentTarget.style.borderColor = '#008D98';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                            }}
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/signup"
                            className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all duration-150 cursor-pointer"
                            style={{ backgroundColor: '#008D98' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006F78')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#008D98')}
                        >
                            Start Free
                        </Link>
                    </div>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="md:hidden p-2 rounded-lg cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
                        style={{ color: '#0F172A' }}
                        aria-label="Toggle menu"
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-menu"
                        aria-haspopup="menu"
                    >
                        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </nav>
            </header>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        id="mobile-menu"
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="fixed inset-0 z-[60] md:hidden"
                        style={{ backgroundColor: '#FFFFFF' }}
                    >
                        <div className="flex items-center justify-between px-4 h-16">
                            <BrandLogo className="h-8 max-w-[160px]" priority />
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="p-2 rounded-lg cursor-pointer"
                                style={{ color: '#0F172A' }}
                                aria-label="Close menu"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-6 pt-16">
                            {navLinks.map((link, i) => (
                                <motion.div
                                    key={link.href}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 + i * 0.05 }}
                                >
                                    <Link
                                        href={link.href}
                                        onClick={() => setMobileOpen(false)}
                                        className="text-2xl font-medium cursor-pointer"
                                        style={{ color: '#0F172A' }}
                                    >
                                        {link.label}
                                    </Link>
                                </motion.div>
                            ))}

                            <div className="flex flex-col gap-3 mt-8 w-60">
                                <Link
                                    href="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="px-6 py-3 text-center text-sm font-medium rounded-lg border cursor-pointer"
                                    style={{ color: '#475569', borderColor: '#E2E8F0' }}
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/signup"
                                    onClick={() => setMobileOpen(false)}
                                    className="px-6 py-3 text-center text-sm font-semibold text-white rounded-lg cursor-pointer"
                                    style={{ backgroundColor: '#008D98' }}
                                >
                                    Start Free
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
