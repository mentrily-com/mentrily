import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';
import SkeletonRoot from './SkeletonRoot';

// /playground/q/[slug]: same shell + card height as the loaded page, question (38%) left, editor right.
export default function SharedQuestionSkeleton() {
    return (
        <PublicPlaygroundShell>
            <SkeletonRoot className="flex h-[calc(100vh-6rem)] min-h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="hidden w-[38%] shrink-0 space-y-4 border-r border-slate-100 p-6 md:block">
                    <div className="flex gap-2">
                        <div className="h-6 w-16 rounded-full bg-emerald-100 animate-pulse" />
                        <div className="h-6 w-20 rounded-full bg-blue-100 animate-pulse" />
                    </div>
                    <div className="h-8 w-3/4 rounded-xl bg-slate-200 animate-pulse" />
                    <div className="space-y-3 pt-2">
                        <div className="h-4 w-full rounded bg-slate-100 animate-pulse" />
                        <div className="h-4 w-full rounded bg-slate-100 animate-pulse" />
                        <div className="h-4 w-5/6 rounded bg-slate-100 animate-pulse" />
                        <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
                    </div>
                    <div className="h-28 w-full rounded-2xl border border-slate-100 bg-slate-50 animate-pulse" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
                    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-100 px-4">
                        <div className="h-8 w-24 rounded-md border border-slate-200 bg-white animate-pulse" />
                        <div className="ml-auto h-8 w-20 rounded-md bg-slate-200/60 animate-pulse" />
                    </div>
                    <div className="flex-1 space-y-3 p-6">
                        <div className="h-4 w-32 rounded bg-slate-200/50 animate-pulse" />
                        <div className="h-4 w-48 rounded bg-slate-200/50 animate-pulse" />
                        <div className="h-4 w-40 rounded bg-slate-200/50 animate-pulse" />
                        <div className="h-4 w-24 rounded bg-slate-200/50 animate-pulse" />
                    </div>
                    <div className="h-40 shrink-0 border-t border-slate-200 bg-white p-4">
                        <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
                    </div>
                </div>
            </SkeletonRoot>
        </PublicPlaygroundShell>
    );
}
