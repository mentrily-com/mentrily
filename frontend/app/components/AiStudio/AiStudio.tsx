'use client';

import 'streamdown/styles.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Maximize2, PanelLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AiService } from '@/services/api/AiService';
import { useAiUsage, useRefreshAiUsage } from '@/hooks/useAi';
import { useAiErrorGate } from '@/app/components/AiShared/useAiErrorGate';
import { takePromptHandoff } from '@/lib/ai/promptHandoff';
import AiAppFrame from './AiAppFrame';
import ConversationList from './ConversationList';
import ChatThread from './ChatThread';
import DraftPanel from './DraftPanel';
import type { StudioMessage } from './MessageView';

const CONVERSATIONS_KEY = ['ai-conversations'] as const;

function setUrl(id: string | null, mode: 'push' | 'replace') {
    const url = id ? `?c=${id}` : window.location.pathname;
    window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
}

export default function AiStudio({
    variant = 'embedded',
    topbarRight,
}: {
    /** `standalone` renders the full-screen /ai app; `embedded` sits inside the dashboard. */
    variant?: 'embedded' | 'standalone';
    topbarRight?: React.ReactNode;
} = {}) {
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { data: usage } = useAiUsage();
    const refreshUsage = useRefreshAiUsage();
    const { handleError, promptUpgrade, modal } = useAiErrorGate();

    const [activeId, setActiveId] = useState<string | null>(() => searchParams.get('c'));
    // Bumped only on explicit navigation, so a conversation created mid-stream
    // keeps its live chat instead of remounting.
    const [session, setSession] = useState(0);
    const createdHere = useRef(new Set<string>());
    const [panelJobId, setPanelJobId] = useState<string | null>(null);
    const [localChildren, setLocalChildren] = useState<Record<string, string>>({});
    const [listOpen, setListOpen] = useState(false);
    const [resumed, setResumed] = useState<{ command: string; text: string; nonce: number } | null>(null);

    // Pick up a prompt written on the public /ai page before signing in.
    useEffect(() => {
        const handoff = takePromptHandoff();
        if (handoff && !searchParams.get('c')) {
            setResumed({ command: handoff.command, text: handoff.text, nonce: Date.now() });
        }
        if (searchParams.has('resume')) setUrl(searchParams.get('c'), 'replace');
        // Once, on arrival.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const conversations = useQuery({
        queryKey: CONVERSATIONS_KEY,
        queryFn: AiService.listConversations,
        staleTime: 15_000,
    });

    const needsDetail = Boolean(activeId) && !createdHere.current.has(activeId as string);
    const detail = useQuery({
        queryKey: ['ai-conversation', activeId, session],
        queryFn: () => AiService.getConversation(activeId as string),
        enabled: needsDetail,
        staleTime: Infinity,
        retry: false,
    });

    const messages = useMemo(() => (detail.data?.messages ?? []) as unknown as StudioMessage[], [detail.data]);
    const pendingReply =
        messages.at(-1)?.role === 'user' &&
        Date.now() - new Date(detail.data?.conversation.lastMessageAt ?? 0).getTime() < 3 * 60_000;

    // A reply that was still streaming when the page loaded: poll until it lands.
    useEffect(() => {
        if (!pendingReply) return;
        const t = setInterval(() => void detail.refetch(), 3000);
        return () => clearInterval(t);
    }, [pendingReply, detail]);

    const serverChildren = useMemo(() => {
        const map: Record<string, string> = {};
        for (const job of detail.data?.jobs ?? []) if (job.parentJobId) map[job.parentJobId] = job.id;
        return map;
    }, [detail.data]);
    const children = useMemo(() => ({ ...serverChildren, ...localChildren }), [serverChildren, localChildren]);

    // Cards and panels follow a chain to its newest job (outline → draft → retry).
    const latest = useCallback(
        (id: string) => {
            let cur = id;
            for (let i = 0; i < 10 && children[cur]; i++) cur = children[cur];
            return cur;
        },
        [children],
    );
    const chainTips = useMemo(() => {
        const map: Record<string, string> = {};
        for (const root of Object.keys(children)) map[root] = latest(root);
        return map;
    }, [children, latest]);
    const parentOf = useMemo(() => {
        const map: Record<string, string> = {};
        for (const [parent, child] of Object.entries(children)) map[child] = parent;
        return map;
    }, [children]);

    useEffect(() => {
        if (detail.error) {
            handleError(detail.error);
            setActiveId(null);
            setUrl(null, 'replace');
        }
    }, [detail.error, handleError]);

    useEffect(() => {
        const onPop = () => {
            const id = new URLSearchParams(window.location.search).get('c');
            setActiveId(id);
            setSession((s) => s + 1);
            setPanelJobId(null);
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    const select = (id: string | null) => {
        setListOpen(false);
        if (id === activeId) return;
        setActiveId(id);
        setSession((s) => s + 1);
        setPanelJobId(null);
        setLocalChildren({});
        setResumed(null);
        setUrl(id, 'push');
    };

    const onConversationId = useCallback(
        (id: string) => {
            createdHere.current.add(id);
            setResumed(null);
            setActiveId(id);
            setUrl(id, 'replace');
            void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        },
        [queryClient],
    );

    const onActivity = useCallback(() => {
        void refreshUsage();
        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        // Picks up jobs the reply started (e.g. an edit), so version chains link up.
        if (activeId) void queryClient.invalidateQueries({ queryKey: ['ai-conversation', activeId] });
    }, [queryClient, refreshUsage, activeId]);

    const openJob = useCallback((jobId: string) => {
        setPanelJobId(jobId);
    }, []);

    const onChildJob = useCallback((parentId: string, childId: string) => {
        setLocalChildren((prev) => ({ ...prev, [parentId]: childId }));
        setPanelJobId(childId);
    }, []);

    const updateConversation = async (id: string, data: { title?: string; pinned?: boolean }) => {
        try {
            await AiService.updateConversation(id, data);
            void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        } catch (err) {
            handleError(err);
        }
    };

    const deleteConversation = async (id: string) => {
        try {
            await AiService.deleteConversation(id);
            if (id === activeId) select(null);
            void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        } catch (err) {
            handleError(err);
        }
    };

    const standalone = variant === 'standalone';
    const fullScreenHref = `/chat${activeId ? `?c=${activeId}` : ''}`;

    if (usage && !usage.features.aiStudio) {
        const locked = (
            <div className="grid h-full place-items-center p-6">
                <div className="max-w-sm text-center">
                    <Lock className="mx-auto text-slate-400" />
                    <h1 className="mt-3 text-lg font-semibold text-slate-900">AI Studio isn&apos;t on your plan</h1>
                    <p className="mt-1 text-sm text-slate-500">Upgrade to plan courses and exams with AI.</p>
                    <Link
                        href="/dashboard/creator/billing"
                        className="mt-4 inline-block rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
                    >
                        See plans
                    </Link>
                </div>
            </div>
        );
        if (standalone) {
            return (
                <AiAppFrame
                    sidebar={null}
                    topbarRight={topbarRight}
                    mobileOpen={listOpen}
                    onMobileOpenChange={setListOpen}
                >
                    {locked}
                </AiAppFrame>
            );
        }
        return (
            <div className="h-[calc(100vh-var(--topbar-height)-36px)] rounded-2xl border border-slate-200 bg-white">
                {locked}
            </div>
        );
    }

    const loadingThread = needsDetail && detail.isLoading;
    const chatKey = `studio-${session}-${needsDetail ? `${activeId}-${messages.length}` : 'new'}`;

    const list = (
        <ConversationList
            items={conversations.data ?? []}
            loading={conversations.isLoading}
            activeId={activeId}
            onSelect={select}
            onNew={() => select(null)}
            onRename={(id, title) => updateConversation(id, { title })}
            onPin={(id, pinned) => updateConversation(id, { pinned })}
            onDelete={deleteConversation}
        />
    );

    const thread = loadingThread ? (
        <div className="mx-auto w-full max-w-3xl space-y-5 px-6 py-8" aria-busy="true">
            {[60, 85, 45].map((w, i) => (
                <div
                    key={i}
                    className={`h-10 animate-pulse rounded-2xl bg-slate-100 ${i % 2 === 0 ? 'ml-auto' : ''}`}
                    style={{ width: `${w}%` }}
                />
            ))}
        </div>
    ) : (
        <ChatThread
            key={chatKey}
            chatKey={chatKey}
            conversationId={activeId}
            initialMessages={needsDetail ? messages : []}
            pendingReply={Boolean(pendingReply)}
            usage={usage}
            childJobs={chainTips}
            activeJobId={panelJobId}
            onOpenJob={openJob}
            onConversationId={onConversationId}
            onActivity={onActivity}
            onError={handleError}
            onLocked={(message) => promptUpgrade(message)}
            resumed={activeId ? null : resumed}
            onDismissResumed={() => setResumed(null)}
        />
    );

    const panel = panelJobId ? (
        <div className="absolute inset-0 z-40 flex flex-col bg-white lg:static lg:z-auto lg:w-[420px] lg:border-l lg:border-slate-200 xl:w-[460px]">
            <DraftPanel
                jobId={panelJobId}
                conversationId={activeId}
                onClose={() => setPanelJobId(null)}
                onChildJob={onChildJob}
                onError={handleError}
                onLocked={promptUpgrade}
                parentJobId={parentOf[panelJobId]}
                onOpenJob={openJob}
            />
        </div>
    ) : null;

    if (standalone) {
        return (
            <>
                <AiAppFrame
                    sidebar={list}
                    topbarRight={topbarRight}
                    panel={panel}
                    mobileOpen={listOpen}
                    onMobileOpenChange={setListOpen}
                >
                    <section className="flex min-h-0 flex-1 flex-col" aria-label="Chat">
                        {thread}
                    </section>
                </AiAppFrame>
                {modal}
            </>
        );
    }

    return (
        <div className="relative flex h-[calc(100vh-var(--topbar-height)-36px)] min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* Conversations */}
            <div
                className={`absolute inset-y-0 left-0 z-30 w-72 border-r border-slate-200 bg-slate-50 transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 ${
                    listOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
                }`}
            >
                {list}
            </div>
            {listOpen && (
                <button
                    type="button"
                    aria-label="Close chats"
                    onClick={() => setListOpen(false)}
                    className="absolute inset-0 z-20 bg-slate-900/20 md:hidden"
                />
            )}

            {/* Thread */}
            <section className="flex min-w-0 flex-1 flex-col" aria-label="Chat">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                    <button
                        type="button"
                        onClick={() => setListOpen(true)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
                        aria-label="Show chats"
                    >
                        <PanelLeft size={18} />
                    </button>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Sparkles size={15} className="text-[var(--brand)]" /> AI Studio
                    </span>
                    <Link
                        href={fullScreenHref}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        title="Open Mentrily AI in full screen"
                    >
                        <Maximize2 size={14} />
                        <span className="hidden sm:inline">Full screen</span>
                        <span className="sr-only sm:hidden">Open full screen</span>
                    </Link>
                </div>
                {thread}
            </section>

            {panel}
            {modal}
        </div>
    );
}
