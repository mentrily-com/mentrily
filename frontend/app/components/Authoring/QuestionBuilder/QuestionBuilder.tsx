'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { Target } from 'lucide-react';
import { Question } from '../types';
import MCQEditor from './modules/MCQEditor';
import CodingEditor from './modules/CodingEditor';
import ReadingEditor from './modules/ReadingEditor';
import NotebookEditor from './modules/NotebookEditor';
import RichEditorFieldSkeleton from '@/app/components/Skeletons/RichEditorFieldSkeleton';

const RichTextEditor = dynamic(() => import('../RichTextEditor'), {
    ssr: false,
    loading: () => <RichEditorFieldSkeleton />,
});

const WebEditor = dynamic(() => import('./modules/WebEditor'), {
    ssr: false,
    loading: () => <RichEditorFieldSkeleton />,
});

interface QuestionBuilderProps {
    question: Question;
    onChange: (updates: Partial<Question>) => void;
}

export default function QuestionBuilder({ question, onChange }: QuestionBuilderProps) {
    return (
        <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,_rgba(248,250,252,0.82),_rgba(255,255,255,1))] p-6 no-scrollbar md:p-8">
            <div className="mx-auto max-w-5xl space-y-8">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="rounded-xl border border-[var(--brand-light)] bg-[var(--brand-light)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--brand)] italic">
                                    {question.type} Editor
                                </span>
                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Question setup
                                </span>
                            </div>
                            <input
                                type="text"
                                value={question.title}
                                onChange={(e) => onChange({ title: e.target.value })}
                                className="w-full border-b-2 border-transparent bg-transparent text-2xl font-black text-slate-800 outline-none transition-all placeholder:text-slate-200 focus:border-[var(--brand)] md:text-3xl"
                                placeholder="Question Title..."
                            />
                            <p className="max-w-2xl text-sm leading-6 text-slate-500">
                                Keep the prompt clear and specific so learners know exactly what they need to solve,
                                build, or explain.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-start gap-3 xl:shrink-0">
                            <MetaField
                                label="Points"
                                icon={<Target size={14} />}
                                value={question.marks}
                                onChange={(val) => onChange({ marks: parseInt(val) || 0 })}
                                readOnly={question.type === 'Coding'}
                            />
                            <div className="flex min-w-[148px] flex-col gap-1.5">
                                <select
                                    value={question.difficulty}
                                    onChange={(e) =>
                                        onChange({ difficulty: e.target.value as 'Easy' | 'Medium' | 'Hard' })
                                    }
                                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-xs font-black uppercase tracking-widest text-slate-700 outline-none transition-all appearance-none cursor-pointer focus:border-[var(--brand-light)] focus:ring-4 focus:ring-[var(--brand)]/5"
                                    style={{
                                        backgroundImage:
                                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 12px center',
                                        backgroundSize: '16px',
                                    }}
                                >
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                                <span className="text-center text-[9px] font-black uppercase tracking-tighter text-slate-300">
                                    Difficulty
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {question.type !== 'Reading' && (
                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                Problem Statement
                            </h3>
                        </div>
                        <RichTextEditor
                            content={question.problemStatement}
                            onChange={(val) => onChange({ problemStatement: val })}
                        />
                    </section>
                )}

                <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    {renderEditorModule(question, onChange)}
                </section>
            </div>
        </div>
    );
}

function renderEditorModule(question: Question, onChange: (updates: Partial<Question>) => void) {
    switch (question.type) {
        case 'MCQ':
        case 'MultiSelect':
            return <MCQEditor question={question} onChange={onChange} />;
        case 'Coding':
            return <CodingEditor question={question} onChange={onChange} />;
        case 'Web':
            return <WebEditor question={question} onChange={onChange} />;
        case 'Reading':
        case 'Descriptive':
            return <ReadingEditor question={question} onChange={onChange} />;
        case 'Notebook':
            return <NotebookEditor question={question} onChange={onChange} />;
        default:
            return (
                <div className="rounded-[40px] border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 text-center">
                    <p className="text-sm font-black text-slate-300 uppercase tracking-widest italic">
                        {question.type} Module Coming Soon
                    </p>
                </div>
            );
    }
}

function MetaField({
    label,
    icon,
    value,
    onChange,
    readOnly,
}: {
    label: string;
    icon: React.ReactNode;
    value: string | number | undefined;
    onChange: (val: string) => void;
    readOnly?: boolean;
}) {
    return (
        <div className="flex min-w-[120px] flex-col gap-1.5">
            <div
                className={`flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 transition-all ${readOnly ? 'cursor-not-allowed opacity-60 grayscale' : 'focus-within:border-[var(--brand-light)] focus-within:ring-4 focus-within:ring-[var(--brand)]/5'}`}
            >
                <span className="text-slate-400">{icon}</span>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => !readOnly && onChange(e.target.value)}
                    readOnly={readOnly}
                    className={`w-14 bg-transparent text-xs font-black text-slate-700 outline-none ${readOnly ? 'cursor-not-allowed' : ''}`}
                    placeholder="0"
                />
            </div>
            <span className="text-center text-[9px] font-black uppercase tracking-tighter text-slate-300">{label}</span>
        </div>
    );
}
