'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Code2, Copy, Link as LinkIcon, X } from 'lucide-react';
import SplitPane from '@/app/components/SplitPane';
import PlaygroundEditor from '@/app/components/Playground/PlaygroundEditor';
import PlaygroundTerminal from '@/app/components/Playground/PlaygroundTerminal';
import CodingEditor from '@/app/components/Authoring/QuestionBuilder/modules/CodingEditor';
import CodingQuestionRenderer from '@/app/components/CodingQuestionRenderer';
import { PLAYGROUND_LANGUAGES } from '@/app/components/Editor/playgroundLanguages';
import { CodeExecutionService } from '@/services/api/CodeExecutionService';

// Tiptap rich-text editor is heavy and only used for the (conditionally
// rendered) coding-question authoring panel — defer it so the playground shell
// paints without pulling the editor bundle up front. No ref is passed and it's
// interactive-only, so ssr:false is safe.
const RichTextEditor = dynamic(() => import('@/app/components/Authoring/RichTextEditor'), {
    ssr: false,
    loading: () => <div className="min-h-[160px] rounded-[28px] bg-slate-50 animate-pulse" />,
});

interface Tab {
    id: number;
    name: string;
    langId: string;
    code: string;
}

interface PlaygroundCoreProps {
    initialLangId?: string;
    publicMode?: boolean;
    publicSurface?: boolean;
}

function getDefaultLanguage(initialLangId?: string) {
    return (
        PLAYGROUND_LANGUAGES.find((language) => language.id === initialLangId) ||
        PLAYGROUND_LANGUAGES.find((language) => language.id === 'javascript') ||
        PLAYGROUND_LANGUAGES[0]
    );
}

