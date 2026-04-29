'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, ArrowRight, Loader2, CheckCircle2, Lock, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useOrganization } from '../context/OrganizationContext';
import { useSignIn } from '@clerk/nextjs';
import { BrandLockup } from '@/components/brand/BrandLockup';
import AuthPanelBrand from '@/app/components/Common/AuthPanelBrand';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const { isLoaded, signIn, setActive } = useSignIn();
    const { organization: orgContext } = useOrganization();

    const [step, setStep] = useState<'email' | 'code' | 'success'>('email');

    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setIsLoading(true);
        setError('');

        try {
            await signIn.create({
                strategy: 'reset_password_email_code',
                identifier: email,
            });
            setStep('code');
        } catch (err: any) {
            console.error('error', err.errors[0].longMessage);
            setError(err.errors[0].longMessage || 'Failed to send reset code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await signIn.attemptFirstFactor({
                strategy: 'reset_password_email_code',
                code,
                password,
            });

            if (result.status === 'complete') {
                if (!setActive) {
                    throw new Error('Session activation is unavailable.');
                }
                await setActive({
                    session: result.createdSessionId,
                    navigate: async () => {},
                });
                setStep('success');
            } else {
                console.log(result);
                setError('Verification failed. Please try again.');
            }
        } catch (err: any) {
            console.error('error', err.errors[0].longMessage);
            setError(err.errors[0].longMessage || 'Failed to reset password. Please check the code.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen w-full flex overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 42%, #E6F7F8 100%)',
            }}
        >
            {/* ── Left Panel: Brand ── */}
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
                    <div className="mb-10">
                        <Link href="/login">
                            <AuthPanelBrand orgName={orgContext?.name} orgLogo={orgContext?.logo} priority />
                        </Link>
                    </div>

                    <h2 className="text-3xl xl:text-4xl font-bold tracking-tight mb-4 leading-tight">
                        Forgot your password? No worries.
                    </h2>
                    <p className="text-white/70 text-[15px] leading-relaxed mb-10">
                        We&apos;ll help you reset it in a few quick steps. Your school and all your data are exactly
                        where you left them.
                    </p>

                    {/* Steps indicator */}
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/15 backdrop-blur">
                        <div className="mb-4 border-b border-white/10 pb-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">
                                Recovery flow
                            </p>
                            <p className="text-sm font-semibold text-white">Secure account reset</p>
                        </div>
                        <div className="space-y-4">
                            {[
                                { num: '1', text: 'Enter your email address', active: step === 'email' },
                                { num: '2', text: 'Verify code & set new password', active: step === 'code' },
                                { num: '3', text: "You're back in!", active: step === 'success' },
                            ].map((s) => (
                                <div key={s.num} className="flex items-center gap-3">
                                    <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all duration-300"
                                        style={{
                                            backgroundColor: s.active ? 'white' : 'rgba(255,255,255,0.15)',
                                            color: s.active ? 'var(--brand, #008D98)' : 'rgba(255,255,255,0.5)',
                                        }}
                                    >
                                        {s.num}
                                    </div>
                                    <span
                                        className="text-sm transition-all duration-300"
                                        style={{ color: s.active ? 'white' : 'rgba(255,255,255,0.4)' }}
                                    >
                                        {s.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right Panel: Form ── */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12">
                <div className="w-full max-w-[460px] rounded-3xl border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur sm:p-8">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex flex-col items-center mb-8">
                        <Link href="/login">
                            <BrandLockup
                                orgName={orgContext?.name}
                                orgLogo={orgContext?.logo}
                                defaultLogoClassName="h-10 max-w-[210px]"
                                iconClassName="h-12 w-12"
                                textClassName="text-2xl font-bold"
                                priority
                            />
                        </Link>
                    </div>

                    {/* ── Step 1: Email ── */}
                    {step === 'email' && (
                        <>
                            <div className="mb-8">
                                <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: '#0F172A' }}>
                                    Reset your password
                                </h1>
                                <p className="text-sm" style={{ color: '#94A3B8' }}>
                                    Enter your email and we&apos;ll send you a verification code.
                                </p>
                            </div>

                            {error && (
                                <div
                                    className="mb-5 px-4 py-3 rounded-xl text-sm font-medium text-center"
                                    style={{
                                        backgroundColor: '#FEF2F2',
                                        border: '1px solid #FECACA',
                                        color: '#DC2626',
                                    }}
                                >
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleRequestOtp} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
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
                                            Send Verification Code
                                            <ArrowRight
                                                size={16}
                                                className="group-hover:translate-x-0.5 transition-transform duration-150"
                                            />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step 2: Code + New Password ── */}
                    {step === 'code' && (
                        <>
                            <div className="mb-8">
                                <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: '#0F172A' }}>
                                    Set a new password
                                </h1>
                                <p className="text-sm" style={{ color: '#94A3B8' }}>
                                    Enter the code sent to{' '}
                                    <span className="font-medium" style={{ color: '#0F172A' }}>
                                        {email}
                                    </span>{' '}
                                    and choose a new password.
                                </p>
                            </div>

                            {error && (
                                <div
                                    className="mb-5 px-4 py-3 rounded-xl text-sm font-medium text-center"
                                    style={{
                                        backgroundColor: '#FEF2F2',
                                        border: '1px solid #FECACA',
                                        color: '#DC2626',
                                    }}
                                >
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleResetPassword} className="space-y-4">
                                {/* Code */}
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

                                {/* New password */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        New password
                                    </label>
                                    <div className="relative">
                                        <div
                                            className="absolute left-3.5 top-1/2 -translate-y-1/2"
                                            style={{ color: '#94A3B8' }}
                                        >
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
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

                                {/* Confirm password */}
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F172A' }}>
                                        Confirm password
                                    </label>
                                    <div className="relative">
                                        <div
                                            className="absolute left-3.5 top-1/2 -translate-y-1/2"
                                            style={{ color: '#94A3B8' }}
                                        >
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
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
                                            Reset Password
                                            <CheckCircle2
                                                size={16}
                                                className="group-hover:scale-110 transition-transform duration-150"
                                            />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step 3: Success ── */}
                    {step === 'success' && (
                        <div className="text-center">
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                                style={{ backgroundColor: '#F0FDF4', color: '#10B981' }}
                            >
                                <CheckCircle2 size={32} />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: '#0F172A' }}>
                                Password reset!
                            </h2>
                            <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
                                Your password has been successfully updated. You are now logged in.
                            </p>
                            <button
                                onClick={() => router.push('/dashboard/learner')}
                                className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 group"
                                style={{ backgroundColor: '#10B981' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10B981')}
                            >
                                Go to Dashboard
                                <ArrowRight
                                    size={16}
                                    className="group-hover:translate-x-0.5 transition-transform duration-150"
                                />
                            </button>
                        </div>
                    )}

                    {/* Footer: Back to Sign In */}
                    <div className="mt-8 text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-150 cursor-pointer group"
                            style={{ color: '#94A3B8' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand, #008D98)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                        >
                            <ArrowLeft
                                size={14}
                                className="group-hover:-translate-x-0.5 transition-transform duration-150"
                            />
                            Back to Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
