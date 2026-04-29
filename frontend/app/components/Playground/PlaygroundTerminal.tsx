'use client';
import React, { useState } from 'react';

interface PlaygroundTerminalProps {
    output: string[];
    onClear: () => void;
    customInput: string;
    onCustomInputChange: (val: string) => void;
}

export default function PlaygroundTerminal({
    output,
    onClear,
    customInput,
    onCustomInputChange,
}: PlaygroundTerminalProps) {
    const [showCustomInput, setShowCustomInput] = useState(false);

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-slate-300 font-mono text-sm overflow-hidden">
            {/* Terminal Content or Custom Input */}
            <div className={`flex-1 overflow-y-auto no-scrollbar relative flex flex-col`}>
                {showCustomInput ? (
                    <div className="p-6 h-full flex flex-col gap-4 animate-in slide-in-from-right duration-300 bg-[#0d1117]">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                Provide Standard Input (stdin)
                            </span>
                            <button
                                onClick={() => setShowCustomInput(false)}
                                className="text-[10px] text-orange-500 font-bold hover:underline"
                            >
                                Back to Terminal
                            </button>
                        </div>
                        <textarea
                            value={customInput}
                            onChange={(e) => onCustomInputChange(e.target.value)}
                            placeholder="Type your test input here..."
                            className="flex-1 bg-[#161b22] border border-slate-800 rounded-xl p-4 text-[13px] text-slate-300 outline-none focus:border-orange-500/50 transition-colors resize-none custom-scrollbar"
                        />
                    </div>
                ) : (
                    <div className="p-6">
                        {output.length === 0 ? (
                            <div className="text-slate-600 italic">
                                No output yet. Press Execute to run your code...
                            </div>
                        ) : (
                            output.map((line, i) => (
                                <div key={i} className="mb-1 leading-relaxed">
                                    <span className="text-emerald-500 mr-2 opacity-50">$</span>
                                    {line}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Terminal Actions Bar */}
            <div className="h-14 bg-[#161b22] border-t border-slate-800/50 px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className={`px-4 py-1.5 rounded text-[11px] font-bold transition-all ${
                            showCustomInput
                                ? 'bg-orange-500 text-white'
                                : 'bg-[#21262d] border border-[#30363d] text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {showCustomInput ? 'Hide Input' : 'Custom Input'}
                    </button>
                </div>
            </div>
        </div>
    );
}
