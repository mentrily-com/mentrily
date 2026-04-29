'use client';
import React from 'react';
import { TerminalSquare, Clock, ShieldCheck } from 'lucide-react';
import { Question } from '../../types';
import CodeMirrorEditor from '../../CodeMirrorEditor';

interface NotebookEditorProps {
    question: Question;
    onChange: (updates: Partial<Question>) => void;
}

export default function NotebookEditor({ question, onChange }: NotebookEditorProps) {
    const config = question.notebookConfig || {
        initialCode:
            '# Write your Python code here\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nprint("Hello from Python Notebook!")',
        language: 'python',
        maxExecutionTime: 10,
        allowedLibraries: ['numpy', 'matplotlib'],
    };

    const updateConfig = (updates: Partial<typeof config>) => {
        onChange({ notebookConfig: { ...config, ...updates } });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Environment Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800">
                                Execution Timeout
                            </h4>
                            <p className="text-[9px] font-bold text-slate-400">Seconds before kernel kills process</p>
                        </div>
                    </div>
                    <input
                        type="number"
                        value={config.maxExecutionTime}
                        onChange={(e) => updateConfig({ maxExecutionTime: parseInt(e.target.value) || 0 })}
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-amber-600 outline-none focus:border-amber-200 focus:ring-4 focus:ring-amber-500/5 transition-all"
                        placeholder="10"
                    />
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800">
                                Pre-loaded Libraries
                            </h4>
                            <p className="text-[9px] font-bold text-slate-400">Comma separated Pip packages</p>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={config.allowedLibraries?.join(', ')}
                        onChange={(e) =>
                            updateConfig({
                                allowedLibraries: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                            })
                        }
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-emerald-600 outline-none focus:border-emerald-200 focus:ring-4 focus:ring-emerald-500/5 transition-all"
                        placeholder="numpy, pandas, matplotlib"
                    />
                </div>
            </div>

            {/* Starter Code */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <TerminalSquare size={16} className="text-orange-500" />
                        Notebook Starter Code
                    </h4>
                </div>
                <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                    <div className="p-1">
                        <CodeMirrorEditor
                            value={config.initialCode}
                            onChange={(val) => updateConfig({ initialCode: val })}
                            language="python"
                            height="400px"
                            theme="dark"
                            placeholder="# Define initial variables or plotting code for students..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
