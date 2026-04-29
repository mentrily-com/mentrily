'use client';
import React from 'react';
import { useEditor } from '../Editor/hooks/useEditor';
import { LanguageConfig } from '../Editor/types';

interface PlaygroundEditorProps {
    language: LanguageConfig;
    code: string;
    onChange: (code: string) => void;
}

export default function PlaygroundEditor({ language, code, onChange }: PlaygroundEditorProps) {
    const { editorRef } = useEditor({
        language: { ...language, initialBody: code },
        actions: {
            onChange: (newCode) => onChange(newCode),
        },
    });

    return (
        <div className="flex-1 w-full bg-white relative overflow-hidden">
            {/* Simple Editor Container */}
            <div ref={editorRef} className="h-full w-full"></div>

            <style jsx global>{`
                .cm-editor {
                    outline: none !important;
                    height: 100%;
                    background-color: white !important;
                }
                .cm-scroller {
                    padding-top: 20px;
                }
                .cm-content {
                    font-family: 'Geist Mono', 'JetBrains Mono', monospace !important;
                    font-size: 14px !important;
                    line-height: 1.6;
                    color: #1e293b !important;
                }

                /* Autocomplete / Code Suggestions fix */
                .cm-tooltip.cm-tooltip-autocomplete {
                    background-color: #ffffff !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 8px !important;
                    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1) !important;
                    overflow: hidden !important;
                    z-index: 100 !important;
                }
                .cm-tooltip-autocomplete > ul > li {
                    color: #475569 !important;
                    padding: 4px 12px !important;
                    font-size: 13px !important;
                }
                .cm-tooltip-autocomplete > ul > li[aria-selected] {
                    background-color: #f8fafc !important;
                    color: var(--brand) !important;
                }
                .cm-completionDetail {
                    font-style: italic !important;
                    opacity: 0.6 !important;
                    margin-left: 8px !important;
                }
                .cm-completionIcon {
                    display: none !important;
                }

                .cm-gutters {
                    background-color: white !important;
                    border-right: 1px solid #f1f5f9 !important;
                    color: #94a3b8 !important;
                    padding-right: 12px !important;
                    font-size: 12px !important;
                }
                /* Syntax Highlighting Visibility Fixes */
                .cm-keyword {
                    color: var(--brand) !important;
                    font-weight: 600;
                }
                .cm-string {
                    color: #0891b2 !important;
                }
                .cm-comment {
                    color: #94a3b8 !important;
                    font-style: italic;
                }
                .cm-variable {
                    color: #1e293b !important;
                }
                .cm-number {
                    color: #e11d48 !important;
                }
                .cm-operator {
                    color: #64748b !important;
                }

                .cm-activeLine {
                    background-color: #f8fafc !important;
                }
                .cm-activeLineGutter {
                    background-color: #f8fafc !important;
                    color: var(--brand) !important;
                    font-weight: bold;
                }
                .cm-selectionBackground {
                    background-color: #ffedd5 !important;
                }
            `}</style>
        </div>
    );
}
