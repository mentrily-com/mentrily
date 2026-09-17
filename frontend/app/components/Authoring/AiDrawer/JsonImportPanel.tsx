'use client';

import React, { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import type { Section } from '../types';
import {
    AiImportKind,
    AiImportTypeInfo,
    buildAiPrompt,
    normalizeImportedSections,
    parseAiJson,
    type NormalizeStats,
} from '../aiImport';

/** Paste-JSON import for content drafted in an external AI chat. */
export default function JsonImportPanel({
    kind,
    availableTypes,
    onImport,
}: {
    kind: AiImportKind;
    availableTypes: AiImportTypeInfo[];
    onImport: (sections: Section[], stats: NormalizeStats) => void;
}) {
    const [copied, setCopied] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const prompt = buildAiPrompt(kind, availableTypes);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Could not copy automatically. Select the prompt text and copy it manually.');
        }
    };

    const importJson = () => {
        setError(null);
        const { data, error: parseErr } = parseAiJson(pasteText);
        if (parseErr || !data) {
            setError(parseErr || 'Could not read that JSON.');
            return;
        }
        const raw = Array.isArray(data?.sections) ? data.sections : Array.isArray(data) ? data : null;
        if (!raw) {
            setError('Expected a JSON object with a "sections" array.');
            return;
        }
        const { sections, stats } = normalizeImportedSections(raw, { allowedTypes: availableTypes });
        if (stats.questionsImported === 0) {
            setError('No importable questions were found in that JSON.');
            return;
        }
        onImport(sections, stats);
    };

    return (
        <div className="space-y-5">
            <p className="text-sm leading-6 text-slate-600">
                Already drafted content in another AI chat? Copy this prompt into it, then paste the JSON it returns.
            </p>
            <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">1. Copy the prompt</p>
                <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy prompt'}
                </button>
            </div>
            <div className="space-y-2">
                <label htmlFor="ai-json-paste" className="block text-xs font-medium text-slate-600">
                    2. Paste the JSON reply
                </label>
                <textarea
                    id="ai-json-paste"
                    value={pasteText}
                    onChange={(e) => {
                        setPasteText(e.target.value);
                        if (error) setError(null);
                    }}
                    rows={10}
                    placeholder='{ "sections": [ ... ] }'
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 outline-none focus:border-[var(--brand)]"
                />
            </div>
            {error && (
                <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    {error}
                </p>
            )}
            <button
                type="button"
                onClick={importJson}
                disabled={!pasteText.trim()}
                className="w-full rounded-xl bg-[var(--brand)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-40"
            >
                Import questions
            </button>
        </div>
    );
}
