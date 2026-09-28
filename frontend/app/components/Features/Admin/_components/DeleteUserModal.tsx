'use client';
import { AlertTriangle, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';

interface DeleteUserModalProps {
    user: any | null;
    onClose: () => void;
    onConfirm: (id: string) => void;
}

export default function DeleteUserModal({ user, onClose, onConfirm }: DeleteUserModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const isValid = confirmText === 'DELETE';
    const panelRef = useRef<HTMLDivElement>(null);
    useModalA11y(panelRef, Boolean(user), onClose);

    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-user-title"
                tabIndex={-1}
                className="relative bg-white w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg sm:rounded-lg shadow-lg animate-in zoom-in-95 duration-300 border border-gray-100 focus:outline-none"
            >
                <div className="p-5 sm:p-8 pb-0 flex justify-between items-start">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                        <AlertTriangle size={28} />
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="p-2 text-gray-300 hover:text-gray-900 transition-colors"
                    >
                        <X size={22} />
                    </button>
                </div>
                <div className="p-5 sm:p-8 pt-4 sm:pt-6">
                    <h2
                        id="delete-user-title"
                        className="text-2xl font-semibold text-gray-900 tracking-tight leading-none mb-3"
                    >
                        Remove from organization
                    </h2>
                    <p className="text-sm font-medium text-gray-400 mb-8">
                        You are about to remove <span className="text-gray-900">{user.name}</span> from this
                        organization&apos;s workspace. If this is their only organization, their account is deleted
                        entirely; if they belong to another organization, their account there is untouched.
                    </p>
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5 block">
                                Type &quot;DELETE&quot; to confirm
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={confirmText}
                                onChange={(event) => setConfirmText(event.target.value)}
                                placeholder="DELETE"
                                className="w-full bg-transparent text-sm font-semibold text-rose-600 outline-none placeholder:text-gray-200"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-4 bg-gray-50 text-gray-400 text-xs font-semibold uppercase tracking-widest rounded-lg hover:bg-gray-100 transition-all border border-transparent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onConfirm(user.id)}
                                disabled={!isValid}
                                className={`flex-1 py-4 text-xs font-semibold uppercase tracking-widest rounded-lg transition-all shadow-md ${isValid ? 'bg-rose-600 text-white hover:scale-[1.02] active:scale-95' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
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
