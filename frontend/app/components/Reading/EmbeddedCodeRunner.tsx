'use client';
import React, { useState } from 'react';
import { useEditor } from '../Editor/hooks/useEditor';
import { LanguageConfig } from '../Editor/types';
import ExecuteButton from '../Common/ExecuteButton';

import { CodeExecutionService } from '@/services/api/CodeExecutionService';

interface EmbeddedCodeRunnerProps {
    language: LanguageConfig;
    initialCode?: string;
    onRunSuccess?: () => void;
}

export default function EmbeddedCodeRunner({ language, initialCode, onRunSuccess }: EmbeddedCodeRunnerProps) {
    const [code, setCode] = useState(initialCode || language.initialBody || '');
    const [output, setOutput] = useState<string | null>(null);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    const { editorRef } = useEditor({
        language: {
            ...language,
            initialBody: initialCode || language.initialBody,
        },
        actions: {
            onChange: (newCode) => setCode(newCode),
        },
    });

    const handleRun = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setIsTerminalOpen(true);

        try {
            // Provide immediate feedback
            setOutput(null); // Clear previous output or show loading state implicitly via UI

            const result = await CodeExecutionService.run(language.id, code, '');

            // Show ONLY the output as requested
            const finalOutput = result.output || (result.stderr ? `Error: ${result.stderr}` : 'No output returned.');
            setOutput(finalOutput);

            if (!result.stderr && onRunSuccess) {
                onRunSuccess();
            }
        } catch (error) {
            console.error('Embedded Execution Error:', error);
            setOutput(`Error: Failed to execute code.\n${String(error)}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="my-6 sm:my-8 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Top Bar */}
            <div className="min-h-10 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded text-[10px] font-black uppercase text-slate-500">
                        {language.label}
                    </span>
                </div>
                <button className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-[var(--brand)] transition-colors">
                    open in playground
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                </button>
            </div>

            {/* Editor Surface */}
            <div className="bg-white min-h-[180px] sm:min-h-[200px]">
                <div ref={editorRef} className="h-full w-full"></div>
            </div>

            {/* Bottom Bar */}
            <div className="min-h-12 border-t border-slate-100 flex flex-wrap items-center gap-3 px-3 py-2 sm:px-4 justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.location.reload()}
                        className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        reset
                    </button>
                    <ExecuteButton
                        onClick={handleRun}
                        label={isRunning ? 'Running...' : 'run'}
                        disabled={isRunning}
                        className={`scale-90 ${isRunning ? 'opacity-70 cursor-not-allowed' : ''}`}
                    />
                </div>
                {output && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Terminal Area */}
            {isTerminalOpen && (
                <div className="bg-[#0d1117] relative border-t border-slate-800">
                    <button
                        onClick={() => setIsTerminalOpen(false)}
                        className="absolute top-3 right-4 text-slate-500 hover:text-white transition-colors"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="p-4 sm:p-6 font-mono text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                        <span className="text-emerald-500 mr-2">$</span>
                        {output || 'Running...'}
                    </div>
                </div>
            )}

            <style jsx global>{`
                .cm-editor {
                    outline: none !important;
                    min-height: 200px;
                    height: auto !important;
                    background: #ffffff !important;
                }
                .cm-scroller {
                    padding: 15px 0;
                }
                .cm-content {
                    font-family: 'Geist Mono', monospace !important;
                    font-size: 13px !important;
                    color: #1e293b !important;
                    caret-color: #f77621 !important;
                }
                .cm-gutters {
                    background-color: white !important;
                    border: none !important;
                    color: #cbd5e1 !important;
                }
                .cm-activeLine {
                    background-color: #f8fafc !important;
                }
                .cm-keyword {
                    color: #f77621 !important;
                    font-weight: bold;
                }
                .cm-string {
                    color: #059669 !important;
                }
                .cm-comment {
                    color: #94a3b8 !important;
                    font-style: italic;
                }
                .cm-variable {
                    color: #0f172a !important;
                }
            `}</style>
        </div>
    );
}
