'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { savePromptHandoff } from '@/lib/ai/promptHandoff';

/**
 * A small ask box under the hero CTAs, styled like the chat composer itself:
 * typing a request and pressing Enter opens Mentrily AI with it filled in.
 */
export default function HeroAiPrompt() {
    const router = useRouter();
    const [text, setText] = useState('');

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim()) savePromptHandoff({ text });
        router.push('/chat');
    };

    return (
        <form
            onSubmit={submit}
            className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 py-1.5 pl-4 pr-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur transition-colors focus-within:border-[#008D98] focus-within:bg-white"
        >
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                aria-label="Ask Mentrily AI"
                placeholder="Ask Mentrily AI to plan a course…"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
                type="submit"
                aria-label="Open Mentrily AI"
                title="Open Mentrily AI"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white transition-colors hover:bg-[#006F78]"
            >
                <ArrowUp size={16} />
            </button>
        </form>
    );
}
