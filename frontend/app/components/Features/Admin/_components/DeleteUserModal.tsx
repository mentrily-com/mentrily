'use client';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface DeleteUserModalProps {
    user: any | null;
    onClose: () => void;
    onConfirm: (id: string) => void;
}

export default function DeleteUserModal({ user, onClose, onConfirm }: DeleteUserModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const isValid = confirmText === 'DELETE';
    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
                <div className="p-8 pb-0 flex justify-between items-start">
                    <div className="w-16 h-16 rounded-[24px] bg-rose-50 flex items-center justify-center text-rose-500">
                        <AlertTriangle size={32} />
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-8 pt-6">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-3">
                        Permanent Deletion
                    </h2>
                    <p className="text-sm font-bold text-slate-400 mb-8">
                        You are about to remove <span className="text-slate-900">{user.name}</span>. This action is
                        irreversible and all associated data will be lost.
                    </p>
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-[24px] border border-slate-100">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                                Type &quot;DELETE&quot; to confirm
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={confirmText}
                                onChange={(event) => setConfirmText(event.target.value)}
                                placeholder="DELETE"
                                className="w-full bg-transparent text-sm font-black text-rose-600 outline-none placeholder:text-slate-200"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-4 bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all border border-transparent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onConfirm(user.id)}
                                disabled={!isValid}
                                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-rose-100 ${isValid ? 'bg-rose-600 text-white hover:scale-[1.02] active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
