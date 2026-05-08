'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SplitPane from '@/app/components/SplitPane';
import CodingQuestionRenderer from '@/app/components/CodingQuestionRenderer';
import ProblemStatement from '@/app/components/ProblemStatement';
import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';
import { CodeExecutionService } from '@/services/api/CodeExecutionService';

export default function SharedCodingQuestionPage() {
    const params = useParams<{ slug: string }>();
    const slug = String(params?.slug || '');
    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [answer, setAnswer] = useState<any>(null);
    const [selectedLang, setSelectedLang] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [terminalLogs, setTerminalLogs] = useState('');
    const [executionResults, setExecutionResults] = useState<any[]>([]);
    const [rateLimit, setRateLimit] = useState<any>(null);

    useEffect(() => {
        if (!slug) return;
        let active = true;
        setLoading(true);
        CodeExecutionService.getPublicQuestion(slug)
            .then((data) => {
                if (!active) return;
                setRecord(data);
                setSelectedLang(data?.question?.codingConfig?.languageId || null);
                setError('');
            })
            .catch((loadError) => {
                if (!active) return;
                setError(String(loadError).includes('410') ? 'expired' : String(loadError));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [slug]);

    if (loading) {
        return (
            <PublicPlaygroundShell>
                <div className="flex h-[640px] items-center justify-center rounded-2xl border border-slate-100 bg-white text-sm font-bold text-slate-500">
                    Loading question...
                </div>
            </PublicPlaygroundShell>
        );
    }

    if (error || !record?.question) {
        const expired = error === 'expired';
        return (
            <PublicPlaygroundShell>
                <div className="flex h-[520px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 text-center">
                    <p className="max-w-md text-sm font-semibold text-slate-500">
                        {expired
                            ? 'This link is no longer active. Signed-in creators can make links that last 30 days.'
                            : error}
                    </p>
                    <div className="mt-5 flex gap-3">
                        <Link href="/login" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
                            Sign in
                        </Link>
                        <Link href="/signup" className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-black text-white">
                            Sign up
                        </Link>
                    </div>
                </div>
            </PublicPlaygroundShell>
        );
    }

    const question = record.question;

    return (
            <PublicPlaygroundShell>
                <div
                className="h-[calc(100vh-6rem)] min-h-[620px] overflow-hidden rounded-xl border bg-white"
                style={{ borderColor: 'var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
                <SplitPane
                    initialLeftWidth={38}
                    leftContent={
                        <ProblemStatement
                            title={question.title}
                            difficulty={question.difficulty || 'Practice'}
                            topic={question.topic || 'Coding'}
                            description={question.description}
                            hideHeader
                            hideBookmark
                        />
                    }
                    rightContent={
                        <div className="flex h-full min-h-0 flex-col">
                            {rateLimit && (
                                <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-500">
                                    {rateLimit.remaining} of {rateLimit.limit} public runs left this hour
                                </div>
                            )}
                            <div className="min-h-0 flex-1">
                                <CodingQuestionRenderer
                                    question={question}
                                    hasAttemptSelected={false}
                                    attemptAnswer={null}
                                    currentAnswer={answer}
                                    onAnswerChange={setAnswer}
                                    onSubmit={setAnswer}
                                    contentFontSize={14}
                                    selectedCodingLang={selectedLang}
                                    onLanguageChange={setSelectedLang}
                                    isRunning={isRunning}
                                    setIsRunning={setIsRunning}
                                    terminalLogs={terminalLogs}
                                    setTerminalLogs={setTerminalLogs}
                                    executionResults={executionResults}
                                    setExecutionResults={setExecutionResults}
                                    publicMode
                                    publicQuestionSlug={slug}
                                    onPublicRateLimitChange={setRateLimit}
                                    hideSubmit
                                />
                            </div>
                        </div>
                    }
                />
            </div>
        </PublicPlaygroundShell>
    );
}
