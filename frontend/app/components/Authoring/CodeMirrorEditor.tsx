'use client';
import React, { useRef, useEffect } from 'react';
import { EditorState } from '@codemirror/state';
import {
    EditorView,
    keymap,
    placeholder as placeholderExt,
    lineNumbers,
    highlightActiveLineGutter,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodeMirrorEditorProps {
    value: string;
    onChange: (val: string) => void;
    language?: 'javascript' | 'python' | 'java' | 'cpp' | 'html' | 'css';
    placeholder?: string;
    className?: string;
    height?: string;
    readOnly?: boolean;
    theme?: 'light' | 'dark';
}

export default function CodeMirrorEditor({
    value,
    onChange,
    language = 'javascript',
    placeholder,
    className = '',
    height = '300px',
    readOnly = false,
    theme,
}: CodeMirrorEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const effectiveTheme = theme || 'light';

    useEffect(() => {
        if (!editorRef.current) return;

        const langExtension = getLanguageExtension(language);
        const themeExtension = effectiveTheme === 'dark' ? oneDark : [];

        const startState = EditorState.create({
            doc: value,
            extensions: [
                lineNumbers(),
                highlightActiveLineGutter(),
                history(),
                bracketMatching(),
                indentOnInput(),
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                langExtension,
                themeExtension,
                placeholderExt(placeholder || ''),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChange(update.state.doc.toString());
                    }
                }),
                EditorState.readOnly.of(readOnly),
                EditorView.theme({
                    '&': { height: height, fontSize: '13px' },
                    '.cm-scroller': { overflow: 'auto' },
                }),
            ],
        });

        const view = new EditorView({
            state: startState,
            parent: editorRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveTheme, language]);

    // Handle updates to value (external changes)
    useEffect(() => {
        const view = viewRef.current;
        if (view) {
            const currentValue = view.state.doc.toString();
            if (value !== currentValue) {
                view.dispatch({
                    changes: { from: 0, to: currentValue.length, insert: value },
                });
            }
        }
    }, [value]);

    // Handle updates to language or theme by re-initializing or dispatching effects?
    // CodeMirror 6 dynamic reconfiguration is cleaner, but for now simple re-mount or effect dispatch is fine for prototype.
    // However, re-creating view on every language change is acceptable for this usecase.
    useEffect(() => {
        const view = viewRef.current;
        if (view) {
            const langExtension = getLanguageExtension(language);
            const themeExtension = effectiveTheme === 'dark' ? oneDark : [];

            // We can use a Compartment for dynamic config but simplistic approach:
            // To ensure clean switch, we might want to unmount/remount or use compartments.
            // For simplicity in this iteration, I'll stick to initial render unless the user changes tabs frequently.
            // Actually, the user WILL change tabs frequently (Lang tabs).
            // Ideally we should use Compartments but I'll force a re-render by key in the parent or accept a full re-init here if deps change.
        }
    }, [language, effectiveTheme]);

    // Better approach: Key logic in parent or full re-init if language changes.
    // I'll add language to the dependency array of the Init effect to force re-creation.
    // This is "expensive" but safe.

    return (
        <div
            ref={editorRef}
            className={`rounded-xl overflow-hidden border ${className} ${effectiveTheme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}
        />
    );
}

function getLanguageExtension(lang: string) {
    switch (lang) {
        case 'javascript':
            return javascript();
        case 'python':
            return python();
        case 'java':
            return java();
        case 'cpp':
            return cpp();
        case 'html':
            return html();
        case 'css':
            return css();
        default:
            return javascript();
    }
}
