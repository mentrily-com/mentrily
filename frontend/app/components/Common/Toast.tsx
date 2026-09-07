'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    title?: string;
    undismissible?: boolean;
    position?: 'top-right' | 'top-center';
}

interface ToastContextType {
    toast: (
        message: string,
        type?: ToastType,
        title?: string,
        duration?: number,
        undismissible?: boolean,
        position?: 'top-right' | 'top-center',
    ) => string;
    success: (
        message: string,
        title?: string,
        duration?: number,
        undismissible?: boolean,
        position?: 'top-right' | 'top-center',
    ) => string;
    error: (
        message: string,
        title?: string,
        duration?: number,
        undismissible?: boolean,
        position?: 'top-right' | 'top-center',
    ) => string;
    info: (
        message: string,
        title?: string,
        duration?: number,
        undismissible?: boolean,
        position?: 'top-right' | 'top-center',
    ) => string;
    warning: (
        message: string,
        title?: string,
        duration?: number,
        undismissible?: boolean,
        position?: 'top-right' | 'top-center',
    ) => string;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback(
        (
            message: string,
            type: ToastType = 'info',
            title?: string,
            duration: number = 5000,
            undismissible: boolean = false,
            position: 'top-right' | 'top-center' = 'top-right',
        ) => {
            const id = Math.random().toString(36).substring(2, 9);
            setToasts((prev) => [...prev, { id, message, type, title, undismissible, position }]);

            // Auto remove after duration if duration > 0
            if (duration > 0) {
                setTimeout(() => {
                    removeToast(id);
                }, duration);
            }
            return id;
        },
        [removeToast],
    );

    const success = useCallback(
        (
            msg: string,
            title?: string,
            duration?: number,
            undismissible?: boolean,
            position?: 'top-right' | 'top-center',
        ) => showToast(msg, 'success', title, duration, undismissible, position),
        [showToast],
    );
    const error = useCallback(
        (
            msg: string,
            title?: string,
            duration?: number,
            undismissible?: boolean,
            position?: 'top-right' | 'top-center',
        ) => showToast(msg, 'error', title, duration, undismissible, position),
        [showToast],
    );
    const info = useCallback(
        (
            msg: string,
            title?: string,
            duration?: number,
            undismissible?: boolean,
            position?: 'top-right' | 'top-center',
        ) => showToast(msg, 'info', title, duration, undismissible, position),
        [showToast],
    );
    const warning = useCallback(
        (
            msg: string,
            title?: string,
            duration?: number,
            undismissible?: boolean,
            position?: 'top-right' | 'top-center',
        ) => showToast(msg, 'warning', title, duration, undismissible, position),
        [showToast],
    );

    const dismiss = useCallback(
        (id: string) => {
            removeToast(id);
        },
        [removeToast],
    );

    const value = React.useMemo(
        () => ({
            toast: showToast,
            success,
            error,
            info,
            warning,
            dismiss,
        }),
        [showToast, success, error, info, warning, dismiss],
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast Containers */}
            {/* Top Right */}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-80 pointer-events-none">
                {toasts
                    .filter((t) => !t.position || t.position === 'top-right')
                    .map((t) => (
                        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
                    ))}
            </div>

            {/* Top Center */}
            <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 w-96 pointer-events-none">
                {toasts
                    .filter((t) => t.position === 'top-center')
                    .map((t) => (
                        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
                    ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const icons = {
        success: <CheckCircle2 className="text-emerald-500" size={20} />,
        error: <AlertCircle className="text-rose-500" size={20} />,
        info: <Info className="text-[var(--brand)]" size={20} />,
        warning: <AlertTriangle className="text-amber-500" size={20} />,
    };

    const styles = {
        success: 'border-emerald-100 bg-emerald-50/50 shadow-emerald-500/5',
        error: 'border-rose-100 bg-rose-50/50 shadow-rose-500/5',
        info: 'border-[var(--brand-light)] bg-[var(--brand-light)] shadow-[var(--brand)]/5',
        warning: 'border-amber-100 bg-amber-50/50 shadow-amber-500/5',
    };

    // Errors interrupt (assertive) since they're often actionable and time
    // -sensitive; everything else waits for a pause in speech (polite) so a
    // string of success toasts doesn't talk over whatever the screen reader
    // user is already doing. Without this, toasts were entirely silent to
    // screen reader users -- the DOM node just appears, with nothing to
    // trigger an announcement.
    const isAssertive = toast.type === 'error';

    return (
        <div
            role={isAssertive ? 'alert' : 'status'}
            aria-live={isAssertive ? 'assertive' : 'polite'}
            aria-atomic="true"
            className={`pointer-events-auto flex items-start gap-4 p-4 rounded-2xl border bg-white/80 backdrop-blur-md shadow-xl animate-fade-in ${styles[toast.type]}`}
        >
            <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
                {toast.title && (
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800 mb-1">
                        {toast.title}
                    </h4>
                )}
                <p className="text-xs font-bold text-slate-600 leading-relaxed">{toast.message}</p>
            </div>
            {!toast.undismissible && (
                <button
                    onClick={onClose}
                    aria-label="Dismiss notification"
                    className="shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
