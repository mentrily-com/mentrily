'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { LayoutDashboard } from 'lucide-react';
import AiAppFrame from '@/app/components/AiStudio/AiAppFrame';
import BrandedPageLoader from '@/app/components/Common/BrandedPageLoader';
import AiStudio from '@/app/components/AiStudio/AiStudio';
import { PublicPlaygroundProfile } from '@/app/components/Playground/PublicPlaygroundShell';
import { useSession } from '@/hooks/useSession';
import { STUDIO_RESUME_PATH, takePromptHandoff } from '@/lib/ai/promptHandoff';
import AiAccessGate, { type AiGateReason, type GatePrompt } from './AiAccessGate';
import { GuestSidebar, GuestThread, type Prefill, type PublicViewer } from './PublicStudio';

const CREATOR_ROLES = new Set(['TEACHER', 'ADMIN', 'SUPER_ADMIN']);

function dashboardHref(role: string) {
    if (role === 'SUPER_ADMIN') return '/dashboard/super-admin';
    if (role === 'TEACHER' || role === 'ADMIN') return '/dashboard/creator';
    return '/dashboard/learner';
}

function SignedInActions({ role }: { role: string }) {
    return (
        <>
            <Link
                href={dashboardHref(role)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            >
                <LayoutDashboard size={15} />
                <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <PublicPlaygroundProfile compact />
        </>
    );
}

function GuestActions() {
    return (
        <>
            <Link
                href={`/login?redirect=${encodeURIComponent(STUDIO_RESUME_PATH)}`}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
                Sign in
            </Link>
            <Link
                href="/signup"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
                Sign up free
            </Link>
        </>
    );
}

/** Guests and learners: the same app, with sending gated behind sign-in / a creator workspace. */
function PublicAi({ viewer, role }: { viewer: PublicViewer; role: string }) {
    const [prefill, setPrefill] = useState<Prefill>(null);
    const [gate, setGate] = useState<{ reason: AiGateReason; prompt?: GatePrompt } | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    const fill = useCallback((command: string, text = '') => {
        setPrefill({ command, text, nonce: Date.now() });
        setMobileOpen(false);
    }, []);
    const openGate = useCallback((reason: AiGateReason, prompt?: GatePrompt) => setGate({ reason, prompt }), []);

    // A prompt typed on the homepage (or before a sign-in) lands in the composer.
    useEffect(() => {
        const handoff = takePromptHandoff();
        if (handoff) fill(handoff.command, handoff.text);
    }, [fill]);

    return (
        <>
            <AiAppFrame
                sidebar={<GuestSidebar viewer={viewer} onFill={fill} onGate={openGate} />}
                topbarRight={viewer === 'guest' ? <GuestActions /> : <SignedInActions role={role} />}
                mobileOpen={mobileOpen}
                onMobileOpenChange={setMobileOpen}
            >
                <GuestThread viewer={viewer} prefill={prefill} onFill={fill} onGate={openGate} />
            </AiAppFrame>
            <AiAccessGate reason={gate?.reason ?? null} prompt={gate?.prompt} onClose={() => setGate(null)} />
        </>
    );
}

/**
 * The standalone, full-screen Mentrily AI app at /ai. Creators get the full
 * Studio (chats, drafts, credits) outside the dashboard; guests and learners
 * get the same interface with sending gated.
 */
export default function PublicAiPage() {
    const { isLoaded, isSignedIn } = useAuth();
    const { data: session, isLoading: sessionLoading } = useSession();

    const role = String(session?.role || '').toUpperCase();
    if (!isLoaded || (isSignedIn && (sessionLoading || !session))) return <BrandedPageLoader />;

    if (isSignedIn && CREATOR_ROLES.has(role)) {
        return (
            // AiStudio reads ?c= (the open chat) from the URL.
            <Suspense fallback={<BrandedPageLoader />}>
                <AiStudio variant="standalone" topbarRight={<SignedInActions role={role} />} />
            </Suspense>
        );
    }

    return <PublicAi viewer={isSignedIn ? 'learner' : 'guest'} role={role} />;
}
