'use client';
import React from 'react';
import AppModal from './AppModal';

interface AlertModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'warning' | 'info';
}

export default function AlertModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    type = 'info',
}: AlertModalProps) {
    if (!isOpen) return null;

    const colors = {
        danger: {
            bg: 'bg-red-50',
            icon: '#ef4444',
            button: 'bg-red-500 hover:bg-red-600',
        },
        warning: {
            bg: 'bg-amber-50',
            icon: '#f59e0b',
            button: 'bg-amber-500 hover:bg-amber-600',
        },
        info: {
            bg: 'bg-blue-50',
            icon: '#3b82f6',
            button: 'bg-blue-500 hover:bg-blue-600',
        },
    };

    const config = colors[type];

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onCancel}
            size="sm"
            zIndexClass="z-[9999]"
            showCloseButton={false}
            bodyClassName="p-5 sm:p-8"
            ariaLabel={title}
        >
            <div
                className={`w-12 h-12 rounded-lg ${config.bg} flex items-center justify-center mb-5 sm:w-14 sm:h-14 sm:mb-6`}
            >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={config.icon} strokeWidth="3">
                    {type === 'danger' ? (
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    ) : (
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
                    )}
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2 tracking-tight sm:text-xl">{title}</h3>
            <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">{message}</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-3.5 bg-gray-50 rounded-lg text-xs font-semibold uppercase tracking-widest text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                >
                    {cancelLabel}
                </button>
                <button
                    onClick={onConfirm}
                    className={`flex-1 px-4 py-3.5 text-white rounded-lg text-xs font-semibold uppercase tracking-widest transition-all shadow-lg active:scale-95 ${config.button}`}
                >
                    {confirmLabel}
                </button>
            </div>
        </AppModal>
    );
}
