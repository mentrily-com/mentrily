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
        <div className="rounded-lg border border-gray-200 p-3 bg-white">
            <div className="flex items-center gap-2 mb-3">
                <button
                    type="button"
                    onClick={() => setMode('draw')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${mode === 'draw' ? 'bg-[var(--brand)] text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                    Draw
                </button>
                <button
                    type="button"
                    onClick={() => setMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${mode === 'upload' ? 'bg-[var(--brand)] text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                    Upload
                </button>
            </div>

            {mode === 'draw' ? (
                <div className="space-y-2">
                    <div className="w-full h-[140px] border-2 border-dashed border-gray-200 rounded-lg overflow-hidden bg-gray-50">
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
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={handleDrawEnd}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700"
                        >
                            Use Drawn
                        </button>
                    </div>
                </div>
            ) : (
                <label className="w-full h-[140px] border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-500 cursor-pointer">
                    Upload Signature Image
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
            )}

            {value && (
                <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-2">
                    <img src={value} alt="Signature preview" className="h-12 w-auto object-contain" />
                </div>
            )}
        </div>
    );
}
