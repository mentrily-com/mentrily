'use client';
import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, User, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useOrganization } from '../context/OrganizationContext';
import { AuthenticateWithRedirectCallback, useSignUp, useUser } from '@clerk/nextjs';

import { AuthService } from '@/services/api/AuthService';
import { BrandLockup } from '@/components/brand/BrandLockup';
import BrandedPageLoader from '@/app/components/Common/BrandedPageLoader';

export default function SignupPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isLoaded, signUp, setActive } = useSignUp();
    const { isSignedIn } = useUser();
    const invitationTicket = String(searchParams.get('__clerk_ticket') || '').trim();
    const invitationStatus = String(searchParams.get('__clerk_status') || '')
        .trim()
        .toLowerCase();
    const isInvitationFlow = Boolean(invitationTicket) && invitationStatus === 'sign_up';
    const oauthMode = searchParams.get('oauth');
    const oauthFlow = searchParams.get('flow') || 'signup';
    const oauthError = searchParams.get('error');
    const oauthMessage = searchParams.get('message');
    const oauthStatus = searchParams.get('status');
    const isOauthCallback = oauthMode === 'callback';
    const hasOauthCallbackError = Boolean(oauthError || oauthMessage || oauthStatus);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [pendingVerification, setPendingVerification] = useState(false);
    const [code, setCode] = useState('');
    const [isRedirectingAuthenticatedUser, setIsRedirectingAuthenticatedUser] = useState(false);
    const isHandlingVerifyRef = React.useRef(false);

    const { organization: orgContext } = useOrganization();

    const resolvePostSignupPath = (user: { needsRoleSelection?: boolean; role?: string } | null) => {
        if (!user) return '/dashboard?flow=signup';
        if (user.needsRoleSelection) return '/dashboard?flow=signup';

        if (user.role === 'TEACHER' || user.role === 'ADMIN') return '/dashboard/creator';
        if (user.role === 'SUPER_ADMIN') return '/dashboard/super-admin';
        return '/dashboard/learner';
    };

    React.useEffect(() => {
        AuthService.resetSessionCache();
    }, []);

    React.useEffect(() => {
        if (!isOauthCallback || !hasOauthCallbackError) return;

        const text = `${oauthError || ''} ${oauthMessage || ''} ${oauthStatus || ''}`.toLowerCase();
        if (text.includes('authorization_invalid') || text.includes('cancel') || text.includes('denied')) {
            router.replace('/signup?error=oauth_cancelled');
            return;
        }

        if (oauthFlow === 'signup') {
            router.replace('/signup?error=oauth_failed');
            return;
        }

        router.replace('/signup?error=oauth_failed');
    }, [isOauthCallback, hasOauthCallbackError, oauthError, oauthMessage, oauthStatus, oauthFlow, router]);

    React.useEffect(() => {
        if (isOauthCallback) return;
        if (isHandlingVerifyRef.current) return;
        if (isSignedIn) {
            let cancelled = false;

            const redirectAuthenticatedUser = async () => {
                setIsRedirectingAuthenticatedUser(true);
                AuthService.resetSessionCache();

                let user = null;

                for (let attempt = 0; attempt < 3; attempt += 1) {
                    user = await AuthService.checkSessionForSignup();

                    if (user) break;
                    await new Promise((resolve) => setTimeout(resolve, 80));
                }

                if (cancelled) {
                    return;
                }

                const path = resolvePostSignupPath(user);
                router.replace(path);
            };

            redirectAuthenticatedUser();

            return () => {
                cancelled = true;
            };
        }

        setIsRedirectingAuthenticatedUser(false);
    }, [isSignedIn, router, isOauthCallback]);

    React.useEffect(() => {
        if (searchParams.get('error') === 'oauth_cancelled') {
            setError('Google sign-up was cancelled.');
        } else if (searchParams.get('error') === 'oauth_failed') {
            setError('Google sign-up failed. Please try again.');
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setIsLoading(true);
        setError('');

        try {
            if (isInvitationFlow) {
                const invitationSignUp = signUp as typeof signUp & {
                    ticket: (params: {
                        ticket: string;
                        firstName?: string;
                        lastName?: string;
                        password?: string;
                    }) => Promise<{ error: unknown | null }>;
                    finalize: (params: { navigate: () => Promise<void> }) => Promise<{ error: unknown | null }>;
                };

                const result = await invitationSignUp.ticket({
                    ticket: invitationTicket,
                    firstName,
                    lastName,
                    password,
                });

                if (result.error) {
                    throw result.error;
                }

                if (signUp.status === 'complete') {
                    const finalizeResult = await invitationSignUp.finalize({
                        navigate: async () => {},
                    });

                    if (finalizeResult.error) {
                        throw finalizeResult.error;
                    }

                    let path = '/dashboard?flow=signup';
                    try {
                        let user = null;
                        for (let attempt = 0; attempt < 3; attempt += 1) {
                            user = await AuthService.checkSessionForSignup();
                            if (user) break;
                            await new Promise((resolve) => setTimeout(resolve, 120));
                        }

                        path = resolvePostSignupPath(user);
                    } catch (e) {
                        console.error('Failed to fetch invited user profile', e);
                    }

                    router.push(path);
                    return;
                }

                setError('Please complete the required fields to accept this invitation.');
                return;
            }

            await signUp.create({
                firstName,
                lastName,
                emailAddress: email,
                password,
            });

            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setPendingVerification(true);
        } catch (err: unknown) {
            console.error('Signup error:', err);
            const message =
                typeof err === 'object' && err !== null && 'errors' in err
                    ? ((err as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage ??
                      'Signup failed')
                    : err instanceof Error
                      ? err.message
                      : 'Signup failed';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;
        isHandlingVerifyRef.current = true;
        let releaseVerifyGuard = true;

        setIsLoading(true);
        setError('');

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            });

            if (completeSignUp.status === 'complete') {
                if (!setActive) {
                    throw new Error('Session activation is unavailable.');
                }
                await setActive({
                    session: completeSignUp.createdSessionId,
                    navigate: async () => {},
                });

                let path = '/dashboard?flow=signup';
                try {
                    let user = null;
                    for (let attempt = 0; attempt < 3; attempt += 1) {
                        user = await AuthService.checkSessionForSignup();
                        if (user) break;
                        await new Promise((resolve) => setTimeout(resolve, 120));
                    }

                    path = resolvePostSignupPath(user);
                } catch (e) {
                    console.error('Failed to fetch user profile', e);
                }

                releaseVerifyGuard = false;
                router.push(path);
            } else {
                console.log(JSON.stringify(completeSignUp, null, 2));
                setError('Verification incomplete. Please contact support.');
            }
        } catch (err: unknown) {
            console.error('Verification error:', err);
            const message =
                typeof err === 'object' && err !== null && 'errors' in err
                    ? ((err as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage ??
                      'Verification failed')
                    : err instanceof Error
                      ? err.message
                      : 'Verification failed';
            setError(message);
        } finally {
            if (releaseVerifyGuard) {
                isHandlingVerifyRef.current = false;
            }
            setIsLoading(false);
        }
    };

    const signUpWithGoogle = () => {
        if (!isLoaded) return;
        AuthService.resetSessionCache();
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        signUp.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: `${origin}/signup?oauth=callback&flow=signup`,
            redirectUrlComplete: `${origin}/dashboard?flow=signup`,
        });
    };

    if (isOauthCallback) {
        if (hasOauthCallbackError) {
            return null;
        }
        return <AuthenticateWithRedirectCallback />;
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
                        Launch your school in minutes.
                    </h2>
                    <p className="text-white/70 text-[15px] leading-relaxed mb-10">
                        Create courses, set up exams, invite learners, and issue certificates from one polished
                        workspace.
                    </p>

                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/15 backdrop-blur">
                        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">
                                    Included
                                </p>
                                <p className="text-sm font-semibold text-white">Creator workspace</p>
                            </div>
                            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white/70">
                                Free start
                            </span>
                        </div>
                        <div className="space-y-2">
                            {['Course builder', 'Quiz and exam tools', 'Certificates'].map((item, index) => (
                                <div key={item} className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-xs font-bold text-[#008D98]">
                                        {index + 1}
                                    </span>
                                    <span className="text-sm font-medium text-white/80">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 space-y-3">
                        {[
                            'Free forever on the starter plan',
                            'No credit card required',
                            'White-label your school from day one',
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
                            priority
                        />
                    </div>

                    <div className="w-full rounded-3xl border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur sm:p-8">
                        {/* Heading */}
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: '#0F172A' }}>
                                {pendingVerification
                                    ? 'Verify your email'
                                    : isInvitationFlow
                                      ? 'Accept your invitation'
                                      : 'Create your account'}
                            </h1>
                            <p className="text-sm" style={{ color: '#94A3B8' }}>
                                {pendingVerification
                                    ? `We sent a verification code to ${email}`
                                    : isInvitationFlow
                                      ? 'Finish setting up your invited account.'
                                      : 'Get started with your own school platform.'}
                            </p>
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

                        {!pendingVerification ? (
                            <>
                                {/* Google SSO */}
                                {!isInvitationFlow && (
                                    <button
                                        type="button"
                                        onClick={signUpWithGoogle}
                                        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-medium border transition-all duration-150 cursor-pointer mb-6"
                                        style={{
                                            backgroundColor: '#FFFFFF',
                                            borderColor: '#E2E8F0',
                                            color: '#334155',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#F8FAFC';
                                            e.currentTarget.style.borderColor = '#CBD5E1';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                                            e.currentTarget.style.borderColor = '#E2E8F0';
                                        }}
                                    >
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
                                        Continue with Google
                                    </button>
                                )}

                                {/* Divider */}
                                {!isInvitationFlow && (
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-px flex-1" style={{ backgroundColor: '#E2E8F0' }} />
                                        <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>
                                            or
                                        </span>
                                        <div className="h-px flex-1" style={{ backgroundColor: '#E2E8F0' }} />
                                    </div>
                                )}

                                {isInvitationFlow && (
                                    <div
                                        className="mb-6 px-4 py-3 rounded-xl text-sm"
                                        style={{
                                            backgroundColor: '#F0FDFA',
                                            border: '1px solid #99F6E4',
                                            color: '#115E59',
                                        }}
                                    >
                                        This invitation already contains the invited email address. Set your password to
                                        activate the account.
                                    </div>
                                )}

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Name row */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label
                                                className="block text-sm font-medium mb-1.5"
                                                style={{ color: '#0F172A' }}
                                            >
                                                First name
                                            </label>
                                            <div className="relative">
                                                <div
                                                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                                                    style={{ color: '#94A3B8' }}
                                                >
                                                    <User size={18} />
                                                </div>
                                                <input
                                                    type="text"
                                                    required
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    placeholder="John"
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
                                        <div>
                                            <label
                                                className="block text-sm font-medium mb-1.5"
                                                style={{ color: '#0F172A' }}
                                            >
                                                Last name
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                placeholder="Doe"
                                                className="w-full py-3 px-4 text-sm rounded-xl border outline-none transition-all duration-150"
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

                                    {!isInvitationFlow && (
                                        <div>
                                            <label
                                                className="block text-sm font-medium mb-1.5"
                                                style={{ color: '#0F172A' }}
                                            >
                                                Email
                                            </label>
                                            <div className="relative">
                                                <div
                                                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
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
                                    )}

                                    {/* Password */}
                                    <div>
                                        <label
                                            className="block text-sm font-medium mb-1.5"
                                            style={{ color: '#0F172A' }}
                                        >
                                            Password
                                        </label>
                                        <div className="relative">
                                            <div
                                                className="absolute left-3.5 top-1/2 -translate-y-1/2"
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

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed mt-1"
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
                                                {isInvitationFlow ? 'Accept Invitation' : 'Create Account'}
                                                <ArrowRight
                                                    size={16}
                                                    className="group-hover:translate-x-0.5 transition-transform duration-150"
                                                />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        ) : (
                            /* ── Verification step ── */
                            <form onSubmit={handleVerify} className="space-y-5">
                                {/* Info banner */}
                                <div
                                    className="px-4 py-3 rounded-xl text-sm text-center"
                                    style={{
                                        backgroundColor: '#E6F7F8',
                                        border: '1px solid #E6F7F8',
                                        color: '#1E40AF',
                                    }}
                                >
                                    We sent a verification code to <br />
                                    <span className="font-semibold">{email}</span>
                                </div>

                                {/* Code input */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        Verification code
                                    </label>
                                    <div className="relative">
                                        <div
                                            className="absolute left-3.5 top-1/2 -translate-y-1/2"
                                            style={{ color: '#94A3B8' }}
                                        >
                                            <KeyRound size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            placeholder="123456"
                                            className="w-full py-3 pl-11 pr-4 text-sm rounded-xl border outline-none transition-all duration-150 tracking-widest"
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
                                            Verify & Complete
                                            <ArrowRight
                                                size={16}
                                                className="group-hover:translate-x-0.5 transition-transform duration-150"
                                            />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* Footer */}
                        <p className="text-center mt-8 text-sm" style={{ color: '#94A3B8' }}>
                            Already have an account?{' '}
                            <Link
                                href="/login"
                                className="font-medium transition-colors duration-150 cursor-pointer"
                                style={{ color: 'var(--brand, #008D98)' }}
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
