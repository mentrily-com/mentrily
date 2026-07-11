'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOrganization } from '@/app/context/OrganizationContext';
import Loading from '../../loading';
import { AuthService } from '@/services/api/AuthService';
import { ExamService } from '@/services/api/ExamService';
import { buildOrgUrl, getRootDomain } from '@/lib/domain';
import { AuthenticateWithRedirectCallback, useClerk, useSignIn, useUser } from '@clerk/nextjs';
import { ArrowLeft, ArrowRight, CheckCircle2, Info, KeyRound, Loader2 } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandLockup';

function GoogleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
            />
            <path
                fill="#FF3D00"
                d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
                fill="#4CAF50"
                d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.8 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
            />
            <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.9 35.9 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
            />
        </svg>
    );
}

export default function ExamLoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
    const { signOut } = useClerk();
    const { user, isSignedIn } = useUser();

    const [loading, setLoading] = useState(false);
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [rollNo, setRollNo] = useState('');
    const [testCode, setTestCode] = useState('');
    const [name, setName] = useState('');
    const [section, setSection] = useState('');
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSignInLoading, setIsSignInLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isTestCodeVerified, setIsTestCodeVerified] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [secondFactorReady, setSecondFactorReady] = useState(false);
    const [secondFactorTarget, setSecondFactorTarget] = useState('');

    const { organization: orgContext } = useOrganization();
    const [examInfo, setExamInfo] = useState<any>(null);
    const slugFromQuery = searchParams?.get('slug');
    const afterSignInUrl = `/exam/login${slugFromQuery ? `?slug=${encodeURIComponent(slugFromQuery)}` : ''}`;
    const oauthMode = searchParams.get('oauth');
    const isOauthCallback = oauthMode === 'callback';
    const pendingCodeStorageKey = slugFromQuery
        ? `exam_oauth_pending_code:${slugFromQuery}`
        : 'exam_oauth_pending_code';

    const APP_DOWNLOAD_URL =
        'https://github.com/Sumanydv/electron-app-download/releases/download/v0.0.1/mentrily-Setup-0.0.1.exe';

    const isElectronClient = () => {
        if (typeof window === 'undefined') return false;
        const userAgent = navigator.userAgent.toLowerCase();
        return Boolean((window as any).electronAPI) || userAgent.includes('electron');
    };

    const isAppRequired = error === 'APP_REQUIRED';

    const signedInUserName = user?.fullName || user?.firstName || user?.username || 'Signed-in user';
    const signedInUserEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';

    const handleSignOut = async () => {
        await signOut({ redirectUrl: afterSignInUrl });
    };

    useEffect(() => {
        if (isOauthCallback) return;
        if (slugFromQuery) {
            const fetchExam = async () => {
                try {
                    const data = await ExamService.getExamPublicStatus(slugFromQuery!);
                    setExamInfo(data);

                    if (data?.examMode === 'App' && !isElectronClient()) {
                        setError('APP_REQUIRED');
                        setIsCheckingStatus(false);
                        return;
                    }

                    if (data.startTime) {
                        const start = new Date(data.startTime).getTime();
                        if (Date.now() < start) {
                            router.push(`/exam/waiting?slug=${slugFromQuery}`);
                            return;
                        }
                    }
                    setIsCheckingStatus(false);
                } catch (err: any) {
                    if (err.message?.includes('IP address is not whitelisted')) {
                        setError('Your network is not allowed to access this exam. Ask your teacher to add your IP to the allowed list.');
                    } else if (err.status === 401 || err.message?.includes('401') || err.message?.includes('Access denied')) {
                        setError('This exam is not accessible right now. Please try again or contact your teacher.');
                    } else {
                        setError('Failed to load exam information. Please check the URL or try again later.');
                    }
                    setIsCheckingStatus(false);
                }
            };
            fetchExam();
        } else {
            setIsCheckingStatus(false);
        }
    }, [slugFromQuery, router, isOauthCallback]);

    useEffect(() => {
        const errorType = searchParams?.get('error');
        if (errorType === 'active_session') {
            setError(
                'This exam is already active in another tab or device. Please close other instances and wait 2 minutes to retry.',
            );
        } else if (errorType === 'duplicate_login') {
            setError('You have been logged out because a new session was started on another tab or device.');
        } else if (errorType === 'suspended') {
            setError('Your account has been suspended. Please contact the administrator.');
        } else if (errorType === 'terminated') {
            setError('Your exam session has been terminated by the administrator. Contact your teacher.');
        } else if (errorType === 'ip_blocked') {
            setError('Your network is not allowed to access this exam. Ask your teacher to add your IP to the allowed list.');
        } else if (errorType === 'session_expired') {
            setError('Your session expired or access was denied. Please sign in again to continue.');
        } else if (errorType === 'app_required') {
            setError('APP_REQUIRED');
        } else if (errorType === 'not_student') {
            setError(
                'Access Denied: Only Student accounts can access exams. Please log in with a student account or use an incognito window.',
            );
        } else if (errorType === 'account_not_found') {
            setError('Account does not exist for exam access. Ask your teacher to add you first.');
        }
    }, [searchParams]);

    const syncExistingExamUserOrReject = async () => {
        const existingUser = await AuthService.checkSession(true);
        if (existingUser) {
            return existingUser;
        }

        await signOut({
            redirectUrl: `${afterSignInUrl}${afterSignInUrl.includes('?') ? '&' : '?'}error=account_not_found`,
        });
        return null;
    };

    const finalizeExamSignIn = async (createdSessionId?: string | null) => {
        if (!createdSessionId) {
            throw new Error('Exam sign-in session could not be created.');
        }
        if (!setActive) {
            throw new Error('Session activation is unavailable.');
        }

        await setActive({
            session: createdSessionId,
            navigate: async () => {},
        });

        return await syncExistingExamUserOrReject();
    };

    const prepareExamSecondFactor = async (result: any) => {
        const emailFactor = result?.supportedSecondFactors?.find((factor: any) => factor?.strategy === 'email_code');

        if (!emailFactor) {
            throw new Error('This account requires a second factor that is not supported here.');
        }

        await result.prepareSecondFactor({
            strategy: 'email_code',
            emailAddressId: emailFactor.emailAddressId,
        });

        setSecondFactorReady(true);
        setSecondFactorTarget(emailFactor.safeIdentifier || email);
    };

    const handleLogin = async (codeOverride?: string) => {
        const effectiveTestCode = (codeOverride ?? testCode).trim();
        if (!effectiveTestCode) {
            setError('Test Code is required');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const data = await AuthService.examLogin(effectiveTestCode, slugFromQuery || undefined);
            const postLoginUrl = data.postLoginUrl as string | undefined;
            const orgSlug = data.primaryOrganization?.slug as string | undefined;

            if (orgSlug && window.location.hostname.includes('localhost')) {
                localStorage.setItem('local_org_simulation', orgSlug);
                document.cookie = `org_subdomain=${encodeURIComponent(orgSlug)}; path=/; max-age=${7 * 24 * 60 * 60}`;
            }

            const targetSlug = data.exam?.slug || slugFromQuery;
            if (targetSlug) {
                const metadata = {
                    rollNumber: rollNo || user?.unsafeMetadata?.rollNumber || user?.publicMetadata?.rollNumber || '',
                    name: name || signedInUserName,
                    profilePicture: user?.imageUrl || '',
                    section,
                };
                localStorage.setItem(`exam_${targetSlug}_metadata`, JSON.stringify(metadata));
                localStorage.setItem(`exam_${targetSlug}_auth`, 'true');

                const host = window.location.hostname.toLowerCase();
                const isLocalHost =
                    host === 'localhost' || host.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(host);

                const configuredRootDomain = getRootDomain();
                const hostParts = host.split('.');
                const derivedRootDomain =
                    hostParts.length >= 2
                        ? `${hostParts[hostParts.length - 2]}.${hostParts[hostParts.length - 1]}`
                        : configuredRootDomain;

                const rootDomain =
                    !isLocalHost &&
                    configuredRootDomain &&
                    (host === configuredRootDomain || host.endsWith(`.${configuredRootDomain}`))
                        ? configuredRootDomain
                        : derivedRootDomain;

                const canSetCrossSubdomainCookie =
                    !isLocalHost && Boolean(rootDomain) && (host === rootDomain || host.endsWith(`.${rootDomain}`));
                const domainAttr = canSetCrossSubdomainCookie ? `; domain=.${rootDomain}` : '';
                const cookieMaxAge = 4 * 60 * 60;

                document.cookie = `exam_${targetSlug}_auth=true; path=/; max-age=${cookieMaxAge}; samesite=lax${domainAttr}`;
                document.cookie = `exam_${targetSlug}_metadata=${encodeURIComponent(JSON.stringify(metadata))}; path=/; max-age=${cookieMaxAge}; samesite=lax${domainAttr}`;

                const targetOrgBase = postLoginUrl || (orgSlug ? buildOrgUrl(orgSlug, '/') : null);

                if (targetOrgBase && !isLocalHost) {
                    const normalizedBase = targetOrgBase.endsWith('/') ? targetOrgBase.slice(0, -1) : targetOrgBase;
                    window.location.assign(`${normalizedBase}/exam/${targetSlug}`);
                    return;
                }

                router.replace(`/exam/${targetSlug}`);
            } else {
                router.push('/exam');
            }
        } catch (err: any) {
            if (err.message && err.message.includes('APP_REQUIRED')) {
                setError('APP_REQUIRED');
            } else if (err.message && (err.message.includes('EXAM_ALREADY_ACTIVE') || err.message.includes('409'))) {
                setError(
                    'This exam is already active on another device or tab. Please close other instances and wait 2 minutes to retry.',
                );
            } else if (err.message && err.message.includes('EXAM_ALREADY_SUBMITTED')) {
                setError('You have already attempted and submitted this exam. Multiple attempts are not allowed.');
            } else if (err.message && err.message.includes('ACCOUNT_SUSPENDED')) {
                setError('Your account has been suspended. Please contact the administrator.');
            } else {
                setError(err.message || 'Login failed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEmailPasswordSignIn = async () => {
        if (!signInLoaded || !signIn) return;
        if (!email || !password) {
            setError('Email and Password are required');
            return;
        }

        setIsSignInLoading(true);
        setError('');

        try {
            const result = await signIn.create({ identifier: email, password });
            if (result.status === 'complete') {
                await finalizeExamSignIn(result.createdSessionId);
            } else if (result.status === 'needs_second_factor') {
                await prepareExamSecondFactor(result);
            } else {
                setError('Sign in incomplete. Please try again.');
            }
        } catch (err: any) {
            setError(err?.errors?.[0]?.longMessage || err?.message || 'Sign in failed');
        } finally {
            setIsSignInLoading(false);
        }
    };

    const handleSecondFactorSignIn = async () => {
        if (!signInLoaded || !signIn) return;
        if (!verificationCode.trim()) {
            setError('Verification code is required');
            return;
        }

        setIsSignInLoading(true);
        setError('');

        try {
            const result = await signIn.attemptSecondFactor({
                strategy: 'email_code',
                code: verificationCode.trim(),
            });

            if (result.status === 'complete') {
                await finalizeExamSignIn(result.createdSessionId);
            } else {
                setError('Verification incomplete. Please try again.');
            }
        } catch (err: any) {
            setError(err?.errors?.[0]?.longMessage || err?.message || 'Verification failed');
        } finally {
            setIsSignInLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        if (!signInLoaded || !signIn) return;
        const code = testCode.trim();

        if (!code) {
            setError('Enter test code before using Google login');
            return;
        }

        setIsGoogleLoading(true);
        setError('');

        try {
            await AuthService.verifyExamTestCode(code, slugFromQuery || undefined);
            setIsTestCodeVerified(true);
            sessionStorage.setItem(pendingCodeStorageKey, code);

            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            await signIn.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: `${origin}${afterSignInUrl}${afterSignInUrl.includes('?') ? '&' : '?'}oauth=callback`,
                redirectUrlComplete: `${origin}${afterSignInUrl}`,
            });
        } catch (err: any) {
            setIsTestCodeVerified(false);
            setError(err?.message || 'Invalid test code');
            setIsGoogleLoading(false);
        }
    };

    useEffect(() => {
        if (!isSignedIn || !slugFromQuery || loading) return;

        const pendingCode = sessionStorage.getItem(pendingCodeStorageKey);
        if (!pendingCode) return;

        let cancelled = false;

        const resumeExamLogin = async () => {
            const existingUser = await syncExistingExamUserOrReject();
            if (!existingUser || cancelled) return;

            // Google sign-in only verifies the test code before redirecting —
            // it doesn't collect roll number/section/name. Prefill the code
            // (already verified) and let the student review/complete the rest
            // of the form before starting the exam themselves.
            setTestCode(pendingCode);
            setIsTestCodeVerified(true);
            sessionStorage.removeItem(pendingCodeStorageKey);
        };

        resumeExamLogin();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSignedIn, slugFromQuery, pendingCodeStorageKey]);

    if (isOauthCallback) {
        return <AuthenticateWithRedirectCallback transferable={false} signInUrl={afterSignInUrl} />;
    }

    if (isCheckingStatus) {
        return <Loading />;
    }

    return (
        <div className="h-screen w-full bg-slate-50 flex items-center justify-center font-sans overflow-hidden">
            <div className="w-full h-full flex flex-col md:flex-row bg-white overflow-hidden shadow-2xl">
                <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white relative z-10">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-10">
                            <div className="flex items-center gap-2.5 mb-8">
                                <BrandLockup
                                    orgName={orgContext?.name}
                                    orgLogo={orgContext?.logo}
                                    defaultLogoClassName="h-9 max-w-[180px]"
                                    iconClassName="h-10 w-10 rounded-lg"
                                    textClassName="text-2xl font-black tracking-tighter"
                                    priority
                                />
                            </div>

                            <h1 className="text-3xl font-black text-slate-900 mb-2">Student Login</h1>
                            <p className="text-slate-500 font-medium">Enter your details to access the exam</p>
                        </div>

                        {isAppRequired ? (
                            <div className="bg-white rounded-2xl border border-indigo-200 overflow-hidden shadow-sm">
                                <div className="bg-indigo-50 p-6 flex flex-col items-center justify-center border-b border-indigo-100">
                                    <h2 className="text-xl font-bold text-indigo-700">App Required</h2>
                                </div>
                                <div className="p-6 bg-white text-center space-y-3">
                                    <p className="text-slate-600 text-sm leading-relaxed">
                                        This exam is configured for{' '}
                                        <span className="font-bold text-slate-800">App (Secure)</span> mode and cannot
                                        be attempted in a web browser.
                                    </p>
                                    <a
                                        href={APP_DOWNLOAD_URL}
                                        className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                                    >
                                        Download Exam App
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <>
                                {error && (
                                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-shake">
                                        {error}
                                    </div>
                                )}

                                <form className="space-y-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Test Code
                                            </label>
                                            {isTestCodeVerified && (
                                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                                    <CheckCircle2 size={12} /> Verified
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <KeyRound
                                                size={16}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                            />
                                            <input
                                                type="text"
                                                value={testCode}
                                                onChange={(e) => {
                                                    setTestCode(e.target.value);
                                                    setIsTestCodeVerified(false);
                                                }}
                                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 font-semibold uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal placeholder:font-medium focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                                                placeholder="e.g. JS-TEST-01"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            Get this from your teacher — required to continue with Google.
                                        </p>
                                    </div>

                                    {isSignedIn ? (
                                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50">
                                            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center uppercase">
                                                {(signedInUserName || signedInUserEmail || 'U').slice(0, 2)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-emerald-800 truncate">
                                                    {signedInUserName}
                                                </p>
                                                {signedInUserEmail && (
                                                    <p className="text-xs text-emerald-700 truncate">
                                                        {signedInUserEmail}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSignOut}
                                                className="text-xs font-semibold text-slate-500 underline hover:text-slate-700"
                                            >
                                                Not you? Sign out
                                            </button>
                                        </div>
                                    ) : !secondFactorReady ? (
                                        <>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Email
                                                </label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="w-full h-10 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 font-semibold"
                                                    placeholder="name@company.com"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Password
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="w-full h-10 px-4 pr-12 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 font-semibold"
                                                        placeholder="••••••••"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword((prev) => !prev)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold"
                                                    >
                                                        {showPassword ? 'Hide' : 'Show'}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                                                <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
                                                    Verify Sign-In
                                                </p>
                                                <p className="mt-1 text-sm font-semibold text-slate-800">
                                                    Enter the code sent to {secondFactorTarget || email}.
                                                </p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Verification Code
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={verificationCode}
                                                        onChange={(e) => setVerificationCode(e.target.value)}
                                                        className="w-full h-10 px-4 pr-12 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 font-semibold"
                                                        placeholder="123456"
                                                        inputMode="numeric"
                                                        autoComplete="one-time-code"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                        <KeyRound size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Roll Number
                                            </label>
                                            <input
                                                type="text"
                                                value={rollNo}
                                                onChange={(e) => setRollNo(e.target.value)}
                                                className="w-full h-10 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 font-semibold"
                                                placeholder="e.g. 210056"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Section
                                            </label>
                                            <input
                                                type="text"
                                                value={section}
                                                onChange={(e) => setSection(e.target.value)}
                                                className="w-full h-10 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 font-semibold"
                                                placeholder="e.g. A"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full h-10 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 font-semibold"
                                            placeholder="Type your full name"
                                        />
                                    </div>

                                    {isSignedIn ? (
                                        <button
                                            type="button"
                                            onClick={() => handleLogin()}
                                            disabled={loading}
                                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 mt-4 flex items-center justify-center gap-2 disabled:opacity-70"
                                        >
                                            {loading ? <span>Verifying...</span> : <span>Start Exam</span>}
                                        </button>
                                    ) : !secondFactorReady ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleEmailPasswordSignIn}
                                                disabled={isSignInLoading}
                                                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 mt-4 flex items-center justify-center gap-2 disabled:opacity-70"
                                            >
                                                {isSignInLoading ? (
                                                    <span>Signing in...</span>
                                                ) : (
                                                    <span>Sign in with Email</span>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleGoogleSignIn}
                                                disabled={isGoogleLoading || !testCode.trim()}
                                                className="w-full h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold rounded-xl transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {isGoogleLoading ? (
                                                    <span>Verifying Code...</span>
                                                ) : (
                                                    <>
                                                        <GoogleIcon />
                                                        <span>Continue with Google</span>
                                                    </>
                                                )}
                                            </button>
                                            {!testCode.trim() && (
                                                <p className="text-[11px] text-amber-600 font-semibold text-center flex items-center justify-center gap-1">
                                                    <Info size={12} />
                                                    Enter your test code above to unlock Google sign-in
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleSecondFactorSignIn}
                                                disabled={isSignInLoading}
                                                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 mt-4 flex items-center justify-center gap-2 disabled:opacity-70"
                                            >
                                                {isSignInLoading ? (
                                                    <>
                                                        <Loader2 size={16} className="animate-spin" />
                                                        <span>Verifying...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>Verify & Continue</span>
                                                        <ArrowRight size={16} />
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSecondFactorReady(false);
                                                    setVerificationCode('');
                                                    setSecondFactorTarget('');
                                                    setError('');
                                                }}
                                                disabled={isSignInLoading}
                                                className="w-full h-11 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold rounded-xl transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
                                            >
                                                <ArrowLeft size={16} />
                                                <span>Back to password</span>
                                            </button>
                                        </>
                                    )}
                                </form>
                            </>
                        )}
                    </div>
                </div>

                <div className="hidden md:flex w-full md:w-1/2 bg-[#4F46E5] p-8 md:p-12 lg:p-16 text-white flex-col justify-between relative overflow-hidden">
                    <div
                        className="absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                            backgroundSize: '28px 28px',
                        }}
                    />
                    <div className="relative z-10 w-full">
                        <h2 className="text-5xl font-black tracking-tight mb-2 leading-tight">
                            {examInfo?.title || 'Secure Examination'}
                        </h2>
                        <p className="text-indigo-100 font-medium text-lg mb-10">
                            Please authenticate to begin your examination
                        </p>

                        {examInfo && (
                            <div className="flex flex-wrap gap-3">
                                {typeof examInfo.duration === 'number' && (
                                    <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                                            Duration
                                        </p>
                                        <p className="text-lg font-black">{examInfo.duration} min</p>
                                    </div>
                                )}
                                {typeof examInfo.totalQuestions === 'number' && (
                                    <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                                            Questions
                                        </p>
                                        <p className="text-lg font-black">{examInfo.totalQuestions}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <p className="relative z-10 text-indigo-200 text-xs font-semibold uppercase tracking-widest">
                        Secured by Mentrily
                    </p>
                </div>
            </div>
        </div>
    );
}
