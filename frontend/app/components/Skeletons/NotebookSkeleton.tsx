import type React from 'react';
import SkeletonRoot from './SkeletonRoot';

// Editor-sized placeholder for one notebook cell while CodeMirror loads (matches min-h-[100px]).
export function NotebookCellSkeleton() {
    return (
        <div className="min-h-[100px] space-y-2.5 px-4 py-4">
            <div className="h-3.5 w-48 rounded bg-slate-100 animate-pulse motion-reduce:animate-none" />
            <div className="h-3.5 w-64 rounded bg-slate-50 animate-pulse motion-reduce:animate-none" />
            <div className="h-3.5 w-36 rounded bg-slate-50 animate-pulse motion-reduce:animate-none" />
        </div>
    );
}

// Lab card used by /playground/pynb and /playground/web: h-14 title header, body fills the rest.
export function LabCardSkeleton({ children }: { children: React.ReactNode }) {
    return (
        <SkeletonRoot className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white font-sans shadow-sm">
            <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-5">
                <div className="h-8 w-8 rounded-lg bg-slate-200 animate-pulse" />
                <div className="space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-slate-200 animate-pulse" />
                    <div className="h-2.5 w-48 rounded bg-slate-100 animate-pulse" />
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </SkeletonRoot>
    );
}

// Notebook Lab route fallback: kernel status chip, then 3 cells.
export default function NotebookSkeleton() {
    return (
        <LabCardSkeleton>
            <div className="h-full overflow-hidden bg-slate-50 px-4 py-5 md:px-6 md:py-6">
                <div className="mb-5 flex justify-end">
                    <div className="h-7 w-36 rounded-xl bg-slate-200/70 animate-pulse" />
                </div>
                <div className="space-y-7">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="relative rounded-2xl border-2 border-slate-100 bg-white p-1 shadow-sm">
                            <div className="absolute right-4 top-4 h-11 w-11 rounded-2xl bg-slate-100 animate-pulse" />
                            <NotebookCellSkeleton />
                        </div>
                    ))}
                </div>
            </div>
        </LabCardSkeleton>
    );
}
