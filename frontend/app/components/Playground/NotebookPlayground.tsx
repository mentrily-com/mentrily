'use client';
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { LanguageConfig } from '../Editor/types';
import CoursePlayerSkeleton from '../Skeletons/CoursePlayerSkeleton';

const CodeEditor = dynamic(() => import('../Editor/CodeEditor'), {
    loading: () => <CoursePlayerSkeleton isExamMode hasSidebar={false} />,
    ssr: false,
});
import { python } from '@codemirror/lang-python';
import { Play, Plus, Trash2 } from 'lucide-react';

const NotebookConfig: LanguageConfig = {
    id: 'python-notebook',
    label: 'Python (Notebook)',
    header: '',
    initialBody: '',
    footer: '',
    extension: async () => python(),
};

interface OutputItem {
    id: string;
    type: 'stdout' | 'stderr' | 'image';
    content: string;
}

interface Cell {
    id: string;
    code: string;
    outputs: OutputItem[];
    isExecuting: boolean;
}

export default function NotebookPlayground() {
    const [cells, setCells] = useState<Cell[]>([
        {
            id: 'cell-1',
            code: `import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 10, 100)\ny = np.sin(x)\nplt.plot(x, y)\nplt.title("Waveform")\nplt.show()`,
            outputs: [],
            isExecuting: false,
        },
    ]);

    const [isWorkerReady, setIsWorkerReady] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const activeCellIdRef = useRef<string | null>(null);
    const nextCellIdRef = useRef(2);

    // Single robust useEffect for worker management
    useEffect(() => {
        const worker = new Worker('/workers/pyodideWorker.js');
        workerRef.current = worker;

        worker.onmessage = (event) => {
            const { type, text, plots, error } = event.data;

            if (type === 'ready') {
                setIsWorkerReady(true);
                return;
            }

            const targetCellId = activeCellIdRef.current;
            if (!targetCellId) return;

            // Clear active cell if finished
            if (type === 'done' || type === 'error') {
                activeCellIdRef.current = null;
            }

            setCells((prev) =>
                prev.map((c) => {
                    if (c.id !== targetCellId) return c;

                    if (type === 'done') {
                        const newOutputs = [...c.outputs];
                        if (plots && Array.isArray(plots)) {
                            plots.forEach((p) =>
                                newOutputs.push({ id: Math.random().toString(), type: 'image', content: p }),
                            );
                        }
                        return { ...c, outputs: newOutputs, isExecuting: false };
                    }

                    if (type === 'error') {
                        return {
                            ...c,
                            outputs: [
                                ...c.outputs,
                                { id: Math.random().toString(), type: 'stderr', content: error || 'Unknown Error' },
                            ],
                            isExecuting: false,
                        };
                    }

                    if (type === 'stdout' || type === 'stderr') {
                        return { ...c, outputs: [...c.outputs, { id: Math.random().toString(), type, content: text }] };
                    }

                    return c;
                }),
            );
        };

        worker.postMessage({ action: 'init', id: 'init' });

        return () => worker.terminate();
    }, []);

    const runCell = (cellId: string) => {
        if (!isWorkerReady || activeCellIdRef.current) return;

        const cell = cells.find((c) => c.id === cellId);
        if (!cell || !cell.code.trim()) {
            // If empty, just stop executing state
            setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, isExecuting: false } : c)));
            return;
        }

        setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, outputs: [], isExecuting: true } : c)));
        activeCellIdRef.current = cellId;

        workerRef.current?.postMessage({
            action: 'run',
            id: cellId,
            code: cell.code,
        });
    };

    const addCell = (index: number) => {
        const newCell: Cell = {
            id: `cell-${nextCellIdRef.current++}`,
            code: '',
            outputs: [],
            isExecuting: false,
        };
        const newCells = [...cells];
        newCells.splice(index + 1, 0, newCell);
        setCells(newCells);
    };

    const deleteCell = (id: string) => {
        if (cells.length <= 1) {
            setCells([{ id: 'cell-' + Date.now(), code: '', outputs: [], isExecuting: false }]);
            return;
        }
        setCells(cells.filter((c) => c.id !== id));
    };

    const updateCellCode = (id: string, newCode: string) => {
        setCells((prev) => prev.map((c) => (c.id === id ? { ...c, code: newCode } : c)));
    };

    return (
        <div className="h-[calc(100%-56px)] overflow-y-auto px-4 py-5 md:px-6 md:py-6 bg-[var(--color-bg-subtle)]">
            <div className="mb-5 flex items-center justify-end">
                <div
                    className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${isWorkerReady ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'}`}
                >
                    <div className={`h-2 w-2 rounded-full ${isWorkerReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {isWorkerReady ? 'Python 3.11 Ready' : 'Initializing Kernel'}
                </div>
            </div>

            {/* Cells Container */}
            <div className="space-y-7 pb-24">
                {cells.map((cell, index) => (
                    <div key={cell.id} className="group flex flex-col gap-3">
                        <div className="flex gap-4">
                            {/* Line Number / Prompt */}
                            <div className="w-10 pt-5 text-right font-mono text-[11px] font-black text-slate-200 select-none">
                                {index + 1}
                            </div>

                            <div className="flex-1">
                                <div
                                    className={`relative bg-white border-2 rounded-2xl transition-all shadow-sm overflow-hidden ${cell.isExecuting ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-100 group-hover:border-slate-200 focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand-lighter)]'}`}
                                >
                                    {/* EXECUTE BUTTON - Top Right Floating */}
                                    <button
                                        onClick={() => runCell(cell.id)}
                                        disabled={!isWorkerReady || cell.isExecuting}
                                        className={`absolute top-4 right-4 z-[90] p-3 rounded-2xl transition-all shadow-md active:scale-95 ${cell.isExecuting ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 hover:bg-[var(--brand)] hover:text-white'}`}
                                        title="Run (Ctrl+Enter)"
                                    >
                                        {cell.isExecuting ? (
                                            <div className="w-5 h-5 border-[3px] border-amber-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Play size={20} fill="currentColor" />
                                        )}
                                    </button>

                                    {/* CODE EDITOR WRAPPER */}
                                    <div className="p-1">
                                        <CellEditorWrapper
                                            initialCode={cell.code}
                                            onChange={(val) => updateCellCode(cell.id, val)}
                                            onRun={() => runCell(cell.id)}
                                            isExecuting={cell.isExecuting}
                                        />
                                    </div>

                                    {/* CELL ACTIONS - Floating Bottom Center */}
                                    <div className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-[100] pb-3 translate-y-2 group-hover:translate-y-0">
                                        <button
                                            onClick={() => addCell(index)}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-full shadow-xl text-slate-500 hover:text-[var(--brand)] hover:border-[var(--brand)] transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Plus size={14} /> Code
                                        </button>
                                        <button
                                            onClick={() => deleteCell(cell.id)}
                                            className="p-2.5 bg-white border border-slate-200 rounded-full shadow-xl text-slate-400 hover:text-rose-500 hover:border-rose-500 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* OUTPUT AREA */}
                                {cell.outputs.length > 0 && (
                                    <div className="mt-4 p-8 bg-[#1e1e1e] rounded-2xl border border-slate-800 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                                        {cell.outputs.map((out) => (
                                            <div key={out.id} className="font-mono text-[14px] leading-relaxed">
                                                {out.type === 'stdout' && (
                                                    <div className="whitespace-pre-wrap text-emerald-400/90 tracking-tight">
                                                        {out.content}
                                                    </div>
                                                )}
                                                {out.type === 'stderr' && (
                                                    <div className="whitespace-pre-wrap text-rose-400 bg-rose-500/10 p-5 rounded-2xl border border-rose-500/20 shadow-inner">
                                                        {out.content}
                                                    </div>
                                                )}
                                                {out.type === 'image' && (
                                                    <div className="bg-white p-4 rounded-2xl shadow-lg inline-block my-4">
                                                        <img
                                                            src={`data:image/png;base64,${out.content}`}
                                                            className="max-w-full h-auto rounded-lg"
                                                            alt="Matplotlib output"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Add Center Button */}
            <div className="flex justify-center pt-20">
                <button
                    onClick={() => addCell(cells.length - 1)}
                    className="group relative px-10 py-5 bg-white border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-black uppercase tracking-widest text-[11px] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all flex items-center gap-4 overflow-hidden shadow-sm active:scale-95"
                >
                    <Plus size={22} className="transition-transform group-hover:rotate-90" />
                    <span>Append New Cell</span>
                    <div className="absolute inset-0 bg-[var(--brand-light)] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 -z-10" />
                </button>
            </div>
        </div>
    );
}

function CellEditorWrapper({
    initialCode,
    onChange,
    onRun,
    isExecuting,
}: {
    initialCode: string;
    onChange: (v: string) => void;
    onRun: () => void;
    isExecuting: boolean;
}) {
    const config = React.useMemo(
        () => ({
            ...NotebookConfig,
            initialBody: initialCode,
        }),
        [initialCode],
    );

    return (
        <CodeEditor
            language={config}
            actions={{ onChange, onRun }}
            hideLanguageSelector={true}
            hideTopBar={true}
            hideRunBar={true}
            className="border-none min-h-[100px]"
            isExecuting={isExecuting}
        />
    );
}
