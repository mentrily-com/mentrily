'use client';

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

type SignatureMode = 'draw' | 'upload';

export default function SignaturePad({ value, onChange }: { value?: string; onChange: (dataUrl?: string) => void }) {
    const sigRef = useRef<SignatureCanvas | null>(null);
    const [mode, setMode] = useState<SignatureMode>('draw');

    const handleDrawEnd = () => {
        const instance = sigRef.current;
        if (!instance || instance.isEmpty()) return;
        onChange(instance.getTrimmedCanvas().toDataURL('image/png'));
    };

    const handleUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                onChange(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="rounded-2xl border border-slate-200 p-3 bg-white">
            <div className="flex items-center gap-2 mb-3">
                <button
                    type="button"
                    onClick={() => setMode('draw')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider ${mode === 'draw' ? 'bg-[var(--brand)] text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                    Draw
                </button>
                <button
                    type="button"
                    onClick={() => setMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider ${mode === 'upload' ? 'bg-[var(--brand)] text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                    Upload
                </button>
            </div>

            {mode === 'draw' ? (
                <div className="space-y-2">
                    <div className="w-full h-[140px] border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        <SignatureCanvas
                            ref={sigRef}
                            penColor="#0f172a"
                            canvasProps={{ className: 'w-full h-full' }}
                            onEnd={handleDrawEnd}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                sigRef.current?.clear();
                                onChange(undefined);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-600"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={handleDrawEnd}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700"
                        >
                            Use Drawn
                        </button>
                    </div>
                </div>
            ) : (
                <label className="w-full h-[140px] border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-500 cursor-pointer">
                    Upload Signature Image
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
            )}

            {value && (
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <img src={value} alt="Signature preview" className="h-12 w-auto object-contain" />
                </div>
            )}
        </div>
    );
}
