'use client';

import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { AI_TYPES, TYPES_FOR_KIND } from '@/lib/ai/questionTypes';
import type { AiGenerationType, Blueprint, BlueprintQuestion, BlueprintSection } from '@/lib/ai/types';

const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function QuestionRow({
    question,
    allowedTypes,
    onChange,
    onRemove,
    canRemove,
}: {
    question: BlueprintQuestion;
    allowedTypes: AiGenerationType[];
    onChange: (q: BlueprintQuestion) => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
    const Icon = AI_TYPES[question.type].icon;
    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`space-y-1.5 rounded-xl border bg-white px-2 py-2 ${
                isDragging ? 'z-10 border-[var(--brand)] shadow-lg' : 'border-slate-200'
            }`}
        >
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="cursor-grab touch-none rounded p-1 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                    aria-label={`Reorder ${question.title}`}
                >
                    <GripVertical size={14} />
                </button>
                <Icon size={14} className="shrink-0 text-slate-400" aria-hidden />
                <input
                    value={question.title}
                    onChange={(e) => onChange({ ...question, title: e.target.value })}
                    maxLength={200}
                    aria-label="Item title"
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-medium text-slate-900 outline-none focus:bg-slate-50"
                />
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={!canRemove}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-0"
                    aria-label={`Remove ${question.title}`}
                >
                    <Trash2 size={13} />
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pl-7">
                <select
                    value={question.type}
                    onChange={(e) => onChange({ ...question, type: e.target.value as AiGenerationType })}
                    aria-label="Item type"
                    className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 outline-none focus:border-[var(--brand)]"
                >
                    {allowedTypes.map((t) => (
                        <option key={t} value={t}>
                            {AI_TYPES[t].short}
                        </option>
                    ))}
                </select>
                <select
                    value={question.difficulty}
                    onChange={(e) =>
                        onChange({ ...question, difficulty: e.target.value as BlueprintQuestion['difficulty'] })
                    }
                    aria-label="Difficulty"
                    className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 outline-none focus:border-[var(--brand)]"
                >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                </select>
                <label className="flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white pl-1.5 text-xs text-slate-500">
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={question.marks}
                        onChange={(e) =>
                            onChange({ ...question, marks: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                        }
                        aria-label="Marks"
                        className="w-8 bg-transparent text-right tabular-nums text-slate-800 outline-none"
                    />
                    <span className="pr-1.5">pts</span>
                </label>
                {question.intent && (
                    <p className="min-w-0 basis-full truncate text-xs text-slate-500" title={question.intent}>
                        {question.intent}
                    </p>
                )}
            </div>
        </li>
    );
}

function SectionBlock({
    section,
    index,
    allowedTypes,
    onChange,
    onRemove,
    canRemove,
}: {
    section: BlueprintSection;
    index: number;
    allowedTypes: AiGenerationType[];
    onChange: (s: BlueprintSection) => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const from = section.questions.findIndex((q) => q.id === active.id);
        const to = section.questions.findIndex((q) => q.id === over.id);
        onChange({ ...section, questions: arrayMove(section.questions, from, to) });
    };
    const marks = section.questions.reduce((acc, q) => acc + q.marks, 0);

    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-900 text-[11px] font-semibold tabular-nums text-white">
                    {index + 1}
                </span>
                <input
                    value={section.title}
                    onChange={(e) => onChange({ ...section, title: e.target.value })}
                    maxLength={160}
                    aria-label={`Section ${index + 1} title`}
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-slate-900 outline-none focus:bg-slate-50"
                />
                <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {section.questions.length} {section.questions.length === 1 ? 'item' : 'items'}, {marks} {marks === 1 ? 'pt' : 'pts'}
                </span>
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={!canRemove}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-0"
                    aria-label={`Remove section ${index + 1}`}
                >
                    <Trash2 size={13} />
                </button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={section.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-1.5 pl-2 sm:pl-8">
                        {section.questions.map((q, qi) => (
                            <QuestionRow
                                key={q.id}
                                question={q}
                                allowedTypes={allowedTypes}
                                canRemove={section.questions.length > 1}
                                onChange={(next) =>
                                    onChange({
                                        ...section,
                                        questions: section.questions.map((x, i) => (i === qi ? next : x)),
                                    })
                                }
                                onRemove={() =>
                                    onChange({ ...section, questions: section.questions.filter((_, i) => i !== qi) })
                                }
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
            <button
                type="button"
                onClick={() =>
                    onChange({
                        ...section,
                        questions: [
                            ...section.questions,
                            {
                                id: newId('bq'),
                                type: section.questions.at(-1)?.type ?? allowedTypes[0],
                                title: 'New item',
                                intent: '',
                                difficulty: 'Medium',
                                marks: 1,
                            },
                        ],
                    })
                }
                className="ml-2 inline-flex sm:ml-8 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
                <Plus size={13} /> Add item
            </button>
        </section>
    );
}

export default function BlueprintEditor({
    blueprint,
    onChange,
    maxQuestions,
}: {
    blueprint: Blueprint;
    onChange: (next: Blueprint) => void;
    maxQuestions: number;
}) {
    const { canUse } = usePlan();
    const allowedTypes = TYPES_FOR_KIND[blueprint.kind].filter((t) => {
        const feature = AI_TYPES[t].feature;
        return !feature || canUse(feature);
    });
    const total = blueprint.sections.reduce((acc, s) => acc + s.questions.length, 0);
    const marks = blueprint.sections.reduce((acc, s) => acc + s.questions.reduce((a, q) => a + q.marks, 0), 0);
    const overLimit = maxQuestions >= 0 && total > maxQuestions;

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <textarea
                    value={blueprint.title}
                    onChange={(e) => onChange({ ...blueprint, title: e.target.value.replace(/\n/g, ' ') })}
                    rows={1}
                    maxLength={200}
                    aria-label="Title"
                    className="field-sizing-content w-full resize-none rounded-md bg-transparent px-1 font-display text-xl font-semibold leading-snug text-slate-900 outline-none focus:bg-slate-50"
                />
                <textarea
                    value={blueprint.description}
                    onChange={(e) => onChange({ ...blueprint, description: e.target.value })}
                    rows={3}
                    maxLength={1000}
                    aria-label="Description"
                    className="field-sizing-content max-h-48 min-h-[4.5rem] w-full resize-none rounded-md bg-transparent px-1 text-sm leading-6 text-slate-600 outline-none focus:bg-slate-50"
                />
                <p className={`px-1 text-xs tabular-nums ${overLimit ? 'font-medium text-amber-700' : 'text-slate-400'}`}>
                    {blueprint.sections.length} {blueprint.sections.length === 1 ? 'section' : 'sections'}, {total}{' '}
                    {total === 1 ? 'item' : 'items'}, {marks} {marks === 1 ? 'pt' : 'pts'}
                    {overLimit ? ` — your plan allows ${maxQuestions} items per generation` : ''}
                </p>
            </div>

            {blueprint.sections.map((section, si) => (
                <SectionBlock
                    key={section.id}
                    section={section}
                    index={si}
                    allowedTypes={allowedTypes}
                    canRemove={blueprint.sections.length > 1}
                    onChange={(next) =>
                        onChange({ ...blueprint, sections: blueprint.sections.map((s, i) => (i === si ? next : s)) })
                    }
                    onRemove={() => onChange({ ...blueprint, sections: blueprint.sections.filter((_, i) => i !== si) })}
                />
            ))}

            {blueprint.sections.length < 12 && (
                <button
                    type="button"
                    onClick={() =>
                        onChange({
                            ...blueprint,
                            sections: [
                                ...blueprint.sections,
                                {
                                    id: newId('sec'),
                                    title: `Section ${blueprint.sections.length + 1}`,
                                    summary: '',
                                    questions: [
                                        {
                                            id: newId('bq'),
                                            type: allowedTypes[0],
                                            title: 'New item',
                                            intent: '',
                                            difficulty: 'Medium',
                                            marks: 1,
                                        },
                                    ],
                                },
                            ],
                        })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                    <Plus size={13} /> Add section
                </button>
            )}
        </div>
    );
}
