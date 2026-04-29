'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TeacherService } from '@/services/api/TeacherService';
import AlertModal from '@/app/components/Common/AlertModal';

interface ExamInviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    exam: {
        id: string;
        title: string;
        slug?: string;
        testCode?: string;
        duration?: number;
        startTime?: string;
        endTime?: string;
    } | null;
}

export default function ExamInviteModal({ isOpen, onClose, exam }: ExamInviteModalProps) {
    const [groups, setGroups] = useState<any[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [customMessage, setCustomMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [queuedCount, setQueuedCount] = useState<number | null>(null);
    const [error, setError] = useState<string>('');
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        let alive = true;
        setLoading(true);
        setError('');
        setQueuedCount(null);

        TeacherService.getGroups()
            .then((data) => {
                if (!alive) return;
                setGroups(Array.isArray(data) ? data : []);
            })
            .catch((e) => {
                if (!alive) return;
                setError(e?.message || 'Failed to load groups');
            })
            .finally(() => {
                if (alive) setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [isOpen]);

    const selectedCount = selectedGroupIds.length;

    const estimatedRecipients = useMemo(() => {
        if (!selectedGroupIds.length) return 0;
        const uniqueEmails = new Set<string>();
        for (const group of groups) {
            if (!selectedGroupIds.includes(group.id)) continue;
            for (const student of group.students || []) {
                if (student?.email) uniqueEmails.add(String(student.email).toLowerCase());
            }
        }
        return uniqueEmails.size;
    }, [groups, selectedGroupIds]);

    const toggleGroup = (groupId: string) => {
        setSelectedGroupIds((prev) =>
            prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
        );
    };

    const handleSubmit = async () => {
        if (!exam) return;
        setSending(true);
        setError('');
        try {
            const response = await TeacherService.sendExamInvites(exam.id, {
                groupIds: selectedGroupIds,
                customMessage: customMessage.trim() || undefined,
            });
            setQueuedCount(Number(response?.queued || 0));
        } catch (e: any) {
            setError(e?.message || 'Failed to queue invites');
        } finally {
            setSending(false);
            setConfirmOpen(false);
        }
    };

    if (!isOpen || !exam) return null;

    return (
        <>
            <div className="fixed inset-0 z-[2100] flex items-center justify-center p-2 sm:p-4">
                <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
                <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] bg-white border border-slate-100 shadow-2xl sm:rounded-[32px]">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 sm:px-8 sm:py-6 sm:items-center">
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight sm:text-xl">
                                Send Exam Invites
                            </h3>
                            <p className="truncate text-xs font-bold text-slate-400 mt-1">{exam.title}</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-2 md:gap-6 sm:p-8">
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    Select Groups
                                </p>
                                {loading ? (
                                    <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-400">
                                        Loading groups...
                                    </div>
                                ) : groups.length === 0 ? (
                                    <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-400">
                                        No groups available.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {groups.map((group) => {
                                            const isSelected = selectedGroupIds.includes(group.id);
                                            return (
                                                <button
                                                    key={group.id}
                                                    type="button"
                                                    onClick={() => toggleGroup(group.id)}
                                                    className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'border-[var(--brand)] bg-[var(--brand-light)]/40' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-black text-slate-800">
                                                                {group.name}
                                                            </p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                {group?._count?.students ||
                                                                    group?.students?.length ||
                                                                    0}{' '}
                                                                students
                                                            </p>
                                                        </div>
                                                        <div
                                                            className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-[var(--brand)] border-[var(--brand)] text-white' : 'border-slate-300'}`}
                                                        >
                                                            {isSelected ? '✓' : ''}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    Custom Message (Optional)
                                </p>
                                <textarea
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    rows={5}
                                    maxLength={2000}
                                    className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-sm font-medium text-slate-700 outline-none focus:border-[var(--brand)]"
                                    placeholder="Add a short note for students..."
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Email Preview
                            </p>
                            <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50 space-y-2">
                                <p className="text-sm font-black text-slate-800">{exam.title}</p>
                                <p className="text-xs font-bold text-slate-500">
                                    Duration: {exam.duration || 'N/A'} mins
                                </p>
                                <p className="text-xs font-bold text-slate-500">Test Code: {exam.testCode || 'N/A'}</p>
                                <p className="text-xs font-bold text-slate-500">
                                    Start:{' '}
                                    {exam.startTime ? new Date(exam.startTime).toLocaleString() : 'Not scheduled'}
                                </p>
                                <p className="text-xs font-bold text-slate-500">
                                    End: {exam.endTime ? new Date(exam.endTime).toLocaleString() : 'Not scheduled'}
                                </p>
                                {customMessage.trim() && (
                                    <div className="mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">
                                            Custom Message
                                        </p>
                                        <p className="text-xs font-medium text-amber-800 whitespace-pre-wrap">
                                            {customMessage}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-slate-100 p-4 bg-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Summary
                                </p>
                                <p className="text-sm font-bold text-slate-700 mt-2">{selectedCount} groups selected</p>
                                <p className="text-xs font-bold text-slate-500">
                                    Estimated unique recipients: {estimatedRecipients}
                                </p>
                                {queuedCount !== null && (
                                    <p className="text-sm font-black text-emerald-600 mt-3">
                                        Success! {queuedCount} invite emails queued.
                                    </p>
                                )}
                                {error && <p className="text-xs font-bold text-rose-500 mt-3">{error}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-3 sm:px-8 sm:py-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-bold text-slate-400">Invites are queued and sent asynchronously.</p>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-widest"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => setConfirmOpen(true)}
                                disabled={sending || selectedGroupIds.length === 0}
                                className="px-5 py-2.5 rounded-xl bg-[var(--brand)] text-white text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? 'Queueing...' : 'Send Invites'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <AlertModal
                isOpen={confirmOpen}
                title="Confirm Invite Send"
                message={`Queue exam invite emails for ${estimatedRecipients} students across ${selectedCount} groups?`}
                type="warning"
                confirmLabel="Queue Invites"
                cancelLabel="Cancel"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={handleSubmit}
            />
        </>
    );
}