export default function PlaygroundCore({
    initialLangId = 'javascript',
    publicMode = false,
    publicSurface = false,
}: PlaygroundCoreProps) {
    const initialLanguage = getDefaultLanguage(initialLangId);
    const [tabs, setTabs] = useState<Tab[]>([
        { id: 1, name: 'playground', langId: initialLanguage.id, code: initialLanguage.initialBody },
    ]);
    const [activeTabId, setActiveTabId] = useState(1);
    const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [customInput, setCustomInput] = useState('');
    const [showQuestionModal, setShowQuestionModal] = useState(false);

    useEffect(() => {
        if (
            publicMode &&
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('create') === '1'
        ) {
            setShowQuestionModal(true);
        }
    }, [publicMode]);

    const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
    const currentLang =
        PLAYGROUND_LANGUAGES.find((language) => language.id === activeTab.langId) || PLAYGROUND_LANGUAGES[0];

    const handleRun = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setTerminalOutput([]);

        try {
            const result = publicMode
                ? await CodeExecutionService.publicRun(currentLang.id, activeTab.code, customInput)
                : await CodeExecutionService.run(currentLang.id, activeTab.code, customInput);

            const finalOutput = result.output || (result.stderr ? `Error: ${result.stderr}` : 'No output returned.');
            setTerminalOutput([finalOutput]);
        } catch (error) {
            console.error('Execution error:', error);
            const message = String(error);
            setTerminalOutput([
                message.includes('429')
                    ? 'Public execution limit reached. Sign in to continue.'
                    : 'Error: Failed to execute code.',
                message,
            ]);
        } finally {
            setIsRunning(false);
        }
    };

    const handleCodeChange = (newCode: string) => {
        setTabs(tabs.map((tab) => (tab.id === activeTabId ? { ...tab, code: newCode } : tab)));
    };

    const handleClear = () => {
        setTerminalOutput([]);
    };

    const addTab = () => {
        const newId = Math.max(...tabs.map((tab) => tab.id), 0) + 1;
        setTabs([
            ...tabs,
            {
                id: newId,
                name: `page-${newId}`,
                langId: initialLanguage.id,
                code: initialLanguage.initialBody,
            },
        ]);
        setActiveTabId(newId);
    };

    const deleteTab = (id: number) => {
        if (!id || tabs.length === 1) return;
        setTabs(tabs.filter((tab) => tab.id !== id));
        if (activeTabId === id) {
            setActiveTabId(tabs[0].id !== id ? tabs[0].id : tabs[1].id);
        }
        setShowDeleteConfirm(null);
    };

    const updateTabLang = (langId: string) => {
        const lang = PLAYGROUND_LANGUAGES.find((language) => language.id === langId);
        setTabs(tabs.map((tab) => (tab.id === activeTabId ? { ...tab, langId, code: lang?.initialBody || '' } : tab)));
    };

    if (publicMode || publicSurface) {
        return (
            <PublicCompilerSurface
                initialLangId={initialLanguage.id}
                publicMode={publicMode}
                onCreateQuestion={() => setShowQuestionModal(true)}
                showQuestionModal={showQuestionModal}
                onCloseQuestionModal={() => setShowQuestionModal(false)}
            />
        );
    }

    return (
        <div
            className="w-full h-full min-h-0 flex flex-col overflow-hidden font-sans rounded-2xl border bg-white"
            style={{ borderColor: 'var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}
        >
            <div
                className="h-14 shrink-0 border-b px-5 flex items-center justify-between"
                style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}
            >
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-bg-blue-tint)', color: 'var(--brand)' }}
                    >
                        <Code2 size={16} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Code Playground
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                            Run and iterate instantly
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-hidden relative">
                    <SplitPane
                        initialLeftWidth={55}
                        leftContent={
                            <div className="h-full flex flex-col bg-white relative">
                                <div className="h-12 border-b border-slate-100 flex items-center px-4 justify-between bg-white z-20">
                                    <div className="flex items-center gap-1 h-full min-w-0">
                                        <div className="pr-4 border-r border-slate-100 mr-2">
                                            <select
                                                value={activeTab.langId}
                                                onChange={(event) => updateTabLang(event.target.value)}
                                                className="text-[12px] font-bold text-slate-600 bg-transparent outline-none cursor-pointer hover:text-[var(--brand)] transition-colors"
                                            >
                                                {PLAYGROUND_LANGUAGES.map((lang) => (
                                                    <option key={lang.id} value={lang.id}>
                                                        {lang.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {tabs.map((tab) => (
                                            <div
                                                key={tab.id}
                                                onClick={() => setActiveTabId(tab.id)}
                                                className={`group px-6 h-full flex items-center text-[12px] font-bold transition-all border-b-2 relative cursor-pointer ${
                                                    activeTabId === tab.id
                                                        ? 'border-[var(--brand)] text-slate-700 bg-slate-50/50'
                                                        : 'border-transparent text-slate-400 hover:bg-slate-50'
                                                }`}
                                            >
                                                {tab.name}
                                                {tabs.length > 1 && (
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setShowDeleteConfirm(tab.id);
                                                        }}
                                                        className="ml-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                                    >
                                                        <X size={10} strokeWidth={3} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}

                                        <button
                                            onClick={addTab}
                                            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--brand)] hover:bg-[var(--brand-light)] transition-colors ml-2"
                                        >
                                            +
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={handleClear}
                                            title="Clear Terminal"
                                            className="p-2 text-slate-400 hover:text-[var(--brand)] transition-all active:rotate-180 duration-500"
                                        >
                                            Clear
                                        </button>

                                        <button
                                            onClick={handleRun}
                                            disabled={isRunning}
                                            className={`flex items-center gap-2 px-6 py-1.5 bg-[var(--brand)] text-white text-[11px] font-black uppercase tracking-widest rounded-md hover:bg-[var(--brand-dark)] transition-all active:scale-95 shadow-sm shadow-[var(--brand-light)] ${
                                                isRunning ? 'opacity-70 cursor-wait' : ''
                                            }`}
                                        >
                                            {isRunning ? 'Running' : 'Execute'}
                                        </button>
                                    </div>
                                </div>

                                <PlaygroundEditor
                                    key={activeTabId}
                                    language={currentLang}
                                    code={activeTab.code}
                                    onChange={handleCodeChange}
                                />
                            </div>
                        }
                        rightContent={
                            <PlaygroundTerminal
                                output={terminalOutput}
                                onClear={handleClear}
                                customInput={customInput}
                                onCustomInputChange={setCustomInput}
                            />
                        }
                    />

                    {showDeleteConfirm && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in duration-200">
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Delete this page?</h3>
                                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                                    You are about to delete{' '}
                                    <span className="font-bold text-slate-700">
                                        &ldquo;{tabs.find((tab) => tab.id === showDeleteConfirm)?.name}&rdquo;
                                    </span>
                                    . This action cannot be undone.
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setShowDeleteConfirm(null)}
                                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => deleteTab(showDeleteConfirm)}
                                        className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function buildCompilerQuestion(initialLangId: string) {
    const initialLanguage = getDefaultLanguage(initialLangId);
    const templates = PLAYGROUND_LANGUAGES.reduce(
        (acc, language) => {
            acc[language.id] = {
                head: language.header,
                body: language.initialBody,
                tail: language.footer,
                solution: '',
            };
            return acc;
        },
        {} as Record<string, { head: string; body: string; tail: string; solution: string }>,
    );

    return {
        id: 'public-compiler',
        type: 'Coding' as const,
        title: 'Code Playground',
        description: '',
        difficulty: 'Practice',
        topic: 'Compiler',
        codingConfig: {
            languageId: initialLangId,
            header: initialLanguage.header,
            initialCode: initialLanguage.initialBody,
            footer: initialLanguage.footer,
            templates,
            allowedLanguages: PLAYGROUND_LANGUAGES.map((language) => language.id),
            testCases: [],
            showTestCases: true,
        },
    };
}

function PublicCompilerSurface({
    initialLangId,
    publicMode,
    onCreateQuestion,
    showQuestionModal,
    onCloseQuestionModal,
}: {
    initialLangId: string;
    publicMode: boolean;
    onCreateQuestion: () => void;
    showQuestionModal: boolean;
    onCloseQuestionModal: () => void;
}) {
    const [question] = useState(() => buildCompilerQuestion(initialLangId));
    const [answer, setAnswer] = useState<any>(null);
    const [selectedLang, setSelectedLang] = useState<string | null>(initialLangId);
    const [isRunning, setIsRunning] = useState(false);
    const [terminalLogs, setTerminalLogs] = useState('');
    const [executionResults, setExecutionResults] = useState<any[]>([]);
    const selectedLanguageLabel =
        PLAYGROUND_LANGUAGES.find((language) => language.id === selectedLang)?.label ||
        getDefaultLanguage(initialLangId).label;

    useEffect(() => {
        const openBuilder = (event: Event) => {
            event.preventDefault();
            onCreateQuestion();
        };
        window.addEventListener('open-public-question-builder', openBuilder);
        return () => window.removeEventListener('open-public-question-builder', openBuilder);
    }, [onCreateQuestion]);

    return (
        <div className="public-compiler-surface relative flex h-[70vh] max-h-[720px] min-h-[420px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex h-10 items-center justify-between border-b border-slate-100 px-3">
                <div className="min-w-0">
                    <h1 className="truncate text-xs font-black text-slate-800">
                        Online {selectedLanguageLabel} Compiler
                    </h1>
                    <p className="hidden truncate text-[10px] font-medium text-slate-400 md:block">
                        Run code instantly in the Mentrily playground.
                    </p>
                </div>
            </div>
            <div className="min-h-0 flex-1">
                <CodingQuestionRenderer
                    question={question}
                    hasAttemptSelected={false}
                    attemptAnswer={null}
                    currentAnswer={answer}
                    onAnswerChange={setAnswer}
                    onSubmit={setAnswer}
                    contentFontSize={14}
                    selectedCodingLang={selectedLang}
                    onLanguageChange={setSelectedLang}
                    isRunning={isRunning}
                    setIsRunning={setIsRunning}
                    terminalLogs={terminalLogs}
                    setTerminalLogs={setTerminalLogs}
                    executionResults={executionResults}
                    setExecutionResults={setExecutionResults}
                    publicMode={publicMode}
                    hideSubmit
                />
            </div>
            {showQuestionModal && <PublicQuestionModal onClose={onCloseQuestionModal} />}
        </div>
    );
}

function PublicQuestionModal({ onClose }: { onClose: () => void }) {
    const [question, setQuestion] = useState<any>(() => {
        const javascript = getDefaultLanguage('javascript');
        return {
            id: 'public-builder',
            type: 'Coding',
            title: 'Shared coding challenge',
            description: '',
            marks: 0,
            codingConfig: {
                templates: {
                    javascript: {
                        head: javascript.header,
                        body: javascript.initialBody,
                        tail: javascript.footer,
                        solution: '',
                    },
                },
                testCases: [{ input: '', output: '', isPublic: true, points: 5 }],
                showTestCases: true,
                allowedLanguages: ['javascript'],
                languageId: 'javascript',
            },
        };
    });
    const [isSaving, setIsSaving] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [error, setError] = useState('');

    const getPlainText = (html: string) => {
        if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '').trim();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return (doc.body.textContent || '').trim();
    };

    const formatSaveError = (saveError: unknown) => {
        const raw = String(saveError instanceof Error ? saveError.message : saveError);
        const jsonStart = raw.indexOf('{');
        if (jsonStart >= 0) {
            try {
                const parsed = JSON.parse(raw.slice(jsonStart));
                if (typeof parsed?.message === 'string') return parsed.message;
                if (Array.isArray(parsed?.message)) return parsed.message.join(', ');
            } catch {}
        }
        if (raw.includes('429')) {
            return 'Only one active shared question can be created per IP. Sign in to create more questions.';
        }
        if (raw.includes('Problem statement is required')) {
            return 'Add a problem statement before generating the share link.';
        }
        return 'Could not create the share link. Please check the question details and try again.';
    };

    const save = async () => {
        setIsSaving(true);
        setError('');
        setShareUrl('');

        if (!getPlainText(question.description)) {
            setError('Add a problem statement before generating the share link.');
            setIsSaving(false);
            return;
        }

        try {
            const result = await CodeExecutionService.createPublicQuestion(question);
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            setShareUrl(`${origin}${result.path}`);
        } catch (saveError) {
            setError(formatSaveError(saveError));
        } finally {
            setIsSaving(false);
        }
    };

    const copy = async () => {
        if (!shareUrl || typeof navigator === 'undefined') return;
        await navigator.clipboard.writeText(shareUrl);
    };

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                {shareUrl ? (
                    <div className="p-6">
                        <div className="mx-auto max-w-xl rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-center shadow-xl shadow-emerald-100">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                                <LinkIcon size={22} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900">Your question link is ready</h2>
                            <p className="mt-1 text-sm font-semibold text-slate-600">
                                Share this link with friends. Anonymous links stay active for 3 days.
                            </p>
                            <div className="mt-5 flex gap-2">
                                <input
                                    readOnly
                                    value={shareUrl}
                                    className="min-w-0 flex-1 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                                />
                                <button
                                    onClick={copy}
                                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
                                >
                                    <Copy size={14} />
                                    Copy
                                </button>
                            </div>
                            <div className="mt-5 flex justify-center gap-3">
                                <button
                                    onClick={onClose}
                                    className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-700"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-800">Create a coding question</h2>
                                <p className="text-xs font-semibold text-slate-500">
                                    Anonymous links are valid for 3 days. Sign in to keep links valid for 30 days.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
                            <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                                <label className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Title
                                    </span>
                                    <input
                                        value={question.title}
                                        onChange={(event) =>
                                            setQuestion((prev: any) => ({ ...prev, title: event.target.value }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-[var(--brand)]"
                                    />
                                </label>
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Problem Statement
                                    </span>
                                    <div className="rounded-[28px]">
                                        <RichTextEditor
                                            content={question.description}
                                            onChange={(description) =>
                                                setQuestion((prev: any) => ({ ...prev, description }))
                                            }
                                            placeholder="Describe what the solver needs to build."
                                            compact
                                        />
                                    </div>
                                </div>
                            </div>

                            <CodingEditor
                                question={question}
                                onChange={(updates) => setQuestion((prev: any) => ({ ...prev, ...updates }))}
                            />

                            {error && (
                                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    <div className="font-black">{error}</div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
                            <button
                                onClick={onClose}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500"
                            >
                                Close
                            </button>
                            <button
                                onClick={save}
                                disabled={isSaving}
                                className="rounded-xl bg-[var(--brand)] px-5 py-2 text-sm font-black text-white disabled:opacity-60"
                            >
                                {isSaving ? 'Saving...' : 'Save and generate link'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
