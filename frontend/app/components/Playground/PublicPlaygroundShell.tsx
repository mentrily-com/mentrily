'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenCheck, Code2, FileCode2, Menu, NotebookTabs, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';

const playgroundItems = [
    { label: 'Coding', href: '/online-javascript-compiler', icon: Code2 },
    { label: 'HTML/CSS', href: '/online-html-editor', icon: FileCode2 },
    { label: 'Python Notebook', href: '/online-python-notebook', icon: NotebookTabs },
];

export default function PublicPlaygroundShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const openQuestionBuilder = () => {
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('open-public-question-builder', { cancelable: true });
            const handled = !window.dispatchEvent(event);
            if (!handled) {
                window.location.href = '/online-javascript-compiler?create=1';
            }
        }
    };

    return (
        <div className="public-playground-page min-h-screen bg-[#F8FAFC] text-slate-900">
            <header className="sticky top-0 z-[1000] border-b border-slate-100 bg-white/90 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="flex items-center">
                            <BrandLogo className="h-8 max-w-[160px]" priority />
                        </Link>
                        <nav className="hidden items-center gap-1 rounded-xl bg-slate-50 p-1 md:flex">
                            {playgroundItems.map((item) => {
                                const Icon = item.icon;
                                const active =
                                    pathname === item.href ||
                                    (item.label === 'Coding' && pathname?.includes('compiler'));
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${
                                            active
                                                ? 'bg-white text-[var(--brand)] shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        <Icon size={15} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="hidden items-center gap-2 md:flex">
                        <Link
                            href="/login"
                            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Sign in
                        </Link>
                        <Link href="/signup" className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-black text-white">
                            Sign up
                        </Link>
                    </div>

                    <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-slate-500 md:hidden">
                        {open ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {open && (
                    <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
                        <div className="grid gap-2">
                            {playgroundItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                        className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-600"
                                    >
                                        <Icon size={16} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <Link href="/login" className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-bold text-slate-600">
                                Sign in
                            </Link>
                            <Link href="/signup" className="rounded-xl bg-[var(--brand)] px-4 py-2 text-center text-sm font-black text-white">
                                Sign up
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1660px] px-4 py-4 lg:px-6">
                <div className="grid min-h-[calc(100vh-6rem)] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1120px)_minmax(260px,1fr)]">
                    <div className="min-h-[calc(100vh-6rem)] min-w-0">{children}</div>
                    <aside className="hidden min-h-[calc(100vh-6rem)] xl:block">
                        <div className="sticky top-20 space-y-3">
                            <div
                                className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm"
                            >
                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand)]">
                                    Mentrily
                                </p>
                                <h2 className="mt-1 text-sm font-black leading-tight">Create your own course or exam</h2>
                                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                                    Turn practice problems into full lessons, tests, and learner dashboards.
                                </p>
                                <Link
                                    href="/signup"
                                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-black text-white"
                                >
                                    <BookOpenCheck size={14} />
                                    Start free
                                </Link>
                            </div>
                            <button
                                onClick={openQuestionBuilder}
                                className="group relative flex w-full overflow-hidden rounded-xl border border-cyan-200 bg-white p-3 text-left text-slate-800 shadow-lg shadow-cyan-200/50 transition hover:border-[var(--brand)]"
                            >
                                <span className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-cyan-400/25 blur-2xl transition group-hover:bg-cyan-300/40" />
                                <span className="relative flex w-full items-start gap-3">
                                    <span className="mt-0.5 rounded-lg bg-cyan-50 p-2 text-[var(--brand)]">
                                        <Code2 size={16} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                                            <Sparkles size={10} />
                                            New
                                        </span>
                                        <span className="block text-sm font-black leading-tight">
                                            Create your own question and share
                                        </span>
                                        <span className="mt-1 block text-[11px] font-semibold leading-snug text-slate-500">
                                            Build one coding challenge and send a short-lived practice link.
                                        </span>
                                    </span>
                                </span>
                            </button>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}
