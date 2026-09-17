'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowDown, Loader2, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-base';
import { buildAiHeaders } from '@/services/api/AiService';
import type { AiUsage } from '@/lib/ai/types';
import Composer, { type ComposerSubmit } from './Composer';
import MessageView, { type StudioMessage } from './MessageView';
import { STARTERS, commandById } from './commands';

type RequestBody = Record<string, unknown>;

export default function ChatThread({
    chatKey,
    conversationId,
    initialMessages,
    pendingReply,
    usage,
    childJobs,
    activeJobId,
    onOpenJob,
    onConversationId,
    onActivity,
    onError,
    onLocked,
    resumed,
    onDismissResumed,
}: {
    chatKey: string;
    conversationId: string | null;
    initialMessages: StudioMessage[];
    pendingReply: boolean;
    usage?: AiUsage;
    childJobs: Record<string, string>;
    activeJobId: string | null;
    onOpenJob: (jobId: string) => void;
    onConversationId: (id: string) => void;
    onActivity: () => void;
    onError: (err: unknown) => void;
    onLocked: (message: string) => void;
    /** A prompt carried over from the public /ai page, applied once. */
    resumed?: { command: string; text: string; nonce: number } | null;
    onDismissResumed?: () => void;
}) {
    const conversationRef = useRef<string | null>(conversationId);
    const lastBodyRef = useRef<RequestBody>({});
    const [prefill, setPrefill] = useState<{ command: string; text: string; nonce: number } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<StudioMessage[]>([]);
    const [atBottom, setAtBottom] = useState(true);

    useEffect(() => {
        if (resumed) setPrefill(resumed);
    }, [resumed]);

    useEffect(() => {
        conversationRef.current = conversationId;
    }, [conversationId]);

    const transport = useMemo(
        () =>
            new DefaultChatTransport<StudioMessage>({
                api: `${API_BASE_URL}/ai/chat`,
                credentials: 'include',
                // The server keeps history; only the newest message is sent.
                prepareSendMessagesRequest: async ({ messages, body, trigger }) => ({
                    body: {
                        ...(body ?? lastBodyRef.current),
                        conversationId: conversationRef.current ?? undefined,
                        message: [...messages].reverse().find((m) => m.role === 'user'),
                        trigger,
                    },
                    headers: await buildAiHeaders('POST', false),
                }),
            }),
        [],
    );

    const { messages, sendMessage, status, stop, regenerate, setMessages } = useChat<StudioMessage>({
        id: chatKey,
        messages: initialMessages,
        transport,
        experimental_throttle: 40,
        onFinish: ({ message }) => {
            const id = message.metadata?.conversationId;
            if (id && id !== conversationRef.current) {
                conversationRef.current = id;
                onConversationId(id);
            }
            onActivity();
        },
        onError: (error) => {
            onError(error);
            // Give the unsent text back so nothing typed is lost.
            const last = messagesRef.current.at(-1);
            if (last?.role !== 'user') return;
            const raw = last.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
            const command = last.metadata?.command ?? '';
            setPrefill({ command, text: command ? raw.replace(/^\/\w+\s*/, '') : raw, nonce: Date.now() });
            setMessages((prev) => (prev.at(-1)?.id === last.id ? prev.slice(0, -1) : prev));
        },
    });
    messagesRef.current = messages;

    const busy = status === 'submitted' || status === 'streaming';

    // Keep the newest content in view while the reader is at the bottom.
    useEffect(() => {
        const el = scrollRef.current;
        if (el && atBottom) el.scrollTop = el.scrollHeight;
    }, [messages, atBottom, status]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    };

    const submit = useCallback(
        (v: ComposerSubmit) => {
            const references = v.references.map(({ kind, id, title }) => ({ kind, id, title }));
            const body: RequestBody =
                v.command?.command.kind === 'job'
                    ? { command: { kind: v.command.command.job, brief: v.brief, quality: v.jobQuality }, references }
                    : {
                          intent: v.command?.command.kind === 'chat' ? v.command.command.intent : 'ask',
                          quality: v.chatQuality,
                          references,
                      };
            lastBodyRef.current = body;
            setAtBottom(true);
            void sendMessage(
                {
                    text: v.command ? `/${v.command.label} ${v.text}` : v.text,
                    metadata: { command: v.command?.command.id, references },
                },
                { body },
            );
            return true;
        },
        [sendMessage],
    );

    let lastAssistantIndex = -1;
    messages.forEach((m, i) => {
        if (m.role === 'assistant') lastAssistantIndex = i;
    });
    const lastIsJob = messages[lastAssistantIndex]?.parts.some((p) => p.type === 'data-job');

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-5 py-10">
                        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                            What are you teaching next?
                        </h1>
                        <p className="mt-3 max-w-lg text-[15px] leading-7 text-slate-500">
                            Ask a question, or start with a command to plan a course, build an exam or write a quiz you
                            can drop straight into your builder.
                        </p>
                        <div className="mt-8 grid gap-2 sm:grid-cols-2">
                            {STARTERS.map((s) => {
                                const info = commandById(s.command);
                                const Icon = info?.icon;
                                return (
                                    <button
                                        key={s.text}
                                        type="button"
                                        onClick={() =>
                                            setPrefill({ command: s.command, text: s.text, nonce: Date.now() })
                                        }
                                        className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-[var(--color-border-brand)] hover:bg-[var(--color-brand-light)]/40"
                                    >
                                        {Icon && (
                                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                                                <Icon size={15} />
                                            </span>
                                        )}
                                        <span className="min-w-0">
                                            <span className="block text-xs font-medium text-slate-500">
                                                /{info?.label}
                                            </span>
                                            <span className="block text-sm leading-5 text-slate-800">{s.text}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
                        {messages.map((m, i) => (
                            <MessageView
                                key={m.id}
                                message={m}
                                streaming={busy}
                                isLast={i === messages.length - 1}
                                childJobs={childJobs}
                                activeJobId={activeJobId}
                                onOpenJob={onOpenJob}
                                onRegenerate={
                                    i === lastAssistantIndex && !lastIsJob && !busy
                                        ? () => void regenerate()
                                        : undefined
                                }
                            />
                        ))}
                        {(status === 'submitted' || pendingReply) && (
                            <p className="flex items-center gap-2 text-sm text-slate-500" aria-live="polite">
                                <Loader2 size={15} className="animate-spin text-[var(--brand)]" />
                                {pendingReply ? 'Still writing the reply…' : 'Thinking…'}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="relative mx-auto w-full max-w-3xl px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
                {!atBottom && messages.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setAtBottom(true)}
                        className="absolute -top-10 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:text-slate-900"
                        aria-label="Scroll to latest"
                    >
                        <ArrowDown size={15} />
                    </button>
                )}
                {resumed && (
                    <div
                        role="status"
                        className="mb-2 flex items-start gap-2 rounded-xl border border-[var(--color-border-brand)] bg-[var(--color-brand-light)]/50 px-3 py-2 text-xs text-slate-700"
                    >
                        <span className="min-w-0 flex-1">Your prompt is ready. Review it and press send.</span>
                        <button
                            type="button"
                            onClick={onDismissResumed}
                            className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700"
                            aria-label="Dismiss"
                        >
                            <X size={13} />
                        </button>
                    </div>
                )}
                <Composer
                    usage={usage}
                    busy={busy}
                    onSubmit={submit}
                    onStop={stop}
                    onLocked={onLocked}
                    prefill={prefill}
                />
                <p className="mt-2 text-center text-[11px] text-slate-400">
                    AI can make mistakes. Review generated content before learners see it.
                </p>
            </div>
        </div>
    );
}
