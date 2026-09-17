'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, Lock, Minus, Plus } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { AI_TYPES, TYPES_FOR_KIND } from '@/lib/ai/questionTypes';
import type { AiBrief, AiDifficulty, AiGenerationType, AiQuality, AiReference, AiUsage } from '@/lib/ai/types';
import ReferencePicker from './ReferencePicker';

const LANGUAGES = ['English', 'Nepali', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Bengali', 'Urdu', 'Indonesian', 'Japanese'];
const DIFFICULTIES: AiDifficulty[] = ['Easy', 'Medium', 'Hard', 'Mixed'];

export interface BriefFieldsProps {
    brief: AiBrief;
    onChange: (next: AiBrief) => void;
    usage?: AiUsage;
    references: AiReference[];
    onReferencesChange: (next: AiReference[]) => void;
    quality: AiQuality;
    onQualityChange: (next: AiQuality) => void;
    /** Plan-locked control was clicked; explains the upgrade. */
    onLocked: (message: string) => void;
    showTopic?: boolean;
    /** Quiz mode generates a single section. */
    singleSection?: boolean;
}

function Stepper({
    id,
    label,
    value,
    min,
    max,
    onChange,
}: {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
}) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block text-xs font-medium text-slate-600">
                {label}
            </label>
            <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, value - 1))}
                    disabled={value <= min}
                    className="grid h-full w-9 place-items-center text-slate-500 hover:text-slate-900 disabled:opacity-30"
                    aria-label={`Fewer ${label.toLowerCase()}`}
                >
                    <Minus size={14} />
                </button>
                <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => {
                        const n = Math.round(Number(e.target.value));
                        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
                    }}
                    className="h-full w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums text-slate-900 outline-none"
                />
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, value + 1))}
                    disabled={value >= max}
                    className="grid h-full w-9 place-items-center text-slate-500 hover:text-slate-900 disabled:opacity-30"
                    aria-label={`More ${label.toLowerCase()}`}
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
}

