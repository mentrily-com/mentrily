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
                className="border-2 border-dashed border-gray-100 rounded-lg bg-gray-50 p-12 flex flex-col items-center text-center cursor-pointer hover:border-[var(--brand-light)] hover:bg-gray-100 transition-all group"
            >
                <div className="w-16 h-16 rounded-lg bg-white shadow-sm border border-gray-50 flex items-center justify-center text-gray-300 group-hover:text-[var(--brand)] transition-all mb-4">
                    <Upload size={32} />
                </div>
                <p className="text-base font-semibold text-gray-800 mb-1">Upload Clerk Invite CSV</p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                    Email and role are required
                </p>
                <input type="file" ref={fileInputRef} onChange={onFileUpload} accept=".csv" className="hidden" />
            </div>

            <div className="p-6 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-gray-600">
                    <FileText size={20} />
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest leading-none mb-1">
                            CSV Template
                        </p>
                        <p className="text-xs font-medium text-gray-400 italic">Email, Role, Name, Department, ID</p>
                    </div>
                </div>
                <button
                    onClick={onDownloadSample}
                    className="px-6 py-3 bg-white border border-gray-200 text-gray-600 text-[10px] font-semibold uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                    <Download size={14} />
                    Get Sample
                </button>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 text-rose-600 rounded-lg flex items-center gap-3">
                    <AlertCircle size={18} />
                    <p className="text-xs font-medium">{error}</p>
                </div>
            )}
        </div>
    );
}
