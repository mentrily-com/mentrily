'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

const COLLAPSED_KEY = 'ai-sidebar-collapsed';

/**
 * Full-screen, ChatGPT-style frame for the standalone /ai page: a collapsible
 * chat sidebar, a slim top bar, the chat in the middle and an optional side
 * panel (drafts). On small screens the sidebar becomes a drawer.
 */
export default function AiAppFrame({
    sidebar,
    topbarRight,
    panel,
    children,
    mobileOpen,
    onMobileOpenChange,
}: {
    sidebar: React.ReactNode;
    topbarRight?: React.ReactNode;
    panel?: React.ReactNode;
    children: React.ReactNode;
    mobileOpen: boolean;
    onMobileOpenChange: (open: boolean) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        try {
            setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === 'true');
        } catch {
            // Storage disabled: start expanded.
        }
    }, []);

    const setCollapsedPersisted = (next: boolean) => {
        setCollapsed(next);
        try {
            window.localStorage.setItem(COLLAPSED_KEY, String(next));
        } catch {
            // Not persisted; fine for this visit.
        }
    };

    return (
        <div className="flex h-dvh overflow-hidden bg-white text-slate-900">
            <aside
                aria-label="Mentrily AI sidebar"
                className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-slate-200 bg-slate-50 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
                    mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
                } ${collapsed ? 'md:hidden' : ''}`}
            >
                <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
                    <Link
                        href="/"
                        aria-label="Mentrily home"
                        className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1"
                    >
                        <BrandLogo className="h-7 max-w-[120px]" />
                        <span className="rounded-md bg-[var(--color-brand-light)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand-dark)]">
                            AI
                        </span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setCollapsedPersisted(true)}
                        className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 md:block"
                        aria-label="Close sidebar"
                        title="Close sidebar"
                    >
                        <PanelLeftClose size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMobileOpenChange(false)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 md:hidden"
                        aria-label="Close sidebar"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="min-h-0 flex-1">{sidebar}</div>
            </aside>
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Close sidebar"
                    onClick={() => onMobileOpenChange(false)}
                    className="fixed inset-0 z-40 bg-slate-900/25 md:hidden"
                />
            )}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 shrink-0 items-center gap-1 px-3">
                    <button
                        type="button"
                        onClick={() => onMobileOpenChange(true)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden"
                        aria-label="Open sidebar"
                    >
                        <PanelLeftOpen size={18} />
                    </button>
                    {collapsed && (
                        <button
                            type="button"
                            onClick={() => setCollapsedPersisted(false)}
                            className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:block"
                            aria-label="Open sidebar"
                            title="Open sidebar"
                        >
                            <PanelLeftOpen size={18} />
                        </button>
                    )}
                    <span className="px-1.5 text-[15px] font-semibold text-slate-800">Mentrily AI</span>
                    <div className="ml-auto flex items-center gap-2">{topbarRight}</div>
                </header>
                <div className="relative flex min-h-0 flex-1">
                    <main className="flex min-w-0 flex-1 flex-col">{children}</main>
                    {panel}
                </div>
            </div>
        </div>
    );
}
