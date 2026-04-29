'use client';

import React, { useMemo, useState } from 'react';
import SignaturePad from './SignaturePad';
import TemplatePreview, { type CertificateDesignerState, type PresetKey } from './TemplatePreview';

const PRESETS: Array<{ key: PresetKey; label: string; description: string }> = [
    { key: 'classic', label: 'Classic', description: 'Elegant default frame' },
    { key: 'modern', label: 'Modern', description: 'Fresh blue highlight' },
    { key: 'minimal', label: 'Minimal', description: 'Clean understated style' },
    { key: 'dark', label: 'Dark', description: 'Dark premium background' },
];

export type CertificateDesignerPayload = {
    name: string;
    backgroundUrl?: string;
    signatureDataUrl?: string;
    layout: {
        preset: PresetKey;
        title: { text: string };
        subtitle: { text: string };
        qrCode: { x: number; y: number; width: number; height: number };
    };
};

export default function CertificateDesigner({
    initialValue,
    onSave,
    onCancel,
    saving,
}: {
    initialValue?: Partial<CertificateDesignerState>;
    onSave: (value: CertificateDesignerPayload) => Promise<void>;
    onCancel: () => void;
    saving?: boolean;
}) {
    const [value, setValue] = useState<CertificateDesignerState>({
        name: initialValue?.name || '',
        certificateTitle: initialValue?.certificateTitle || 'Certificate of Achievement',
        subtitle: initialValue?.subtitle || 'This certifies that',
        preset: initialValue?.preset || 'classic',
        qrPosition: initialValue?.qrPosition || 'bottom-right',
        backgroundUrl: initialValue?.backgroundUrl,
        signatureUrl: initialValue?.signatureUrl,
    });
    const [backgroundPreview, setBackgroundPreview] = useState<string | undefined>(initialValue?.backgroundUrl);
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(initialValue?.signatureUrl);
    const qrCoords = useMemo(() => {
        if (value.qrPosition === 'bottom-left') return { x: 54, y: 455, width: 90, height: 90 };
        if (value.qrPosition === 'bottom-center') return { x: 252, y: 455, width: 90, height: 90 };
        return { x: 454, y: 455, width: 90, height: 90 };
    }, [value.qrPosition]);

    const canSave = value.name.trim().length > 0;

    const handleBackgroundUpload: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                setBackgroundPreview(result);
                setValue((prev) => ({ ...prev, backgroundUrl: result }));
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
            <aside className="w-[340px] bg-white border-r border-slate-200 p-5 overflow-y-auto">
                <h1 className="text-base font-black text-slate-900 mb-6">Template Designer</h1>

                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Choose Template</p>
                    <div className="grid grid-cols-2 gap-2">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                type="button"
                                onClick={() => setValue((prev) => ({ ...prev, preset: preset.key }))}
                                className={`rounded-xl border-2 p-2 text-left ${value.preset === preset.key ? 'border-[var(--brand)] bg-orange-50' : 'border-slate-200 bg-white'}`}
                            >
                                <p className="text-xs font-black text-slate-800">{preset.label}</p>
                                <p className="text-[10px] font-semibold text-slate-500 mt-1">{preset.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Template Info</p>
                    <div className="space-y-3">
                        <label className="block">
                            <span className="block text-xs font-bold text-slate-700 mb-1">Template Name</span>
                            <input
                                value={value.name}
                                onChange={(e) => setValue((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                                placeholder="Gold Achievement"
                            />
                        </label>
                        <label className="block">
                            <span className="block text-xs font-bold text-slate-700 mb-1">Certificate Title</span>
                            <input
                                value={value.certificateTitle}
                                onChange={(e) => setValue((prev) => ({ ...prev, certificateTitle: e.target.value }))}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                            />
                        </label>
                        <label className="block">
                            <span className="block text-xs font-bold text-slate-700 mb-1">Subtitle</span>
                            <input
                                value={value.subtitle}
                                onChange={(e) => setValue((prev) => ({ ...prev, subtitle: e.target.value }))}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                            />
                        </label>
                    </div>
                </div>

                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Background</p>
                    <label className="w-full h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-500 cursor-pointer">
                        Upload Background Image
                        <input type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
                    </label>
                    <input
                        value={value.backgroundUrl || ''}
                        onChange={(e) => setValue((prev) => ({ ...prev, backgroundUrl: e.target.value }))}
                        className="w-full mt-2 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                        placeholder="Or paste background URL"
                    />
                </div>

                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Signature</p>
                    <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} />
                </div>

                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">QR Code Position</p>
                    <select
                        value={value.qrPosition}
                        onChange={(e) => setValue((prev) => ({ ...prev, qrPosition: e.target.value as any }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-center">Bottom Center</option>
                    </select>
                </div>
            </aside>

            <section className="flex-1 p-10">
                <div className="flex justify-end gap-2 mb-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-wider"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!canSave || !!saving}
                        onClick={async () => {
                            await onSave({
                                name: value.name.trim(),
                                backgroundUrl: value.backgroundUrl?.trim() || undefined,
                                signatureDataUrl,
                                layout: {
                                    preset: value.preset,
                                    title: { text: value.certificateTitle.trim() || 'Certificate of Achievement' },
                                    subtitle: { text: value.subtitle.trim() || 'This certifies that' },
                                    qrCode: qrCoords,
                                },
                            });
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white font-black text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Template'}
                    </button>
                </div>

                <div className="w-full h-full flex items-center justify-center">
                    <TemplatePreview
                        value={{
                            ...value,
                            backgroundUrl: value.backgroundUrl || backgroundPreview,
                            signatureUrl: signatureDataUrl,
                        }}
                    />
                </div>
            </section>
        </div>
    );
}
