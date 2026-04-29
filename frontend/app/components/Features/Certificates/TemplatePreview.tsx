'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export type PresetKey = 'classic' | 'modern' | 'minimal' | 'dark';
export type QrPosition = 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface CertificateDesignerState {
    name: string;
    certificateTitle: string;
    subtitle: string;
    preset: PresetKey;
    qrPosition: QrPosition;
    backgroundUrl?: string;
    signatureUrl?: string;
}

const PRESET_STYLES: Record<PresetKey, { border: string; bg: string; title: string; accent: string; muted: string }> = {
    classic: {
        border: 'border-amber-600',
        bg: 'bg-white',
        title: 'text-slate-900',
        accent: 'text-[var(--brand)]',
        muted: 'text-slate-500',
    },
    modern: {
        border: 'border-sky-600',
        bg: 'bg-sky-50',
        title: 'text-sky-900',
        accent: 'text-sky-700',
        muted: 'text-sky-600',
    },
    minimal: {
        border: 'border-slate-300',
        bg: 'bg-white',
        title: 'text-slate-900',
        accent: 'text-slate-700',
        muted: 'text-slate-500',
    },
    dark: {
        border: 'border-slate-800',
        bg: 'bg-slate-900',
        title: 'text-white',
        accent: 'text-orange-300',
        muted: 'text-slate-300',
    },
};

const qrPositionClass: Record<QrPosition, string> = {
    'bottom-right': 'right-6 bottom-6',
    'bottom-left': 'left-6 bottom-6',
    'bottom-center': 'left-1/2 -translate-x-1/2 bottom-6',
};

export default function TemplatePreview({
    value,
    orgName = 'Mentrily Academy',
}: {
    value: CertificateDesignerState;
    orgName?: string;
}) {
    const preset = PRESET_STYLES[value.preset];

    return (
        <div
            className={`w-full max-w-[860px] aspect-[1.41] rounded-2xl border-4 ${preset.border} overflow-hidden shadow-2xl relative ${preset.bg}`}
            style={
                value.backgroundUrl
                    ? {
                          backgroundImage: `url(${value.backgroundUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                      }
                    : undefined
            }
        >
            <div className="absolute inset-0 bg-white/75" />
            {value.preset === 'dark' && <div className="absolute inset-0 bg-slate-950/45" />}

            <div className="relative h-full px-12 py-10 flex flex-col items-center justify-center text-center">
                <p className={`text-sm font-bold tracking-wide ${preset.muted}`}>{orgName}</p>
                <h2 className={`mt-4 text-3xl font-black ${preset.title}`}>{value.certificateTitle || 'Certificate of Achievement'}</h2>
                <p className={`mt-2 text-sm font-semibold ${preset.muted}`}>{value.subtitle || 'This certifies that'}</p>
                <p className={`mt-4 text-4xl font-black ${preset.accent}`}>{'{{ Student Name }}'}</p>
                <p className={`mt-3 text-sm font-medium ${preset.muted}`}>has successfully completed</p>
                <p className={`mt-2 text-2xl font-bold ${preset.title}`}>{'{{ Course / Exam Title }}'}</p>
                <p className={`mt-4 text-xs font-semibold ${preset.muted}`}>{'Completion: {{ Percentage }}% · Issued {{ Date }}'}</p>
            </div>

            <div className={`absolute ${qrPositionClass[value.qrPosition]} rounded-md bg-white/90 p-2 border border-slate-200`}>
                <QRCodeSVG value="https://mentrily.example/certificate/verify/preview" size={58} level="M" />
            </div>

            <div className="absolute left-10 bottom-8">
                {value.signatureUrl ? (
                    <img src={value.signatureUrl} alt="Signature" className="h-12 w-auto object-contain" />
                ) : (
                    <p className={`text-xs italic font-semibold ${preset.muted}`}>Teacher Signature</p>
                )}
            </div>
        </div>
    );
}
