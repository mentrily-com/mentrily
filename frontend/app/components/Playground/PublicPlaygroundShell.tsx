'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import {
    BookOpenCheck,
    Code2,
    FileCode2,
    LayoutDashboard,
    LogOut,
    Menu,
    NotebookTabs,
    Sparkles,
    User,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useSession } from '@/hooks/useSession';

const playgroundItems = [
    { label: 'Coding', href: '/online-javascript-compiler', icon: Code2 },
    { label: 'HTML/CSS', href: '/online-html-editor', icon: FileCode2 },
    { label: 'Python Notebook', href: '/online-python-notebook', icon: NotebookTabs },
];

export default function PublicPlaygroundShell({
    children,
    embedded = false,
    showQuestionBuilder = false,
    seoHeader,
    seoContent,
}: {
    children: React.ReactNode;
    embedded?: boolean;
    showQuestionBuilder?: boolean;
    seoHeader?: React.ReactNode;
    seoContent?: React.ReactNode;
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
        <div
            className={`public-playground-page bg-[#F8FAFC] text-slate-900 ${
                embedded ? 'h-full min-h-0' : 'min-h-screen'
            }`}
        >
            {!embedded && (
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
                                <PublicDashboardNavItem />
                            </nav>
                        </div>

                        <div className="hidden items-center gap-2 md:flex">
                            <PublicPlaygroundProfile />
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
                                <PublicDashboardNavItem mobile onNavigate={() => setOpen(false)} />
                            </div>
                            <div className="mt-3">
                                <PublicPlaygroundProfile mobile />
                            </div>
                        </div>
                    )}
                </header>
            )}

            <main
                className={
                    embedded
                        ? 'h-full min-h-0 w-full bg-[#F8FAFC] p-3 lg:p-4'
                        : 'mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1660px] px-4 py-4 lg:px-6'
                }
            >
                <div
                    className={
                        embedded
                            ? `h-full min-h-0 ${showQuestionBuilder ? 'grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]' : ''}`
                            : 'grid min-h-[calc(100vh-6rem)] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1120px)_minmax(260px,1fr)]'
                    }
                >
                    <div className={embedded ? 'h-full min-h-0 min-w-0' : 'min-h-[calc(100vh-6rem)] min-w-0'}>
                        {seoHeader}
                        <div className={embedded ? 'h-full min-h-0' : ''}>{children}</div>
                        {seoContent}
                    </div>
                    {showQuestionBuilder && (
                        <aside className="hidden min-h-0 xl:block">
                            <div className="sticky top-4">
                                <QuestionBuilderCard onOpen={openQuestionBuilder} />
                            </div>
                        </aside>
                    )}
                    {!embedded && (
                        <aside className="hidden min-h-[calc(100vh-6rem)] xl:block">
                            <div className="sticky top-20 space-y-3">
                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand)]">
                                        Mentrily
                                    </p>
                                    <h2 className="mt-1 text-sm font-black leading-tight">
                                        Create your own course or exam
                                    </h2>
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
                                <QuestionBuilderCard onOpen={openQuestionBuilder} />
                            </div>
                        </aside>
                    )}
                </div>
            </main>
        </div>
    );
}

function QuestionBuilderCard({ onOpen }: { onOpen: () => void }) {
    return (
        <button
            onClick={onOpen}
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
                    <span className="block text-sm font-black leading-tight">Create your own question and share</span>
                    <span className="mt-1 block text-[11px] font-semibold leading-snug text-slate-500">
                        Build one coding challenge and send a short-lived practice link.
                    </span>
                </span>
            </span>
        </button>
    );
}

function PublicPlaygroundProfile({ mobile = false }: { mobile?: boolean }) {
    const { isLoaded, isSignedIn } = useAuth();
    const { user: clerkUser } = useUser();
    const clerk = useClerk();
    const { data: sessionUser } = useSession();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function close(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    if (!isLoaded) {
        return <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-100" />;
    }

    if (!isSignedIn) {
        return (
            <div className={mobile ? 'grid grid-cols-2 gap-2' : 'flex items-center gap-2'}>
                <Link
                    href="/login"
                    className="rounded-xl px-4 py-2 text-center text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                    Sign in
                </Link>
                <Link
                    href="/signup"
                    className="rounded-xl bg-[var(--brand)] px-4 py-2 text-center text-sm font-black text-white"
                >
                    Sign up
                </Link>
            </div>
        );
    }

    const name = String(sessionUser?.name || clerkUser?.fullName || 'User');
    const email = String(sessionUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || '');
    const avatarUrl = clerkUser?.imageUrl || (sessionUser?.profilePicture as string | undefined);
    const initial = name.charAt(0).toUpperCase();
    const role = String(sessionUser?.role || '').toUpperCase();
    const profileHref =
        role === 'SUPER_ADMIN'
            ? '/dashboard/super-admin/profile'
            : role === 'TEACHER' || role === 'ADMIN'
              ? '/dashboard/creator/profile'
              : '/dashboard/learner/profile';

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-slate-300"
            >
                <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--brand)] text-xs font-black text-white">
                        {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                        ) : (
                            initial
                        )}
                    </span>
                    <span className="hidden min-w-0 sm:block">
                        <span className="block truncate text-xs font-black text-slate-800">{name}</span>
                        {email && (
                            <span className="block truncate text-[10px] font-semibold text-slate-400">{email}</span>
                        )}
                    </span>
                </span>
            </button>
            {open && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <Link
                        href={profileHref}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    >
                        <User size={16} />
                        Profile
                    </Link>
                    <button
                        type="button"
                        onClick={() => clerk.signOut({ redirectUrl: '/login' })}
                        className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-bold text-rose-600 hover:bg-rose-50"
                    >
                        <LogOut size={16} />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

function PublicDashboardNavItem({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
    const { isLoaded, isSignedIn } = useAuth();
    const { data: sessionUser } = useSession();

    if (!isLoaded || !isSignedIn) {
        return null;
    }

    const role = String(sessionUser?.role || '').toUpperCase();
    const href =
        role === 'SUPER_ADMIN'
            ? '/dashboard/super-admin'
            : role === 'TEACHER' || role === 'ADMIN'
              ? '/dashboard/creator'
              : '/dashboard/learner';

    if (mobile) {
        return (
            <Link
                href={href}
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-600"
            >
                <LayoutDashboard size={16} />
                Dashboard
            </Link>
        );
    }

    return (
        <Link
            href={href}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-white hover:text-[var(--brand)] hover:shadow-sm"
        >
            <LayoutDashboard size={15} />
            Dashboard
        </Link>
    );
}
