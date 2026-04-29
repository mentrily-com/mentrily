import { API_BASE_URL } from '@/lib/api-base';

type VerifyPayload = {
    valid: boolean;
    certificate: {
        id: string;
        type: 'course' | 'exam';
        title: string;
        score?: number | null;
        completionPercent?: number | null;
        issuedAt: string;
        user?: { name?: string; email?: string };
        organization?: { name?: string };
    };
};

async function getVerification(code: string): Promise<VerifyPayload | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/certificate/verify/${code}`, {
            cache: 'no-store',
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const data = await getVerification(code);

    if (!data?.valid) {
        return (
            <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
                <section className="w-full max-w-xl rounded-3xl bg-white border border-rose-100 shadow-sm overflow-hidden">
                    <header className="bg-rose-500 text-white px-8 py-10 text-center">
                        <h1 className="text-2xl font-black">Certificate Not Found</h1>
                        <p className="text-sm mt-2 font-semibold opacity-90">The verification code is invalid or expired.</p>
                    </header>
                    <div className="px-8 py-6 text-center text-slate-500 font-medium">Code: {code}</div>
                </section>
            </main>
        );
    }

    const cert = data.certificate;

    return (
        <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
            <section className="w-full max-w-xl rounded-3xl bg-white border border-slate-100 shadow-xl overflow-hidden">
                <header className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white px-8 py-10 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/20 mx-auto mb-3 flex items-center justify-center text-2xl">✓</div>
                    <h1 className="text-2xl font-black">Certificate Verified</h1>
                    <p className="text-sm mt-1 font-semibold opacity-90">This certificate is authentic and valid.</p>
                </header>

                <div className="px-8 py-6">
                    <Row label="Student Name" value={cert.user?.name || cert.user?.email || 'Student'} />
                    <Row label={cert.type === 'exam' ? 'Exam' : 'Course'} value={cert.title} />
                    <Row label="Organization" value={cert.organization?.name || 'Organization'} />
                    <Row label="Completion" value={`${cert.completionPercent ?? cert.score ?? 0}%`} />
                    <Row label="Issued On" value={new Date(cert.issuedAt).toLocaleDateString()} />
                    <Row label="Certificate ID" value={cert.id} mono />
                </div>

                <footer className="px-8 pb-6 text-center text-[11px] text-slate-400 font-semibold">
                    Powered by Mentrily · Verified in real-time
                </footer>
            </section>
        </main>
    );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-none gap-6">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            <span className={`text-sm font-bold text-slate-800 text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
        </div>
    );
}