export default function BriefFields({
    brief,
    onChange,
    usage,
    references,
    onReferencesChange,
    quality,
    onQualityChange,
    onLocked,
    showTopic = true,
    singleSection = false,
}: BriefFieldsProps) {
    const uid = useId();
    const { canUse } = usePlan();
    const [moreOpen, setMoreOpen] = useState(Boolean(brief.outcomes || (brief.language && brief.language !== 'English')));
    const set = <K extends keyof AiBrief>(key: K, value: AiBrief[K]) => onChange({ ...brief, [key]: value });

    const maxQuestions = usage?.limits.maxQuestionsPerGeneration ?? 40;
    const total = singleSection ? brief.questionsPerSection : brief.sections * brief.questionsPerSection;
    const overLimit = maxQuestions >= 0 && total > maxQuestions;
    const proAllowed = usage?.features.aiProTier ?? false;

    const toggleType = (type: AiGenerationType) => {
        const info = AI_TYPES[type];
        if (info.feature && !canUse(info.feature)) {
            onLocked(`${info.label} questions aren't included in your plan. Upgrade to generate them.`);
            return;
        }
        const has = brief.types.includes(type);
        if (has && brief.types.length === 1) return;
        const next = has ? brief.types.filter((t) => t !== type) : [...brief.types, type];
        onChange({
            ...brief,
            types: next,
            codingLanguages: next.includes('Coding') ? brief.codingLanguages ?? ['python'] : brief.codingLanguages,
        });
    };

    return (
        <div className="space-y-5">
            {showTopic && (
                <div className="space-y-1.5">
                    <label htmlFor={`${uid}-topic`} className="block text-xs font-medium text-slate-600">
                        What should it cover?
                    </label>
                    <textarea
                        id={`${uid}-topic`}
                        value={brief.topic}
                        onChange={(e) => set('topic', e.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder={
                            brief.kind === 'exam'
                                ? 'e.g. Mid-term on Python lists and loops: indexing, slicing, list methods, for-loops'
                                : 'e.g. Python lists for beginners: creating lists, indexing, slicing and list methods'
                        }
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                    />
                </div>
            )}

            <div className="space-y-1.5">
                <label htmlFor={`${uid}-aud`} className="block text-xs font-medium text-slate-600">
                    Who is it for?
                </label>
                <input
                    id={`${uid}-aud`}
                    value={brief.audience ?? ''}
                    onChange={(e) => set('audience', e.target.value)}
                    maxLength={300}
                    placeholder="e.g. Grade 9 students new to programming"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                />
            </div>

            <div className={`grid gap-3 ${singleSection ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {!singleSection && (
                    <Stepper
                        id={`${uid}-sec`}
                        label="Sections"
                        value={brief.sections}
                        min={1}
                        max={12}
                        onChange={(v) => set('sections', v)}
                    />
                )}
                <Stepper
                    id={`${uid}-qps`}
                    label={singleSection ? 'Questions' : 'Items per section'}
                    value={brief.questionsPerSection}
                    min={1}
                    max={20}
                    onChange={(v) => set('questionsPerSection', v)}
                />
            </div>
            <p className={`-mt-2 text-xs tabular-nums ${overLimit ? 'font-medium text-amber-700' : 'text-slate-400'}`}>
                {overLimit
                    ? `${total} items is over your plan's limit of ${maxQuestions} per generation.`
                    : `${total} item${total === 1 ? '' : 's'} in total`}
            </p>

            <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-slate-600">Question types</legend>
                <div className="flex flex-wrap gap-2">
                    {TYPES_FOR_KIND[brief.kind].map((type) => {
                        const info = AI_TYPES[type];
                        const Icon = info.icon;
                        const locked = Boolean(info.feature && !canUse(info.feature));
                        const active = brief.types.includes(type);
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => toggleType(type)}
                                aria-pressed={active}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                                    active
                                        ? 'border-[var(--brand)] bg-[var(--color-brand-light)] text-[var(--brand-dark)]'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                } ${locked ? 'opacity-60' : ''}`}
                            >
                                {locked ? <Lock size={12} /> : <Icon size={13} />}
                                {info.label}
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            {brief.types.includes('Coding') && (
                <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-slate-600">Coding languages</legend>
                    <div className="flex gap-2">
                        {(['python', 'javascript'] as const).map((lang) => {
                            const active = (brief.codingLanguages ?? ['python']).includes(lang);
                            return (
                                <button
                                    key={lang}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => {
                                        const current = brief.codingLanguages ?? ['python'];
                                        const next = active ? current.filter((l) => l !== lang) : [...current, lang];
                                        if (next.length) set('codingLanguages', next);
                                    }}
                                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                                        active
                                            ? 'border-[var(--brand)] bg-[var(--color-brand-light)] text-[var(--brand-dark)]'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    {lang === 'python' ? 'Python' : 'JavaScript'}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            )}

            <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-slate-600">Difficulty</legend>
                <div className="grid grid-cols-4 rounded-xl border border-slate-200 bg-slate-50 p-1">
                    {DIFFICULTIES.map((d) => (
                        <button
                            key={d}
                            type="button"
                            aria-pressed={brief.difficulty === d}
                            onClick={() => set('difficulty', d)}
                            className={`rounded-lg py-1.5 text-xs font-medium transition ${
                                brief.difficulty === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </fieldset>

            <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Reference material</p>
                <ReferencePicker
                    value={references}
                    onChange={onReferencesChange}
                    max={usage?.limits.maxReferences ?? 0}
                    onLockedClick={() =>
                        onLocked('Using your own courses and exams as reference is available on the Starter plan and above.')
                    }
                />
            </div>

            <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-slate-600">Quality</legend>
                <div className="grid grid-cols-2 gap-2">
                    {(
                        [
                            { value: 'standard', title: 'Standard', body: 'Fast and cost-efficient' },
                            { value: 'pro', title: 'Best', body: 'Strongest model, uses more credits' },
                        ] as const
                    ).map((opt) => {
                        const locked = opt.value === 'pro' && !proAllowed;
                        const active = quality === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                    locked
                                        ? onLocked('The Best quality tier is available on the Pro plan and above.')
                                        : onQualityChange(opt.value)
                                }
                                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                                    active
                                        ? 'border-[var(--brand)] bg-[var(--color-brand-light)]'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                    {locked && <Lock size={12} className="text-slate-400" />}
                                    {opt.title}
                                </span>
                                <span className="text-xs text-slate-500">{opt.body}</span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            <div>
                <button
                    type="button"
                    onClick={() => setMoreOpen((o) => !o)}
                    aria-expanded={moreOpen}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                    <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                    More options
                </button>
                {moreOpen && (
                    <div className="mt-3 space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor={`${uid}-out`} className="block text-xs font-medium text-slate-600">
                                Learning outcomes
                            </label>
                            <textarea
                                id={`${uid}-out`}
                                value={brief.outcomes ?? ''}
                                onChange={(e) => set('outcomes', e.target.value)}
                                rows={2}
                                maxLength={1500}
                                placeholder="e.g. Learners can slice lists, choose the right list method and loop over lists"
                                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor={`${uid}-lang`} className="block text-xs font-medium text-slate-600">
                                    Content language
                                </label>
                                <select
                                    id={`${uid}-lang`}
                                    value={brief.language ?? 'English'}
                                    onChange={(e) => set('language', e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--brand)]"
                                >
                                    {LANGUAGES.map((l) => (
                                        <option key={l}>{l}</option>
                                    ))}
                                </select>
                            </div>
                            {brief.kind === 'exam' && (
                                <div className="space-y-1.5">
                                    <label htmlFor={`${uid}-marks`} className="block text-xs font-medium text-slate-600">
                                        Total marks
                                    </label>
                                    <input
                                        id={`${uid}-marks`}
                                        type="number"
                                        min={1}
                                        max={2000}
                                        value={brief.totalMarks ?? ''}
                                        onChange={(e) =>
                                            set('totalMarks', e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : undefined)
                                        }
                                        placeholder="Any"
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums text-slate-900 outline-none focus:border-[var(--brand)]"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
