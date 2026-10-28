import SkeletonRoot from './SkeletonRoot';

// Mirrors /certificate/verify/[code]: centered max-w-xl card, header band, labeled rows, footer.
export default function CertificateVerifySkeleton() {
    return (
        <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
            <SkeletonRoot className="w-full max-w-xl rounded-3xl bg-white border border-slate-100 shadow-xl overflow-hidden">
                <div className="bg-slate-200 px-6 py-10 sm:px-8 flex flex-col items-center animate-pulse">
                    <div className="w-14 h-14 rounded-full bg-white/50 mb-3" />
                    <div className="h-7 w-56 rounded-lg bg-white/60" />
                    <div className="h-4 w-64 rounded bg-white/40 mt-2" />
                </div>
                <div className="px-6 py-6 sm:px-8">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between gap-6 py-3 border-b border-slate-100 last:border-none"
                        >
                            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
                            <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
                        </div>
                    ))}
                </div>
                <div className="px-6 pb-6 sm:px-8 flex justify-center">
                    <div className="h-3 w-48 rounded bg-slate-100 animate-pulse" />
                </div>
            </SkeletonRoot>
        </main>
    );
}
