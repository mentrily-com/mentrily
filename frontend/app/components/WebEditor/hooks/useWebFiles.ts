'use client';
import { useState, useCallback, useEffect, useRef } from 'react';

export interface WebFiles {
    'index.html': string;
    'index.css': string;
    'index.js': string;
}

export type WebFileName = keyof WebFiles;

export function useWebFiles(initialFiles: WebFiles) {
    const [files, setFiles] = useState<WebFiles>(initialFiles);
    const [activeFile, setActiveFile] = useState<WebFileName>('index.html');

    // Keep files state in sync if the `initialFiles` content actually changes (avoid infinite loop on new object refs)
    const initialFilesJsonRef = useRef<string>('');
    useEffect(() => {
        try {
            const json = JSON.stringify(initialFiles || {});
            if (initialFilesJsonRef.current !== json) {
                initialFilesJsonRef.current = json;
                setFiles(initialFiles);
                // Do NOT reset active file here, as it causes tab jumping during parent updates
            }
        } catch (e) {
            initialFilesJsonRef.current = 'error';
            setFiles(initialFiles);
        }
    }, [initialFiles]);

    const updateFile = useCallback((name: WebFileName, content: string) => {
        setFiles((prev) => ({
            ...prev,
            [name]: content,
        }));
    }, []);

    const resetFiles = useCallback(() => {
        setFiles(initialFiles);
    }, [initialFiles]);

    return {
        files,
        activeFile,
        setActiveFile,
        updateFile,
        resetFiles,
    };
}
