'use client';
import React from 'react';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Question } from '../../types';

interface MCQEditorProps {
    question: Question;
    onChange: (updates: Partial<Question>) => void;
}

export default function MCQEditor({ question, onChange }: MCQEditorProps) {
    const options = question.options || [];

    const addOption = () => {
        const newOption = { id: `opt-${Date.now()}`, text: '', isCorrect: false };
        onChange({ options: [...options, newOption] });
    };

    const removeOption = (id: string) => {
        onChange({ options: options.filter((o) => o.id !== id) });
    };

    const toggleCorrect = (id: string) => {
        const isMultiSelect = question.type === 'MultiSelect';
        onChange({
            options: options.map((o: any) => {
                if (o.id === id) return { ...o, isCorrect: !o.isCorrect };
                if (!isMultiSelect) return { ...o, isCorrect: false };
                return o;
            }),
        });
    };

    const updateOptionText = (id: string, text: string) => {
        onChange({
            options: options.map((o: any) => (o.id === id ? { ...o, text } : o)),
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Options</h4>
                <button
                    onClick={addOption}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-light)] text-[var(--brand)] rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[var(--brand-light)]/80 transition-colors"
                >
                    <Plus size={14} strokeWidth={3} />
                    Add Option
                </button>
            </div>

            <div className="space-y-3">
                {options.map((option: any, index: number) => (
                    <div key={option.id} className="flex items-center gap-4 group">
                        <button
                            onClick={() => toggleCorrect(option.id)}
                            className={`shrink-0 transition-all ${option.isCorrect ? 'text-emerald-500 scale-110' : 'text-slate-200 hover:text-slate-400'}`}
                        >
                            {option.isCorrect ? (
                                <CheckCircle2 size={24} strokeWidth={2.5} />
                            ) : (
                                <Circle size={24} strokeWidth={2.5} />
                            )}
                        </button>

                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder={`Option ${index + 1}...`}
                                value={option.text}
                                onChange={(e) => updateOptionText(option.id, e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[var(--brand-light)] focus:ring-4 focus:ring-[var(--brand)]/5 transition-all"
                            />
                        </div>

                        <button
                            onClick={() => removeOption(option.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}

                {options.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-[32px]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            No options added yet
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
