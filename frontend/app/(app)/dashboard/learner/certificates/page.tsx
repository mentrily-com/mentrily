'use client';

import React from 'react';
import Link from 'next/link';
import { StudentService } from '@/services/api/StudentService';
import { Award, Download, Loader2, Lock } from 'lucide-react';

type LearnerCertificate = {
    id: string;
    type?: string;
    resourceId?: string;
    title?: string;
    score?: number | null;
    completionPercent?: number | null;
    fileUrl?: string;
    issuedAt?: string;
};

export default function LearnerCertificatesPage() {
    const [certificates, setCertificates] = React.useState<LearnerCertificate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [locked, setLocked] = React.useState(false);
    const [downloadId, setDownloadId] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;

        async function loadCertificates() {
            try {
                setLoading(true);
                const response = await StudentService.getCertificates();
                if (!mounted) {
                    return;
                }
                setCertificates(Array.isArray(response) ? response : []);
                setLocked(false);
            } catch (error) {
                if (!mounted) {
                    return;
                }

                const status = (error as Error & { status?: number })?.status;
                if (status === 403) {
                    setLocked(true);
                    setCertificates([]);
                } else {
                    console.error('Failed to load certificates', error);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        void loadCertificates();
        return () => {
            mounted = false;
        };
    }, []);

    const handleDownload = async (certificateId: string) => {
        try {
            setDownloadId(certificateId);
            const certificate = await StudentService.downloadCertificate(certificateId);
            if (!certificate?.fileUrl) {
                return;
            }

            const title = certificate.title || 'certificate';
            const proxyUrl = `/api/download?url=${encodeURIComponent(certificate.fileUrl)}&name=${encodeURIComponent(`${title}.pdf`)}`;
            window.open(proxyUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error('Failed to download certificate', error);
        } finally {
            setDownloadId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            <div className="border-b border-slate-100 bg-white/90 backdrop-blur-sm">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-wrap items-center gap-4 sm:gap-10">
                    <button className="py-4 text-sm font-black text-[var(--brand)] border-b-2 border-[var(--brand)] px-1">
                        My Certificates
                    </button>
                    <div className="text-xs font-bold text-slate-400">
                        {loading ? 'Loading credentials...' : `${certificates.length} issued certificates`}
                    </div>
                </div>
            </div>

            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8 animate-fade-in">
                {loading ? (
                    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-[var(--brand)]" />
                        <p className="text-sm font-bold text-slate-500">Loading your certificates...</p>
                    </div>
                ) : locked ? (
                    <section className="mt-6 rounded-[30px] border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-8">
                        <div className="flex flex-col items-start gap-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-col items-start gap-4 sm:flex-row">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
                                    <Lock size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight text-amber-950 sm:text-2xl">
                                        Certificate access is not enabled for this learner plan.
                                    </h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-7 text-amber-900/80">
                                        Your organization has not enabled learner certificate downloads on the current
                                        plan yet. Once upgraded, issued certificates will appear here automatically.
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/dashboard/learner"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-white sm:w-auto"
                            >
                                Return to dashboard
                            </Link>
                        </div>
                    </section>
                ) : certificates.length === 0 ? (
                    <section className="mt-6 rounded-[30px] border-2 border-dashed border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--brand-lighter)] text-[var(--brand)]">
                            <Award size={28} />
                        </div>
                        <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-900">
                            No certificates issued yet
                        </h2>
                        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                            Complete courses or pass linked exams to unlock certificates. When one is issued, it will
                            show up here with a direct download action.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <Link
                                href="/dashboard/learner"
                                className="w-full rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-black text-white sm:w-auto"
                            >
                                Continue learning
                            </Link>
                            <Link
                                href="/dashboard/learner/test"
                                className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
                            >
                                Review my results
                            </Link>
                        </div>
                    </section>
                ) : (
                    <section className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {certificates.map((certificate) => (
                            <article
                                key={certificate.id}
                                className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] sm:p-6"
                            >
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex min-w-0 items-start gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-lighter)] text-[var(--brand)]">
                                            <Award size={22} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                                                {(certificate.type || 'Certificate').replace(/_/g, ' ')}
                                            </p>
                                            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                                                {certificate.title || 'Certificate'}
                                            </h2>
                                        </div>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                        {certificate.issuedAt
                                            ? new Date(certificate.issuedAt).toLocaleDateString()
                                            : 'Pending'}
                                    </span>
                                </div>

                                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                    <DetailCard
                                        label="Completion"
                                        value={formatPercent(certificate.completionPercent)}
                                    />
                                    <DetailCard label="Score" value={formatPercent(certificate.score)} />
                                </div>

                                <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                                        Resource ID
                                    </p>
                                    <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                                        {certificate.resourceId || certificate.id}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleDownload(certificate.id)}
                                    disabled={downloadId === certificate.id}
                                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
                                >
                                    {downloadId === certificate.id ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            Preparing download
                                        </>
                                    ) : (
                                        <>
                                            <Download size={15} />
                                            Download certificate
                                        </>
                                    )}
                                </button>
                            </article>
                        ))}
                    </section>
                )}
            </main>
        </div>
    );
}

function DetailCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-black tracking-tight text-slate-950">{value}</p>
        </div>
    );
}

function formatPercent(value?: number | null) {
    if (value === null || typeof value === 'undefined' || Number.isNaN(Number(value))) {
        return '--';
    }

    return `${Math.round(Number(value))}%`;
}
