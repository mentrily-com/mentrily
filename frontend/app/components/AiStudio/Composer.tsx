'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUp, AtSign, Lock, Square, X } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { AI_TYPES, DEFAULT_TYPES, TYPES_FOR_KIND } from '@/lib/ai/questionTypes';
import { creditsLabel, estimateBriefCredits, estimateOutlineCredits } from '@/lib/ai/credits';
import { fitToQuestionLimit } from '@/lib/ai/limits';
import type { AiBrief, AiDifficulty, AiGenerationType, AiQuality, AiReference, AiUsage } from '@/lib/ai/types';
import ReferencePicker from '@/app/components/AiShared/ReferencePicker';
import { COMMANDS, commandById, type CommandInfo } from './commands';

export interface ComposerSubmit {
    text: string;
    command: CommandInfo | null;
    brief?: AiBrief;
    references: AiReference[];
    chatQuality: 'fast' | 'smart';
    jobQuality: AiQuality;
}

interface JobOptions {
    sections: number;
    questionsPerSection: number;
    types: AiGenerationType[];
    difficulty: AiDifficulty;
}

const defaultOptions = (cmd: CommandInfo | null, maxQuestions = -1): JobOptions => {
    const kind = cmd?.command.kind === 'job' ? cmd.command.brief : 'course';
    const isQuiz = cmd?.command.id === 'quiz';
    const options: JobOptions = {
        sections: isQuiz ? 1 : cmd?.command.id === 'exam' ? 2 : 3,
        questionsPerSection: isQuiz ? 5 : 4,
        types: isQuiz ? ['MCQ', 'MultiSelect'] : DEFAULT_TYPES[kind],
        difficulty: 'Mixed',
    };
    return fitToQuestionLimit(options, maxQuestions);
};

