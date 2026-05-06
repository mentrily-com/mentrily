'use client';
import React from 'react';
import { CheckCircle2, AlertCircle, Mail, UserCheck, AlertTriangle } from 'lucide-react';
import AppModal from './AppModal';

interface BulkImportReportProps {
    isOpen: boolean;
    onClose: () => void;
    report: {
        summary: {
            totalProcessed: number;
            created: number;
            invited?: number;
            alreadyInvited?: number;
            failed: number;
            emailsSent?: number;
            emailsFailed?: number;
        };
        details: any[];
    } | null;
}

export default function BulkImportReportModal({ isOpen, onClose, report }: BulkImportReportProps) {
    if (!isOpen || !report) return null;

    const { summary, details } = report;
    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title="Import Report"
            subtitle={`Processed ${summary.totalProcessed} invite rows from CSV`}
            size="md"
            bodyClassName="space-y-5"
            footer={
                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 sm:w-auto"
                    >
                        Close Report
                    </button>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="bg-emerald-50 rounded-2xl p-4 flex items-center gap-4 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <UserCheck size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-emerald-700">{summary.invited ?? summary.created}</div>
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-600/70">Invited</div>
                    </div>
                </div>

                {summary.emailsSent !== undefined && (
                    <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-4 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Mail size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-blue-700">{summary.emailsSent}</div>
                            <div className="text-xs font-bold uppercase tracking-wider text-blue-600/70">
                                Emails Sent
                            </div>
                        </div>
                    </div>
                )}

                {(summary.failed > 0 || (summary.emailsFailed || 0) > 0) && (
                    <div className="bg-rose-50 rounded-2xl p-4 flex items-center gap-4 sm:col-span-2 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.12)]">
                        <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                            <AlertTriangle size={24} />
                        </div>
                        <div className="flex flex-wrap gap-5 sm:gap-8">
                            {summary.failed > 0 && (
                                <div>
                                    <div className="text-2xl font-black text-rose-700">{summary.failed}</div>
                                    <div className="text-xs font-bold uppercase tracking-wider text-rose-600/70">
                                        Failed
                                    </div>
                                </div>
                            )}
                            {(summary.emailsFailed || 0) > 0 && (
                                <div>
                                    <div className="text-2xl font-black text-rose-700">{summary.emailsFailed}</div>
                                    <div className="text-xs font-bold uppercase tracking-wider text-rose-600/70">
                                        Failed Emails
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div>
                <h3 className="sticky top-0 z-10 mb-4 bg-[#f4f6f9] py-3 text-xs font-black uppercase tracking-widest text-slate-400">
                    Detailed Log
                </h3>
                <div className="space-y-3">
                    {details.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 text-sm"
                        >
                            {item.success ? (
                                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                            ) : (
                                <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-700 truncate">
                                    {item.user?.email || item.email}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {item.success ? (
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span>
                                                {item.alreadyInvited
                                                    ? 'Invite already existed.'
                                                    : 'Clerk invite queued.'}
                                            </span>
                                            {item.invited || item.emailSent ? (
                                                <span className="text-blue-600 flex items-center gap-1">
                                                    <Mail size={12} /> Clerk email sent
                                                </span>
                                            ) : (
                                                <span className="text-slate-500 flex items-center gap-1">
                                                    <Mail size={12} /> Existing invite
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-rose-500">{item.error}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AppModal>
    );
}
