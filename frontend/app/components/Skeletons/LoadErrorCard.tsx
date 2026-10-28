'use client';
import { AlertTriangle, RotateCw } from 'lucide-react';

// Inline failure state for pages whose first fetch failed, so they don't render zeros/empty data as if real.
export default function LoadErrorCard({
    title = "We couldn't load this page",
    message = 'Check your connection and try again.',
    onRetry,
}: {
    title?: string;
    message?: string;
    onRetry: () => void;
}) {
    return (
        <div className="mx-auto max-w-xl px-4 py-12">
            <div role="alert" className="rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                    <AlertTriangle size={22} />
                </div>
                <h2 className="text-lg font-black text-slate-900">{title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">{message}</p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800"
                >
                    <RotateCw size={14} />
                    Retry
                </button>
            </div>
        </div>
    );
}
