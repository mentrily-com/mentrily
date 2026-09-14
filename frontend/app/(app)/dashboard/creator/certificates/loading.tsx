export default function Loading() {
    return (
        <div className="relative overflow-hidden border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] min-h-[68vh] rounded-[36px] p-8 md:p-12 font-sans">
            <div className="space-y-6">
                <div className="h-7 w-36 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
                    <div className="space-y-3 flex-1">
                        <div className="h-10 w-64 rounded-xl bg-slate-200 animate-pulse" />
                        <div className="h-4 w-full max-w-xl rounded bg-slate-100 animate-pulse" />
                        <div className="h-4 w-3/4 max-w-lg rounded bg-slate-100 animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
}
