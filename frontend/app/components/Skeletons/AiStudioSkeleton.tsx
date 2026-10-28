import SkeletonRoot from './SkeletonRoot';

// Mirrors AiStudio: full-height card, md:w-64 conversation list, thread header + messages + composer.
export default function AiStudioSkeleton() {
    return (
        <SkeletonRoot className="relative flex h-[calc(100vh-var(--topbar-height)-36px)] min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="hidden w-64 shrink-0 space-y-2 border-r border-slate-200 bg-slate-50 p-3 md:block">
                <div className="mb-4 h-9 w-full rounded-lg bg-slate-200 animate-pulse" />
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-8 w-full rounded-lg bg-slate-100 animate-pulse" />
                ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                    <div className="h-6 w-24 rounded-md bg-slate-200 animate-pulse" />
                    <div className="ml-auto h-7 w-24 rounded-lg bg-slate-100 animate-pulse" />
                </div>
                <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-6 py-8">
                    {[60, 85, 45].map((w, i) => (
                        <div
                            key={i}
                            className={`h-10 rounded-2xl bg-slate-100 animate-pulse ${i % 2 === 0 ? 'ml-auto' : ''}`}
                            style={{ width: `${w}%` }}
                        />
                    ))}
                </div>
                <div className="mx-auto w-full max-w-3xl px-6 pb-6">
                    <div className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 animate-pulse" />
                </div>
            </div>
        </SkeletonRoot>
    );
}
