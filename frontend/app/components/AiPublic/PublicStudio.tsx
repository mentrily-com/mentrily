'use client';

import 'streamdown/styles.css';
import React, { useCallback } from 'react';
import Link from 'next/link';
import { LogIn, Plus } from 'lucide-react';
import Composer, { type ComposerSubmit } from '@/app/components/AiStudio/Composer';
import { COMMANDS, STARTERS, commandById } from '@/app/components/AiStudio/commands';
import { savePromptHandoff, STUDIO_RESUME_PATH } from '@/lib/ai/promptHandoff';
import type { AiGateReason, GatePrompt } from './AiAccessGate';

export type PublicViewer = 'guest' | 'learner';
export type Prefill = { command: string; text: string; nonce: number } | null;

const SITE_LINKS = [
    { label: 'About Mentrily AI', href: '/ai' },
    { label: 'Home', href: '/' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Compilers', href: '/online-compilers' },
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
];

/** Sidebar for visitors who can't chat yet: new chat, sign-in, command list. */
export function GuestSidebar({
    viewer,
    onFill,
    onGate,
}: {
    viewer: PublicViewer;
    onFill: (command: string, text?: string) => void;
    onGate: (reason: AiGateReason) => void;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="p-3">
                <button
                    type="button"
                    onClick={() => onFill('', '')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                    <Plus size={16} /> New chat
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                <div className="mx-1 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">Your chats will appear here</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        {viewer === 'guest'
                            ? 'Sign in to keep conversations, reopen outlines and send drafts to your builder.'
                            : 'Open a creator workspace to keep conversations and send drafts to your builder.'}
                    </p>
                    {viewer === 'guest' ? (
                        <Link
                            href={`/login?redirect=${encodeURIComponent(STUDIO_RESUME_PATH)}`}
                            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[var(--color-border-brand)] hover:text-[var(--brand-dark)]"
                        >
                            <LogIn size={13} /> Sign in
                        </Link>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onGate('learner')}
                            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[var(--color-border-brand)] hover:text-[var(--brand-dark)]"
                        >
                            Open creator workspace
                        </button>
                    )}
                </div>

                <p className="mt-5 px-2.5 pb-1 text-[11px] font-medium text-slate-400">Commands</p>
                <ul className="space-y-0.5">
                    {COMMANDS.map((c) => {
                        const Icon = c.icon;
                        return (
                            <li key={c.label}>
                                <button
                                    type="button"
                                    onClick={() => onFill(c.command.id)}
                                    className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-white/70"
                                >
                                    <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                                    <span className="min-w-0">
                                        <span className="block text-sm text-slate-800">/{c.label}</span>
                                        <span className="block truncate text-xs text-slate-500">{c.description}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <nav
                aria-label="Mentrily"
                className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200/70 px-4 py-3 text-[11px] text-slate-400"
            >
                {SITE_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} className="hover:text-slate-700">
                        {l.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}

/**
 * The chat area for visitors who can't chat yet: everything is interactive
 * (commands, options, starters) except sending, which saves the prompt and
 * asks them to sign in or open a creator workspace.
 */
export function GuestThread({
    viewer,
    prefill,
    onFill,
    onGate,
}: {
    viewer: PublicViewer;
    prefill: Prefill;
    onFill: (command: string, text?: string) => void;
    onGate: (reason: AiGateReason, prompt?: GatePrompt) => void;
}) {
    const reason: AiGateReason = viewer === 'guest' ? 'guest' : 'learner';

    const submit = useCallback(
        (value: ComposerSubmit) => {
            savePromptHandoff({ command: value.command?.command.id ?? '', text: value.text });
            onGate(reason, { command: value.command?.label, text: value.text });
            // Keep the text in the composer; nothing was sent.
            return false;
        },
        [onGate, reason],
    );

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-5 py-8">
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                        What are you teaching next?
                    </h1>
                    <p className="mt-3 max-w-lg text-[15px] leading-7 text-slate-500">
                        Plan a course, build an exam or write a quiz with AI, then drop it straight into your builder.
                        Ask anything about what you teach, or start with a command.
                    </p>
                    <div className="mt-7 grid gap-2 sm:grid-cols-2">
                        {STARTERS.map((s) => {
                            const info = commandById(s.command);
                            const Icon = info?.icon;
                            return (
                                <button
                                    key={s.text}
                                    type="button"
                                    onClick={() => onFill(s.command, s.text)}
                                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-[var(--color-border-brand)] hover:bg-[var(--color-brand-light)]/40"
                                >
                                    {Icon && (
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                                            <Icon size={15} />
                                        </span>
                                    )}
                                    <span className="min-w-0">
                                        <span className="block text-xs font-medium text-slate-500">/{info?.label}</span>
                                        <span className="block text-sm leading-5 text-slate-800">{s.text}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-3xl px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
                <Composer
                    busy={false}
                    onSubmit={submit}
                    onStop={() => undefined}
                    onLocked={() => onGate(reason)}
                    prefill={prefill}
                    showEstimate={false}
                />
                <p className="mt-2 text-center text-[11px] text-slate-400">
                    {viewer === 'guest'
                        ? 'Sign in to send. Free accounts include monthly AI credits.'
                        : 'Sending opens your creator workspace.'}
                </p>
            </div>
        </div>
    );
}
