'use client';

import React, { memo, useState } from 'react';
import type { UIMessage } from 'ai';
import { Streamdown } from 'streamdown';
import { createMathPlugin } from '@streamdown/math';
import 'katex/dist/katex.min.css';
import { BookOpen, Check, ClipboardList, Copy, PenLine, RotateCcw, Search } from 'lucide-react';
import JobCard, { type JobPartData } from './JobCard';
import { commandById } from './commands';

export interface StudioMessageMetadata {
    conversationId?: string;
    credits?: number;
    tier?: string;
    command?: string;
    references?: { kind: 'course' | 'exam'; id: string; title?: string }[];
}

export type StudioMessage = UIMessage<StudioMessageMetadata>;

// Inline $...$ is on because models emit it; the chat prompt asks for
// escaped currency (\$) so prices don't render as math.
const streamdownPlugins = { math: createMathPlugin({ singleDollarTextMath: true }) };

const TOOL_LABEL: Record<string, string> = {
    search_my_content: 'Searched your courses and exams',
    get_course_outline: 'Read a course outline',
    search_course_units: 'Read matching course units',
    get_exam_outline: 'Read an exam',
};

function MessageView({
    message,
    streaming,
    isLast,
    childJobs,
    activeJobId,
    onOpenJob,
    onRegenerate,
}: {
    message: StudioMessage;
    streaming: boolean;
    isLast: boolean;
    childJobs: Record<string, string>;
    activeJobId: string | null;
    onOpenJob: (jobId: string) => void;
    onRegenerate?: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const text = message.parts
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join('\n')
        .trim();

    if (message.role === 'user') {
        const cmd = message.metadata?.command ? commandById(message.metadata.command) : null;
        const refs = message.metadata?.references ?? [];
        const shown = cmd ? text.replace(/^\/\w+\s*/, '') : text;
        return (
            <div className="flex justify-end">
                <div className="max-w-[85%] space-y-1.5">
                    {(cmd || refs.length > 0) && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                            {cmd && (
                                <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                                    /{cmd.label}
                                </span>
                            )}
                            {refs.map((r) => (
                                <span
                                    key={r.id}
                                    className="inline-flex items-center gap-1 rounded-md bg-[var(--color-brand-light)] px-1.5 py-0.5 text-[11px] text-[var(--brand-dark)]"
                                >
                                    {r.kind === 'course' ? <BookOpen size={11} /> : <ClipboardList size={11} />}
                                    {r.title}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-100 px-4 py-2.5 text-[15px] leading-6 text-slate-900">
                        {shown}
                    </div>
                </div>
            </div>
        );
    }

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard unavailable; nothing to do.
        }
    };

    return (
        <div className="group space-y-1">
            {message.parts.map((part, i) => {
                if (part.type === 'text') {
                    return (
                        <div key={i} className="studio-md text-[15px] leading-7 text-slate-800">
                            <Streamdown plugins={streamdownPlugins} isAnimating={streaming && isLast}>
                                {part.text}
                            </Streamdown>
                        </div>
                    );
                }
                if (part.type === 'data-job') {
                    const data = part.data as JobPartData;
                    return (
                        <JobCard
                            key={i}
                            data={data}
                            childJobId={childJobs[data.jobId]}
                            active={activeJobId === (childJobs[data.jobId] ?? data.jobId)}
                            onOpen={onOpenJob}
                        />
                    );
                }
                if (part.type === 'tool-edit_content') {
                    const state = 'state' in part ? part.state : undefined;
                    const output = ('output' in part ? part.output : undefined) as
                        | { jobId?: string; title?: string; kind?: 'course' | 'exam'; error?: string }
                        | undefined;
                    if (state === 'output-available' && output?.jobId) {
                        return (
                            <JobCard
                                key={i}
                                data={{
                                    jobId: output.jobId,
                                    kind: 'edit',
                                    briefKind: output.kind ?? 'course',
                                    title: output.title ?? 'Your content',
                                }}
                                active={activeJobId === output.jobId}
                                onOpen={onOpenJob}
                            />
                        );
                    }
                    if (state === 'output-available' || state === 'output-error') {
                        return (
                            <p key={i} className="text-xs text-rose-600">
                                Couldn&apos;t start the edit{output?.error ? `: ${output.error}` : '.'}
                            </p>
                        );
                    }
                    return (
                        <p key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                            <PenLine size={12} /> Preparing the edit…
                        </p>
                    );
                }
                if (part.type.startsWith('tool-')) {
                    const name = part.type.slice(5);
                    const done = 'state' in part && part.state === 'output-available';
                    return (
                        <p key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Search size={12} />
                            {TOOL_LABEL[name] ?? 'Looked something up'}
                            {!done && '…'}
                        </p>
                    );
                }
                return null;
            })}
            {!streaming && text && (
                <div className="flex items-center gap-1 pt-1 text-slate-400 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button
                        type="button"
                        onClick={copy}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs hover:bg-slate-100 hover:text-slate-700"
                    >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                    {isLast && onRegenerate && (
                        <button
                            type="button"
                            onClick={onRegenerate}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs hover:bg-slate-100 hover:text-slate-700"
                        >
                            <RotateCcw size={13} /> Regenerate
                        </button>
                    )}
                    {typeof message.metadata?.credits === 'number' && (
                        <span className="ml-1 text-[11px] tabular-nums">
                            {message.metadata.credits} credit{message.metadata.credits === 1 ? '' : 's'}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export default memo(MessageView);
