'use client';
import { AlertCircle, Download, FileText, Upload } from 'lucide-react';
import React from 'react';

interface BulkUserImportProps {
    error: string | null;
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDownloadSample: () => void;
}

export default function BulkUserImport({ error, onFileUpload, onDownloadSample }: BulkUserImportProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-8 animate-fade-in">
            <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-100 rounded-[32px] bg-slate-50 p-12 flex flex-col items-center text-center cursor-pointer hover:border-[var(--brand-light)] hover:bg-slate-100 transition-all group"
            >
                <div className="w-16 h-16 rounded-[24px] bg-white shadow-sm border border-slate-50 flex items-center justify-center text-slate-300 group-hover:text-[var(--brand)] transition-all mb-4">
                    <Upload size={32} />
                </div>
                <p className="text-base font-black text-slate-800 mb-1">Upload Clerk Invite CSV</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Email and role are required
                </p>
                <input type="file" ref={fileInputRef} onChange={onFileUpload} accept=".csv" className="hidden" />
            </div>

            <div className="p-6 bg-slate-50 rounded-[24px] border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-slate-600">
                    <FileText size={20} />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                            CSV Template
                        </p>
                        <p className="text-xs font-bold text-slate-400 italic">Email, Role, Name, Department, ID</p>
                    </div>
                </div>
                <button
                    onClick={onDownloadSample}
                    className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                    <Download size={14} />
                    Get Sample
                </button>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center gap-3">
                    <AlertCircle size={18} />
                    <p className="text-xs font-bold">{error}</p>
                </div>
            )}
        </div>
    );
}
