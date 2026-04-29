'use client';
import React from 'react';
import { Question } from './types';
import UnitRenderer, { UnitQuestion, QuestionType } from '../UnitRenderer';

interface StudentPreviewProps {
    question: Question | undefined;
    mode: 'desktop' | 'mobile'; // Kept for prop compatibility
    setMode: (_m: 'desktop' | null) => void;
}

export default function StudentPreview({ question, mode, setMode }: StudentPreviewProps) {
    const unitQuestion: UnitQuestion | null = React.useMemo(() => {
        if (!question) return null;

        const base = {
            id: question.id,
            type: question.type as QuestionType,
            title: question.title,
            difficulty: question.difficulty,
            topic: question.tags?.[0] || 'General',
            description: question.problemStatement || '',
        };

        if (question.type === 'Reading' && question.readingConfig) {
            const mappedBlocks = question.readingConfig.contentBlocks.map((b) => {
                if (b.type === 'text') {
                    return {
                        id: b.id,
                        type: 'text' as const,
                        content: b.content,
                    };
                }

                return {
                    id: b.id,
                    type: 'code' as const,
                    codeConfig: {
                        languageId: b.runnerConfig?.language || 'javascript',
                        initialCode: b.runnerConfig?.initialCode || '',
                    },
                };
            });

            return {
                ...base,
                description: '',
                readingContent: mappedBlocks,
            };
        }

        if (question.type === 'Coding' && question.codingConfig) {
            const lang = Object.keys(question.codingConfig.templates)[0] || 'javascript';
            const tmpl = question.codingConfig.templates[lang];
            return {
                ...base,
                codingConfig: {
                    languageId: lang,
                    header: tmpl.head,
                    initialCode: tmpl.body,
                    footer: tmpl.tail,
                    testCases: question.codingConfig.testCases || [],
                },
            };
        }

        if (question.type === 'Web' && question.webConfig) {
            return {
                ...base,
                webConfig: {
                    initialHTML: question.webConfig.html,
                    initialCSS: question.webConfig.css,
                    initialJS: question.webConfig.js,
                    showFiles: question.webConfig.showFiles,
                },
            };
        }

        if ((question.type === 'MCQ' || question.type === 'MultiSelect') && question.options) {
            return {
                ...base,
                mcqOptions: question.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
            };
        }

        if (question.type === 'Notebook' && question.notebookConfig) {
            return {
                ...base,
                notebookConfig: {
                    initialCode: question.notebookConfig.initialCode,
                    language: 'python',
                },
            };
        }

        return base;
    }, [question]);

    if (!question)
        return (
            <div className="flex-1 flex items-center justify-center text-slate-300 font-black uppercase tracking-widest italic">
                Select a question to preview
            </div>
        );

    return (
        <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-[#f4f6f9]">
            {/* Renderer Container - Using exact UnitRenderer */}
            <div
                className={`mx-auto flex-1 overflow-hidden transition-all duration-300 ${mode === 'mobile' ? 'my-4 w-[375px] rounded-[28px] bg-slate-900 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.28)]' : 'w-full bg-white'}`}
            >
                <UnitRenderer
                    question={unitQuestion as UnitQuestion}
                    activeTab="question"
                    onNext={() => {}}
                    onPrevious={() => {}}
                    hideSubmit={true}
                />
            </div>
        </div>
    );
}
