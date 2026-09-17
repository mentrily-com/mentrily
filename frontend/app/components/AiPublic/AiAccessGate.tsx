'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import AppModal from '@/app/components/Common/AppModal';
import { AuthService, type WorkspaceMembership } from '@/services/api/AuthService';
import { STUDIO_RESUME_PATH } from '@/lib/ai/promptHandoff';

export type AiGateReason = 'guest' | 'learner';
export type GatePrompt = { command?: string; text: string };

const LOGIN_HREF = `/login?redirect=${encodeURIComponent(STUDIO_RESUME_PATH)}`;
const CREATOR_ROLES = new Set(['TEACHER', 'ADMIN', 'SUPER_ADMIN']);

const primaryButton =
    'flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)] disabled:opacity-60';
const secondaryButton =
    'flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50';

/** The message exactly as it will appear in the chat once sent. */
function MessagePreview({ prompt }: { prompt: GatePrompt }) {
    return (
        <div className="flex justify-end rounded-2xl bg-slate-50 px-4 py-5">
            <div className="max-w-[90%] space-y-1.5">
                {prompt.command && (
                    <div className="flex justify-end">
                        <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                            /{prompt.command}
                        </span>
                    </div>
                )}
                <p className="line-clamp-4 whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-slate-200 bg-white px-4 py-2.5 text-[15px] leading-6 text-slate-900">
                    {prompt.text}
                </p>
            </div>
        </div>
    );
}

function GuestGate({ prompt }: { prompt?: GatePrompt }) {
    return (
        <div className="space-y-5">
            {prompt && <MessagePreview prompt={prompt} />}
            <p className="text-sm leading-6 text-slate-600">
                {prompt
                    ? 'Your message is saved on this device and will be waiting in the chat after you sign in.'
                    : 'Create a free account to chat, plan courses and build exams with Mentrily AI.'}
            </p>
            <div className="space-y-2">
                <Link href="/signup" className={primaryButton}>
                    Create free account
                </Link>
                <Link href={LOGIN_HREF} className={secondaryButton}>
                    Sign in
                </Link>
            </div>
            <p className="text-center text-xs text-slate-500">Free accounts include monthly AI credits.</p>
        </div>
    );
}

function LearnerGate({ prompt }: { prompt?: GatePrompt }) {
    const [memberships, setMemberships] = useState<WorkspaceMembership[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        AuthService.listMemberships()
            .then((list) => alive && setMemberships(list))
            .catch(() => alive && setMemberships([]));
        return () => {
            alive = false;
        };
    }, []);

    const creatorWorkspaces = (memberships ?? []).filter((m) => CREATOR_ROLES.has(m.role));

    const openWorkspace = async (membership: WorkspaceMembership) => {
        // Strict orgs are only usable on their own domain.
        if (membership.orgKind === 'STRICT' && membership.orgDomain) {
            window.location.href = `https://${membership.orgDomain}${STUDIO_RESUME_PATH}`;
            return;
        }
        setBusy(membership.orgId);
        setError(null);
        try {
            await AuthService.switchOrg(membership.orgId);
            window.location.href = STUDIO_RESUME_PATH;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not open that workspace');
            setBusy(null);
        }
    };

    const becomeCreator = async () => {
        setBusy('new');
        setError(null);
        try {
            const persona = await AuthService.becomeCreator();
            await AuthService.switchOrg(persona.orgId);
            window.location.href = STUDIO_RESUME_PATH;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not set up your creator workspace');
            setBusy(null);
        }
    };

    return (
        <div className="space-y-5">
            {prompt && <MessagePreview prompt={prompt} />}
            {memberships === null ? (
                <p className="flex items-center gap-2 text-sm text-slate-500" aria-live="polite">
                    <Loader2 size={15} className="animate-spin" /> Checking your workspaces…
                </p>
            ) : creatorWorkspaces.length > 0 ? (
                <div className="space-y-3">
                    <p className="text-sm leading-6 text-slate-600">
                        Mentrily AI works in your creator workspace. Pick one to continue
                        {prompt ? ' and your message will be waiting there.' : '.'}
                    </p>
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                        {creatorWorkspaces.map((m) => (
                            <li key={m.orgId}>
                                <button
                                    type="button"
                                    disabled={busy !== null}
                                    onClick={() => void openWorkspace(m)}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-slate-900">
                                            {m.orgName}
                                        </span>
                                        <span className="block text-xs capitalize text-slate-500">
                                            {m.role.toLowerCase().replace('_', ' ')}
                                        </span>
                                    </span>
                                    {busy === m.orgId ? (
                                        <Loader2 size={16} className="shrink-0 animate-spin text-[var(--brand)]" />
                                    ) : (
                                        <ChevronRight size={16} className="shrink-0 text-slate-400" />
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm leading-6 text-slate-600">
                        Mentrily AI works in a creator workspace, where you build courses and exams. Setting one up is
                        free, and your learner account stays exactly as it is.
                    </p>
                    <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void becomeCreator()}
                        className={primaryButton}
                    >
                        {busy === 'new' && <Loader2 size={16} className="animate-spin" />}
                        {busy === 'new' ? 'Setting up your workspace…' : 'Set up a creator workspace'}
                    </button>
                </div>
            )}
            {error && (
                <p role="alert" className="text-sm text-rose-600">
                    {error}
                </p>
            )}
        </div>
    );
}

export default function AiAccessGate({
    reason,
    prompt,
    onClose,
}: {
    reason: AiGateReason | null;
    prompt?: GatePrompt;
    onClose: () => void;
}) {
    // AppModal truncates long titles; keep these short.
    const title =
        reason === 'learner' ? 'Open a creator workspace' : prompt ? 'Sign in to send this' : 'Sign in to continue';
    return (
        <AppModal isOpen={reason !== null} onClose={onClose} size="sm" title={title}>
            {reason === 'learner' ? <LearnerGate prompt={prompt} /> : <GuestGate prompt={prompt} />}
        </AppModal>
    );
}
