import SkeletonRoot from './SkeletonRoot';

// Mirrors CreateOrganizationView: header + CTA, then lg:grid-cols-3 (2-col section cards + sticky side card).
export default function CreateOrganizationSkeleton() {
    return (
        <SkeletonRoot className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sm:mb-12">
                    <div className="space-y-2">
                        <div className="h-8 w-72 rounded-lg bg-slate-200 animate-pulse" />
                        <div className="h-4 w-56 rounded bg-slate-100 animate-pulse" />
                    </div>
                    <div className="h-12 w-full sm:w-48 rounded-2xl bg-slate-200 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-8">
                        {[4, 4, 2].map((fields, s) => (
                            <div
                                key={s}
                                className="bg-white rounded-3xl sm:rounded-[40px] border border-slate-100 p-5 sm:p-8 lg:p-10 shadow-sm"
                            >
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
                                    <div className="space-y-2">
                                        <div className="h-5 w-48 rounded bg-slate-200 animate-pulse" />
                                        <div className="h-3 w-64 rounded bg-slate-100 animate-pulse" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {Array.from({ length: fields }).map((_, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
                                            <div className="h-[52px] w-full rounded-2xl bg-slate-50 border border-slate-100 animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="hidden lg:block">
                        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-4">
                            <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-10 w-full rounded-xl bg-slate-50 animate-pulse" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </SkeletonRoot>
    );
}