export default function Composer({
    usage,
    busy,
    onSubmit,
    onStop,
    onLocked,
    prefill,
}: {
    usage?: AiUsage;
    busy: boolean;
    onSubmit: (value: ComposerSubmit) => Promise<boolean> | boolean;
    onStop: () => void;
    onLocked: (message: string) => void;
    prefill?: { command: string; text: string; nonce: number } | null;
}) {
    const uid = useId();
    const { canUse } = usePlan();
    const maxQuestions = usage?.limits.maxQuestionsPerGeneration ?? 40;
    const [text, setText] = useState('');
    const [command, setCommand] = useState<CommandInfo | null>(null);
    const [options, setOptions] = useState<JobOptions>(defaultOptions(null));
    const [references, setReferences] = useState<AiReference[]>([]);
    const [showRefs, setShowRefs] = useState(false);
    const [chatQuality, setChatQuality] = useState<'fast' | 'smart'>('fast');
    const [jobQuality, setJobQuality] = useState<AiQuality>('standard');
    const [menuIndex, setMenuIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!prefill) return;
        const cmd = commandById(prefill.command) ?? null;
        setCommand(cmd);
        setOptions(defaultOptions(cmd, maxQuestions));
        setText(prefill.text);
        requestAnimationFrame(() => inputRef.current?.focus());
        // Only when a new prefill arrives.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefill]);

    // Auto-grow up to ~8 lines.
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
    }, [text]);

    const slashQuery = !command && /^\/\S*$/.test(text) ? text.slice(1).toLowerCase() : null;
    const menu = useMemo(
        () => (slashQuery === null ? [] : COMMANDS.filter((c) => c.label.startsWith(slashQuery))),
        [slashQuery],
    );
    useEffect(() => setMenuIndex(0), [slashQuery]);

    const isJob = command?.command.kind === 'job';
    const isQuiz = command?.command.id === 'quiz';
    const jobKind = isJob && command?.command.kind === 'job' ? command.command.brief : 'course';
    const totalItems = isQuiz ? options.questionsPerSection : options.sections * options.questionsPerSection;
    const overLimit = isJob && maxQuestions >= 0 && totalItems > maxQuestions;
    const trimmed = text.trim();
    const canSend = !busy && !overLimit && (isJob ? trimmed.length >= 3 : trimmed.length > 0) && slashQuery === null;

    const brief: AiBrief | undefined = isJob
        ? {
              kind: jobKind,
              topic: trimmed,
              sections: isQuiz ? 1 : options.sections,
              questionsPerSection: options.questionsPerSection,
              types: options.types,
              difficulty: options.difficulty,
              language: 'English',
              codingLanguages: ['python'],
          }
        : undefined;
    const estimate = brief
        ? isQuiz
            ? estimateBriefCredits(brief, jobQuality)
            : estimateOutlineCredits(brief)
        : chatQuality === 'smart'
          ? 6
          : 2;

    const pick = (cmd: CommandInfo) => {
        setCommand(cmd);
        setOptions(defaultOptions(cmd, maxQuestions));
        setText('');
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const submit = async () => {
        if (!canSend) return;
        const ok = await onSubmit({ text: trimmed, command, brief, references, chatQuality, jobQuality });
        if (ok) {
            setText('');
            if (isJob) {
                setCommand(null);
                setOptions(defaultOptions(null));
            }
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (menu.length) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMenuIndex((i) => (i + 1) % menu.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMenuIndex((i) => (i - 1 + menu.length) % menu.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                pick(menu[menuIndex]);
                return;
            }
            if (e.key === 'Escape') {
                setText('');
                return;
            }
        }
        if (e.key === 'Backspace' && !text && command) {
            setCommand(null);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
        }
    };

    const toggleType = (type: AiGenerationType) => {
        const info = AI_TYPES[type];
        if (info.feature && !canUse(info.feature)) {
            onLocked(`${info.label} questions aren't included in your plan.`);
            return;
        }
        setOptions((o) => {
            const has = o.types.includes(type);
            if (has && o.types.length === 1) return o;
            return { ...o, types: has ? o.types.filter((t) => t !== type) : [...o.types, type] };
        });
    };

    const typeChoices = isQuiz ? (['MCQ', 'MultiSelect', 'Coding'] as AiGenerationType[]) : TYPES_FOR_KIND[jobKind];

    return (
        <div className="relative">
            {menu.length > 0 && (
                <div
                    role="listbox"
                    aria-label="Commands"
                    className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl"
                >
                    {menu.map((c, i) => {
                        const Icon = c.icon;
                        const locked = c.fullGeneration && usage && !usage.features.aiExams;
                        return (
                            <button
                                key={c.label}
                                type="button"
                                role="option"
                                aria-selected={i === menuIndex}
                                onMouseEnter={() => setMenuIndex(i)}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pick(c);
                                }}
                                className={`flex w-full items-center gap-3 px-3.5 py-2 text-left ${i === menuIndex ? 'bg-slate-50' : ''}`}
                            >
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                                    <Icon size={15} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-slate-900">/{c.label}</span>
                                    <span className="block truncate text-xs text-slate-500">
                                        {c.description}
                                        {locked ? ' (outline only on your plan)' : ''}
                                    </span>
                                </span>
                                {locked && <Lock size={13} className="shrink-0 text-slate-400" />}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition focus-within:border-[var(--color-border-brand)] focus-within:shadow-[0_8px_30px_rgba(0,141,152,0.10)]">
                {(showRefs || references.length > 0) && (
                    <div className="border-b border-slate-100 px-3 pb-2 pt-3">
                        <ReferencePicker
                            value={references}
                            onChange={setReferences}
                            max={usage?.limits.maxReferences ?? 0}
                            onLockedClick={() =>
                                onLocked('Using your own courses and exams as reference is available on the Starter plan and above.')
                            }
                            defaultOpen={showRefs && references.length === 0}
                            placement="top"
                        />
                    </div>
                )}

                <div className="flex items-start gap-2 px-3 pt-3">
                    {command && (
                        <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 py-1 pl-2 pr-1 text-xs font-medium text-white">
                            /{command.label}
                            <button
                                type="button"
                                onClick={() => setCommand(null)}
                                className="rounded p-0.5 hover:bg-white/15"
                                aria-label={`Remove /${command.label}`}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    <label htmlFor={`${uid}-msg`} className="sr-only">
                        Message
                    </label>
                    <textarea
                        id={`${uid}-msg`}
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={onKeyDown}
                        rows={1}
                        placeholder={command ? command.placeholder : 'Ask anything, or type / for commands'}
                        className="max-h-[220px] min-h-[40px] w-full resize-none bg-transparent py-1.5 text-[15px] leading-6 text-slate-900 outline-none placeholder:text-slate-400"
                    />
                </div>

                {isJob && (
                    <div className="flex flex-wrap items-center gap-2 px-3 pt-2 text-xs">
                        {!isQuiz && (
                            <NumberChip
                                label="sections"
                                value={options.sections}
                                min={1}
                                max={12}
                                onChange={(sections) => setOptions((o) => ({ ...o, sections }))}
                            />
                        )}
                        <NumberChip
                            label={isQuiz ? 'questions' : 'per section'}
                            value={options.questionsPerSection}
                            min={1}
                            max={20}
                            onChange={(questionsPerSection) => setOptions((o) => ({ ...o, questionsPerSection }))}
                        />
                        <select
                            value={options.difficulty}
                            onChange={(e) => setOptions((o) => ({ ...o, difficulty: e.target.value as AiDifficulty }))}
                            aria-label="Difficulty"
                            className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
                        >
                            {(['Mixed', 'Easy', 'Medium', 'Hard'] as const).map((d) => (
                                <option key={d} value={d}>
                                    {d === 'Mixed' ? 'Mixed difficulty' : d}
                                </option>
                            ))}
                        </select>
                        <span className="h-4 w-px bg-slate-200" aria-hidden />
                        {typeChoices.map((type) => {
                            const info = AI_TYPES[type];
                            const locked = Boolean(info.feature && !canUse(info.feature));
                            const on = options.types.includes(type);
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleType(type)}
                                    className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 ${
                                        on
                                            ? 'border-[var(--brand)] bg-[var(--color-brand-light)] text-[var(--brand-dark)]'
                                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                    } ${locked ? 'opacity-60' : ''}`}
                                >
                                    {locked && <Lock size={11} />}
                                    {info.short}
                                </button>
                            );
                        })}
                        {overLimit && (
                            <span className="text-amber-700">Your plan allows {maxQuestions} items per generation</span>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2 px-2 pb-2 pt-2">
                    <button
                        type="button"
                        onClick={() => setShowRefs((s) => !s)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium ${showRefs || references.length ? 'text-[var(--brand-dark)]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                        aria-pressed={showRefs}
                        title="Use your courses or exams as reference"
                    >
                        <AtSign size={14} />
                        <span className="hidden sm:inline">Reference</span>
                    </button>
                    {isJob ? (
                        <QualityToggle
                            value={jobQuality === 'pro' ? 'b' : 'a'}
                            labels={['Standard', 'Best']}
                            lockedB={!usage?.features.aiProTier}
                            onChange={(v) => setJobQuality(v === 'b' ? 'pro' : 'standard')}
                            onLocked={() => onLocked('The Best quality tier is available on the Pro plan and above.')}
                        />
                    ) : (
                        <QualityToggle
                            value={chatQuality === 'smart' ? 'b' : 'a'}
                            labels={['Fast', 'Smart']}
                            onChange={(v) => setChatQuality(v === 'b' ? 'smart' : 'fast')}
                        />
                    )}
                    <span className="ml-auto whitespace-nowrap text-[11px] tabular-nums text-slate-400">
                        {isJob && !isQuiz ? `outline about ${creditsLabel(estimate)}` : `about ${creditsLabel(estimate)}`}
                    </span>
                    {busy ? (
                        <button
                            type="button"
                            onClick={onStop}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white hover:bg-slate-700"
                            aria-label="Stop"
                        >
                            <Square size={13} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={submit}
                            disabled={!canSend}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand)] text-white transition hover:bg-[var(--brand-dark)] disabled:bg-slate-200 disabled:text-slate-400"
                            aria-label="Send"
                        >
                            <ArrowUp size={17} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function NumberChip({
    label,
    value,
    min,
    max,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
}) {
    return (
        <label className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white pl-2 pr-1 text-slate-500">
            <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
                }}
                className="w-7 bg-transparent text-right font-semibold tabular-nums text-slate-900 outline-none"
                aria-label={label}
            />
            {label}
        </label>
    );
}

function QualityToggle({
    value,
    labels,
    onChange,
    lockedB,
    onLocked,
}: {
    value: 'a' | 'b';
    labels: [string, string];
    onChange: (v: 'a' | 'b') => void;
    lockedB?: boolean;
    onLocked?: () => void;
}) {
    return (
        <div className="inline-flex h-8 items-center rounded-lg bg-slate-100 p-0.5 text-xs" role="group" aria-label="Quality">
            {(['a', 'b'] as const).map((v, i) => (
                <button
                    key={v}
                    type="button"
                    aria-pressed={value === v}
                    onClick={() => (v === 'b' && lockedB ? onLocked?.() : onChange(v))}
                    className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 font-medium ${value === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {v === 'b' && lockedB && <Lock size={11} />}
                    {labels[i]}
                </button>
            ))}
        </div>
    );
}
