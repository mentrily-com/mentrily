'use client';
import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AuthService } from '@/services/api/AuthService';
import { useOrganization } from '@/app/context/OrganizationContext';
import { AuthenticateWithRedirectCallback, useClerk, useSignIn, useUser } from '@clerk/nextjs';
import { BrandLockup } from '@/components/brand/BrandLockup';
import BrandedPageLoader from '@/app/components/Common/BrandedPageLoader';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isLoaded, signIn, setActive } = useSignIn();
    const { isSignedIn } = useUser();
    const { signOut } = useClerk();
    const oauthMode = searchParams.get('oauth');
    const oauthFlow = searchParams.get('flow') || 'signin';
    const oauthError = searchParams.get('error');
    const oauthMessage = searchParams.get('message');
    const oauthStatus = searchParams.get('status');
    const isOauthCallback = oauthMode === 'callback';
    const hasOauthCallbackError = Boolean(oauthError || oauthMessage || oauthStatus);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [secondFactorReady, setSecondFactorReady] = useState(false);
    const [secondFactorTarget, setSecondFactorTarget] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const [isRedirectingAuthenticatedUser, setIsRedirectingAuthenticatedUser] = useState(false);
    const { organization: orgContext } = useOrganization();

    const getSafeRedirectPath = React.useCallback(() => {
        const redirect = searchParams.get('redirect');
        if (!redirect || !redirect.startsWith('/')) return null;
        if (redirect.startsWith('//')) return null;
        if (redirect.startsWith('/exam/') || redirect.startsWith('/dashboard/')) {
            return redirect;
        }
        return null;
    }, [searchParams]);

    const resolvePostLoginPath = React.useCallback(
        (user: { needsRoleSelection?: boolean; role?: string } | null) => {
            const safeRedirect = getSafeRedirectPath();
            if (safeRedirect) return safeRedirect;
            if (!user) return '/dashboard/learner';
            if (user.needsRoleSelection) return '/dashboard';

            if (user.role === 'TEACHER' || user.role === 'ADMIN') return '/dashboard/creator';
            if (user.role === 'SUPER_ADMIN') return '/dashboard/super-admin';
            return '/dashboard/learner';
        },
        [getSafeRedirectPath],
    );

    React.useEffect(() => {
        AuthService.resetSessionCache();
    }, []);

    React.useEffect(() => {
        if (!isOauthCallback || !hasOauthCallbackError) return;

        const text = `${oauthError || ''} ${oauthMessage || ''} ${oauthStatus || ''}`.toLowerCase();
        if (text.includes('authorization_invalid') || text.includes('cancel') || text.includes('denied')) {
            router.replace('/login?error=oauth_cancelled');
            return;
        }

        if (oauthFlow === 'signin') {
            router.replace('/login?error=oauth_failed');
            return;
        }

        router.replace('/login?error=oauth_failed');
    }, [isOauthCallback, hasOauthCallbackError, oauthError, oauthMessage, oauthStatus, oauthFlow, router]);

    React.useEffect(() => {
        if (searchParams.get('error') === 'suspended') {
            setError('Your account has been suspended. Please contact the administrator.');
        } else if (searchParams.get('error') === 'account_not_found') {
            setError("Account doesn't exist. Please sign up first.");
        } else if (searchParams.get('error') === 'oauth_cancelled') {
            setError('Google sign-in was cancelled.');
        } else if (searchParams.get('error') === 'oauth_failed') {
            setError('Google sign-in failed. Please try again.');
        }
    }, [searchParams]);

    const redirectMissingAccount = React.useCallback(async () => {
        try {
            await signOut({ redirectUrl: '/login?error=account_not_found' });
        } catch {
            router.replace('/login?error=account_not_found');
        }
    }, [router, signOut]);

    React.useEffect(() => {
        if (isOauthCallback) return;
        if (isSignedIn) {
            const handleRedirect = async () => {
                setIsRedirectingAuthenticatedUser(true);
                let path = '/dashboard/learner';
                try {
                    const user = await AuthService.checkSession(true);
                    if (user) {
                        path = resolvePostLoginPath(user);
                    } else {
                        await redirectMissingAccount();
                        return;
                    }
                } catch (e) {
                    console.error('Sync error during auto-redirect', e);
                    await redirectMissingAccount();
                    return;
                }
                router.replace(path);
            };
            handleRedirect();
            return;
        }
        setIsRedirectingAuthenticatedUser(false);
    }, [
        isSignedIn,
        router,
        searchParams,
        signOut,
        isOauthCallback,
        oauthMode,
        redirectMissingAccount,
        getSafeRedirectPath,
        resolvePostLoginPath,
    ]);

    const completeSignIn = async (createdSessionId?: string | null) => {
        if (!createdSessionId) {
            throw new Error('Login session could not be created.');
        }
        if (!setActive) {
            throw new Error('Session activation is unavailable.');
        }

        await setActive({
            session: createdSessionId,
            navigate: async () => {},
        });

        let path = '/dashboard/learner';
        try {
            const user = await AuthService.checkSession(true);
            if (!user) {
                await redirectMissingAccount();
                return;
            }
            path = resolvePostLoginPath(user);
        } catch (e) {
            console.error('Failed to fetch user profile', e);
            await redirectMissingAccount();
            return;
        }

        router.push(path);
    };

    const prepareEmailSecondFactor = async (result: any) => {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;
        if (isSignedIn) return;

        setIsLoading(true);
        setError('');

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === 'complete') {
                await completeSignIn(result.createdSessionId);
            } else if (result.status === 'needs_second_factor') {
                await prepareEmailSecondFactor(result);
            } else {
                console.log(result);
                setError('Login incomplete. Please contact support.');
            }
        } catch (err: unknown) {
            console.error('Login error:', err);
            const msg =
                typeof err === 'object' && err !== null && 'errors' in err
                    ? ((err as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage ?? 'Login failed')
                    : err instanceof Error
                      ? err.message
                      : 'Login failed';
            if (msg.includes('suspended')) {
                setError('Your account has been suspended. Please contact the administrator.');
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSecondFactorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setIsLoading(true);
        setError('');

        try {
            const result = await signIn.attemptSecondFactor({
                strategy: 'email_code',
                code: verificationCode,
            });

            if (result.status === 'complete') {
                await completeSignIn(result.createdSessionId);
                return;
            }

            console.log(result);
            setError('Verification incomplete. Please check the code and try again.');
        } catch (err: unknown) {
            console.error('Second factor error:', err);
            const msg =
                typeof err === 'object' && err !== null && 'errors' in err
                    ? ((err as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage ??
                      'Verification failed')
                    : err instanceof Error
                      ? err.message
                      : 'Verification failed';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const signInWithGoogle = () => {
        if (!isLoaded) return;
        setIsGoogleLoading(true);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        signIn.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: `${origin}/login?oauth=callback&flow=signin`,
            redirectUrlComplete: `${origin}/login?oauth=google-signin`,
        });
    };

    if (isOauthCallback) {
        if (hasOauthCallbackError) {
            return null;
        }
        return <AuthenticateWithRedirectCallback transferable={false} signInUrl="/login" signUpUrl="/signup" />;
    }

    if (!isLoaded || isSignedIn || isRedirectingAuthenticatedUser) {
        return <BrandedPageLoader />;
    }

    return (
        <div
            className="min-h-screen w-full flex overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 42%, #E6F7F8 100%)',
            }}
        >
            {/* ── Left Panel: Brand / Illustration ── */}
            <div
                className="hidden lg:flex lg:w-[45%] xl:w-[48%] relative items-center justify-center overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, #071421 0%, #0B2F3A 52%, #008D98 100%)',
                }}
            >
                <div
                    className="absolute inset-0 opacity-[0.16]"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
                        backgroundSize: '42px 42px',
                    }}
                />
                <div className="absolute left-8 top-8 h-28 w-28 border border-white/10" />
                <div className="absolute bottom-10 right-10 h-40 w-40 border border-white/10" />

                <div className="relative z-10 max-w-md px-12 text-white">
                    <h2 className="text-3xl xl:text-4xl font-bold tracking-tight mb-4 leading-tight">
                        Welcome back to your school.
                    </h2>
                    <p className="text-white/70 text-[15px] leading-relaxed mb-10">
                        Your courses, exams, and students are waiting. Pick up right where you left off.
                    </p>

                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/15 backdrop-blur">
                        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">
                                    Platform
                                </p>
                                <p className="text-sm font-semibold text-white">Everything in one place</p>
                            </div>
                            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white/70">
                                Unified
                            </span>
                        </div>
                        <div className="space-y-2">
                            {[
                                ['Create', 'Courses and lessons'],
                                ['Assess', 'Quizzes and exams'],
                                ['Certify', 'Verified achievements'],
                            ].map(([label, value]) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between rounded-xl bg-white/10 p-3"
                                >
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                            {label}
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                                    </div>
                                    <div className="h-2 w-2 rounded-full bg-[#2DD4BF]" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 space-y-3">
                        {[
                            'Courses, lessons, quizzes, and assignments',
                            'Proctored exams and learner progress',
                            'Verifiable certificates with QR codes',
                        ].map((text) => (
                            <div key={text} className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />
                                <span className="text-white/60 text-sm">{text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right Panel: Form ── */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12">
                <div className="flex w-full max-w-[460px] flex-col items-center">
                    <div className="mb-6 flex w-full justify-center sm:mb-7">
                        <BrandLockup
                            orgName={orgContext?.name}
                            orgLogo={orgContext?.logo}
                            defaultLogoClassName="h-12 max-w-[250px] sm:h-14 sm:max-w-[290px]"
                            iconClassName="h-12 w-12"
                            textClassName="text-2xl font-bold"
                            href="/"
                            priority
                        />
                    </div>

                    <div className="w-full rounded-3xl border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur sm:p-8">
                        {/* Heading */}
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: '#0F172A' }}>
                                Sign in
                            </h1>
                            <p className="text-sm" style={{ color: '#94A3B8' }}>
                                Enter your credentials to access your dashboard.
                            </p>
                        </div>

                        {/* Google SSO */}
                        <button
                            type="button"
                            disabled={isGoogleLoading || isLoading}
                            onClick={signInWithGoogle}
                            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-medium border transition-all duration-150 cursor-pointer mb-6 disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: '#FFFFFF',
                                borderColor: '#E2E8F0',
                                color: '#334155',
                            }}
                            onMouseEnter={(e) => {
                                if (!isGoogleLoading && !isLoading) {
                                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                                    e.currentTarget.style.borderColor = '#CBD5E1';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isGoogleLoading && !isLoading) {
                                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                                    e.currentTarget.style.borderColor = '#E2E8F0';
                                }
                            }}
                        >
                            {isGoogleLoading ? (
                                <Loader2 size={18} className="animate-spin text-slate-400" />
                            ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                            )}
                            {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-px flex-1" style={{ backgroundColor: '#E2E8F0' }} />
                            <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>
                                or
                            </span>
                            <div className="h-px flex-1" style={{ backgroundColor: '#E2E8F0' }} />
                        </div>

                        {/* Error */}
                        {error && (
                            <div
                                className="mb-5 px-4 py-3 rounded-xl text-sm font-medium text-center"
                                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
                            >
                                {error}
                            </div>
                        )}

                        {!secondFactorReady ? (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        Email
                                    </label>
                                    <div className="relative group">
                                        <div
                                            className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-150"
                                            style={{ color: '#94A3B8' }}
                                        >
                                            <Mail size={18} />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="name@company.com"
                                            className="w-full py-3 pl-11 pr-4 text-sm rounded-xl border outline-none transition-all duration-150"
                                            style={{
                                                backgroundColor: '#FFFFFF',
                                                borderColor: '#E2E8F0',
                                                color: '#0F172A',
                                            }}
                                            onFocus={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--brand, #008D98)';
                                                e.currentTarget.style.boxShadow =
                                                    '0 0 0 3px color-mix(in srgb, var(--brand, #008D98) 12%, transparent)';
                                            }}
                                            onBlur={(e) => {
                                                e.currentTarget.style.borderColor = '#E2E8F0';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-sm font-medium" style={{ color: '#0F172A' }}>
                                            Password
                                        </label>
                                        <Link
                                            href="/forgot-password"
                                            className="text-xs font-medium transition-colors duration-150 cursor-pointer"
                                            style={{ color: 'var(--brand, #008D98)' }}
                                        >
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <div className="relative group">
                                        <div
                                            className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-150"
                                            style={{ color: '#94A3B8' }}
                                        >
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full py-3 pl-11 pr-11 text-sm rounded-xl border outline-none transition-all duration-150"
                                            style={{
                                                backgroundColor: '#FFFFFF',
                                                borderColor: '#E2E8F0',
                                                color: '#0F172A',
                                            }}
                                            onFocus={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--brand, #008D98)';
                                                e.currentTarget.style.boxShadow =
                                                    '0 0 0 3px color-mix(in srgb, var(--brand, #008D98) 12%, transparent)';
                                            }}
                                            onBlur={(e) => {
                                                e.currentTarget.style.borderColor = '#E2E8F0';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-150 cursor-pointer"
                                            style={{ color: '#CBD5E1' }}
                                            onMouseEnter={(e) => (e.currentTarget.style.color = '#64748B')}
                                            onMouseLeave={(e) => (e.currentTarget.style.color = '#CBD5E1')}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Remember me */}
                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        className="w-4 h-4 rounded border cursor-pointer accent-[var(--brand)]"
                                        style={{ borderColor: '#E2E8F0' }}
                                    />
                                    <label
                                        htmlFor="remember"
                                        className="text-sm cursor-pointer"
                                        style={{ color: '#64748B' }}
                                    >
                                        Keep me signed in
                                    </label>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: 'var(--brand, #008D98)' }}
                                    onMouseEnter={(e) => {
                                        if (!isLoading) e.currentTarget.style.opacity = '0.9';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = '1';
                                    }}
                                >
                                    {isLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            Sign In
                                            <ArrowRight
                                                size={16}
                                                className="group-hover:translate-x-0.5 transition-transform duration-150"
                                            />
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleSecondFactorSubmit} className="space-y-5">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)]/40 text-[var(--brand)] flex items-center justify-center shrink-0">
                                            <KeyRound size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Verify your sign-in</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Enter the verification code sent to {secondFactorTarget || email}.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        Verification Code
                                    </label>
                                    <div className="relative group">
                                        <div
                                            className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-150"
                                            style={{ color: '#94A3B8' }}
                                        >
                                            <KeyRound size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            required
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                            placeholder="123456"
                                            className="w-full py-3 pl-11 pr-4 text-sm rounded-xl border outline-none transition-all duration-150"
                                            style={{
                                                backgroundColor: '#FFFFFF',
                                                borderColor: '#E2E8F0',
                                                color: '#0F172A',
                                            }}
                                            onFocus={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--brand, #008D98)';
                                                e.currentTarget.style.boxShadow =
                                                    '0 0 0 3px color-mix(in srgb, var(--brand, #008D98) 12%, transparent)';
                                            }}
                                            onBlur={(e) => {
                                                e.currentTarget.style.borderColor = '#E2E8F0';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: 'var(--brand, #008D98)' }}
                                    onMouseEnter={(e) => {
                                        if (!isLoading) e.currentTarget.style.opacity = '0.9';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = '1';
                                    }}
                                >
                                    {isLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            Verify & Continue
                                            <ArrowRight
                                                size={16}
                                                className="group-hover:translate-x-0.5 transition-transform duration-150"
                                            />
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => {
                                        setSecondFactorReady(false);
                                        setVerificationCode('');
                                        setSecondFactorTarget('');
                                        setError('');
                                    }}
                                    className="w-full py-3 text-sm font-semibold rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 border border-slate-200 text-slate-600 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <ArrowLeft size={16} />
                                    Back to password
                                </button>
                            </form>
                        )}

                        {/* Footer */}
                        <p className="text-center mt-8 text-sm" style={{ color: '#94A3B8' }}>
                            Don&apos;t have an account?{' '}
                            <Link
                                href="/signup"
                                className="font-medium transition-colors duration-150 cursor-pointer"
                                style={{ color: 'var(--brand, #008D98)' }}
                            >
                                Create one
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
