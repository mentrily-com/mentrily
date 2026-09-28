'use client';
import React, { useCallback, useMemo } from 'react';
import { Question } from '../../types';
import SharedWebEditor from '../../../WebEditor/WebEditor';
import { Eye, EyeOff } from 'lucide-react';

interface WebEditorProps {
    question: Question;
    onChange: (updates: Partial<Question>) => void;
}

export default function WebEditor({ question, onChange }: WebEditorProps) {
    const config = useMemo(
        () => ({
            html: question.webConfig?.html || '<!-- Write your HTML here -->',
            css: question.webConfig?.css || '/* Write your CSS here */',
            js: question.webConfig?.js || '// Write your JavaScript here',
            showFiles: question.webConfig?.showFiles || { html: true, css: true, js: true },
            testCases: question.webConfig?.testCases || [],
        }),
        [question.webConfig],
    );

    const toggleFile = useCallback(
        (file: keyof typeof config.showFiles) => {
            onChange({
                webConfig: {
                    ...config,
                    showFiles: {
                        ...config.showFiles,
                        [file]: !config.showFiles[file],
                    },
                },
            });
        },
        [config, onChange],
    );

    const handleWebEditorChange = useCallback(
        (files: { html: string; css: string; js: string }) => {
            // Only update if content actually changed to avoid loop
            if (files.html === config.html && files.css === config.css && files.js === config.js) return;

            onChange({
                webConfig: {
                    ...config,
                    html: files.html,
                    css: files.css,
                    js: files.js,
                },
            });
        },
        [config, onChange],
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                        Student File Visibility:
                    </span>
                    <div className="flex bg-gray-100 p-1.5 rounded-lg gap-1.5 border border-gray-200/50">
                        <VisibilityToggle
                            active={config.showFiles.html}
                            onClick={() => toggleFile('html')}
                            label="HTML"
                        />
                        <VisibilityToggle active={config.showFiles.css} onClick={() => toggleFile('css')} label="CSS" />
                        <VisibilityToggle active={config.showFiles.js} onClick={() => toggleFile('js')} label="JS" />
                    </div>
                </div>
                <div className="px-4 py-2.5 bg-[var(--brand-light)]/50 rounded-lg border border-[var(--brand-light)] flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[var(--brand)] uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse"></div>
                        Authoring Mode
                    </span>
                </div>
            </div>

            <div className="h-[650px] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-md relative">
                <SharedWebEditor
                    key={question.id}
                    initialHTML={config.html}
                    initialCSS={config.css}
                    initialJS={config.js}
                    showFiles={{ html: true, css: true, js: true }} // Author sees all files
                    hideTestCases={true}
                    hideReset={true}
                    onChange={handleWebEditorChange}
                />
            </div>
        </div>
    );
}

function VisibilityToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    const handleBtnClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    };

    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // Prevents focus stealing from editor if clicking
            onClick={handleBtnClick}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-widest transition-all active:scale-95 ${
                active
                    ? 'bg-white text-[var(--brand)] shadow-sm ring-1 ring-gray-200/50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'
            }`}
        >
            <div
                className={`pointer-events-none transition-transform duration-300 ${active ? 'scale-110' : 'scale-100 opacity-60'}`}
            >
                {active ? <Eye size={14} /> : <EyeOff size={14} />}
            </div>
            <span className="pointer-events-none">{label}</span>
        </button>
    );
}
