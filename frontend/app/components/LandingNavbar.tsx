'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand/BrandLogo';

export function LandingNavbar() {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { name: 'Home', href: '/' },
        { name: 'Pricing', href: '/pricing' },
        { name: 'About', href: '/about' },
        { name: 'Contact', href: '/contact' },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center">
                        <BrandLogo className="h-8 max-w-[160px]" priority />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        {navItems.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'text-sm font-medium transition-colors hover:text-blue-600',
                                    pathname === item.href ? 'text-blue-600' : 'text-gray-600',
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}
                        <Link href="/login">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
                                Login
                            </Button>
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 text-gray-600 hover:text-blue-600 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-blue-600 rounded-md"
                            aria-label="Toggle mobile menu"
                            aria-expanded={isMobileMenuOpen}
                            aria-controls="mobile-menu"
                            aria-haspopup="menu"
                        >
                            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <motion.div
                    id="mobile-menu"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="md:hidden bg-white border-b border-gray-100"
                >
                    <div className="px-4 pt-2 pb-4 space-y-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={cn(
                                    'block px-3 py-2 rounded-md text-base font-medium transition-colors',
                                    pathname === item.href
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600',
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}
                        <div className="pt-4">
                            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full">
                                    Login
                                </Button>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            )}
        </nav>
    );
}
