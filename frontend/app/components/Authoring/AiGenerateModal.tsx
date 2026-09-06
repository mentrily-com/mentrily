'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, Check, Clock3, Copy, Rocket, Sparkles, Wand2, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Section } from './types';
import {
    AiImportKind,
    AiImportTypeInfo,
    buildAiPrompt,
    normalizeImportedSections,
    parseAiJson,
    type NormalizeStats,
} from './aiImport';

export default function AiGenerateModal({
    kind,
    availableTypes,
    onClose,
    onImport,
}: {
    kind: AiImportKind;
    availableTypes: AiImportTypeInfo[];
    onClose: () => void;
    onImport: (sections: Section[], stats: NormalizeStats) => void;
}) {
    const [toolOpen, setToolOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    useModalA11y(panelRef, true, onClose);

    const noun = kind === 'exam' ? 'Exam' : 'Course';
    const prompt = buildAiPrompt(kind, availableTypes);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Could not copy automatically — select and copy the text manually.');
        }
    };

    const handleGenerate = () => {
        setError(null);
        const { data, error: parseErr } = parseAiJson(pasteText);
        if (parseErr || !data) {
            setError(parseErr || 'Could not read that JSON.');
            return;
        }

        const rawSections = Array.isArray(data?.sections) ? data.sections : Array.isArray(data) ? data : null;
        if (!rawSections) {
            setError('Expected a JSON object with a "sections" array.');
            return;
        }

        const { sections, stats } = normalizeImportedSections(rawSections, { allowedTypes: availableTypes });
        if (stats.questionsImported === 0) {
            setError('No importable questions were found in that JSON.');
            return;
        }

        onImport(sections, stats);
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={`AI ${noun} Generation`}
                tabIndex={-1}
                className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] md:p-9 focus:outline-none"
            >
                <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_top_right,rgba(26,86,219,0.14),transparent_33%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_38%),linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,1))]" />

                <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-light)] bg-[var(--brand-light)]/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--brand)]">
                                <Sparkles size={13} />
                                Coming Soon
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/50">
                                    <Rocket size={22} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                                        AI {noun} Generation
                                    </h1>
                                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                                        Full automated generation is still being finalized. In the meantime, you can
                                        draft your {kind} with an AI chat tool and import the result below.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="cursor-pointer rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Status</p>
                            <p className="mt-2 text-sm font-semibold text-slate-800">
                                Planned and reserved in the product flow, not open for full use yet.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Workaround</p>
                            <p className="mt-2 text-sm font-semibold text-slate-800">
                                Copy a ready-made prompt, paste it into your AI chat, then paste the JSON reply back here.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">ETA</p>
                            <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <Clock3 size={14} className="text-[var(--brand)]" />
                                In an upcoming release
                            </p>
                        </div>
                    </div>

                    {!toolOpen ? (
                        <button
                            type="button"
                            onClick={() => setToolOpen(true)}
                            className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--brand-light)] bg-[var(--brand-light)]/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--brand)] transition-colors hover:bg-[var(--brand-light)]/35"
                        >
                            <Wand2 size={14} />
                            Try JSON Import (Beta)
                        </button>
                    ) : (
                        <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    Step 1 — Copy prompt
                                </p>
                                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                                    Paste this into ChatGPT, Claude, or any AI chat, fill in your topic, then copy its JSON reply.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Copied!' : 'Copy Prompt'}
                                </button>
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    Step 2 — Paste JSON reply
                                </p>
                                <textarea
                                    value={pasteText}
                                    onChange={(e) => {
                                        setPasteText(e.target.value);
                                        if (error) setError(null);
                                    }}
                                    placeholder='{ "sections": [ ... ] }'
                                    rows={8}
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 outline-none focus:border-[var(--brand)]"
                                />
                            </div>

                            {error ? (
                                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            ) : null}

                            <div className="flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setToolOpen(false)}
                                    className="cursor-pointer text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                >
                                    Hide
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={!pasteText.trim()}
                                    className="cursor-pointer rounded-xl bg-[var(--brand)] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Generate
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
