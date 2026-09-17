'use client';
import { useEffect, useRef, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
    EditorView,
    lineNumbers,
    highlightActiveLineGutter,
    highlightSpecialChars,
    drawSelection,
    dropCursor,
    rectangularSelection,
    crosshairCursor,
    highlightActiveLine,
    keymap,
} from '@codemirror/view';
import {
    indentOnInput,
    syntaxHighlighting,
    defaultHighlightStyle,
    bracketMatching,
    foldKeymap,
} from '@codemirror/language';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';

import { CodeEditorProps } from '../types';
import { securityPlugin } from '../plugins/SecurityPlugin';

export function useEditor(props: CodeEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [view, setView] = useState<EditorView | null>(null);
    const isMounted = useRef(true);
    const languageConfRef = useRef(new Compartment());

    // Store latest props in a ref to avoid stale closures in CM listeners
    const propsRef = useRef(props);
    useEffect(() => {
        propsRef.current = props;
    }, [props]);

    useEffect(() => {
        isMounted.current = true;

        const frameId = requestAnimationFrame(() => {
            if (!editorRef.current || !isMounted.current) return;

            if (!viewRef.current) {
                const startState = EditorState.create({
                    doc: props.language.initialBody,
                    extensions: [
                        lineNumbers(),
                        highlightActiveLineGutter(),
                        highlightSpecialChars(),
                        history(),
                        drawSelection(),
                        dropCursor(),
                        EditorState.allowMultipleSelections.of(!props.options?.disableMultiCursor),
                        indentOnInput(),
                        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                        bracketMatching(),
                        closeBrackets(),
                        autocompletion(),
                        rectangularSelection(),
                        crosshairCursor(),
                        highlightActiveLine(),
                        highlightSelectionMatches(),
                        EditorState.readOnly.of(!!props.options?.readOnly),
                        EditorView.editable.of(!props.options?.readOnly),

                        keymap.of([
                            ...closeBracketsKeymap,
                            ...defaultKeymap,
                            ...searchKeymap,
                            ...historyKeymap,
                            ...foldKeymap,
                            ...completionKeymap,
                            ...lintKeymap,
                            indentWithTab,
                        ]),

                        languageConfRef.current.of([]),
                        securityPlugin(props.options || {}, (msg) => propsRef.current.actions?.onCheatDetected?.(msg)),

                        EditorView.updateListener.of((update) => {
                            if (update.docChanged) {
                                // IMPORTANT: Use Ref to call latest version of onChange
                                propsRef.current.actions?.onChange?.(update.state.doc.toString());
                            }
                            if (update.focusChanged) {
                                if (update.view.hasFocus) propsRef.current.actions?.onFocus?.();
                                else propsRef.current.actions?.onBlur?.();
                            }
                        }),

                        EditorView.theme({
                            '&': { height: '100%', fontSize: '14px' },
                            '.cm-scroller': { overflow: 'auto' },
                            '.cm-content': { fontFamily: 'monospace' },
                            '.cm-gutters': { backgroundColor: 'transparent', borderRight: 'none' },
                        }),
                    ],
                });

                const v = new EditorView({
                    state: startState,
                    parent: editorRef.current,
                });

                viewRef.current = v;
                setView(v);

                const loadInitialLang = async () => {
                    try {
                        const langExt = await props.language.extension();
                        if (viewRef.current && isMounted.current) {
                            v.dispatch({ effects: languageConfRef.current.reconfigure(langExt) });
                        }
                    } catch (e) {}
                };
                loadInitialLang();
            }
        });

        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                props.actions?.onCheatDetected?.('Window minimized or Tab switched');
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        const resizeObserver = new ResizeObserver(() => {
            if (viewRef.current && isMounted.current) {
                viewRef.current.requestMeasure();
            }
        });
        if (editorRef.current) resizeObserver.observe(editorRef.current);

        return () => {
            isMounted.current = false;
            cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            document.removeEventListener('visibilitychange', handleVisibility);
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
    }, []);

    // Reconfigure language extension ONLY when language ID changes (never on document typing)
    useEffect(() => {
        if (!viewRef.current) return;
        let cancelled = false;

        const updateLang = async () => {
            try {
                const langExt = await props.language.extension();
                if (viewRef.current && isMounted.current && !cancelled) {
                    viewRef.current.dispatch({
                        effects: [languageConfRef.current.reconfigure(langExt)],
                    });
                }
            } catch (e) {
                console.error('Failed to load language extension', e);
            }
        };
        updateLang();

        return () => {
            cancelled = true;
        };
    }, [props.language.id]);

    // Synchronize editor document when initialBody changes externally (e.g. question switch or reset)
    const prevInitialBodyRef = useRef(props.language.initialBody);
    useEffect(() => {
        if (!viewRef.current) return;
        if (props.language.initialBody !== prevInitialBodyRef.current) {
            prevInitialBodyRef.current = props.language.initialBody;
            const currentDoc = viewRef.current.state.doc.toString();
            if (currentDoc !== props.language.initialBody) {
                viewRef.current.dispatch({
                    changes: {
                        from: 0,
                        to: currentDoc.length,
                        insert: props.language.initialBody,
                    },
                });
            }
        }
    }, [props.language.initialBody]);

    return { editorRef, view };
}
