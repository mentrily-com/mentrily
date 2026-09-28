'use client';
import { MailCheck, ShieldCheck } from 'lucide-react';

interface UserCreatedSuccessProps {
    name?: string;
    invitedEmail?: string | null;
    onClose: () => void;
}

export default function UserCreatedSuccess({ name, invitedEmail, onClose }: UserCreatedSuccessProps) {
    if (!invitedEmail) return null;

    return (
        <div className="py-6 flex flex-col items-center text-center animate-fade-in">
            <div className="w-full max-w-md rounded-lg border border-emerald-100 bg-emerald-50/60 p-8 shadow-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-600 shadow-sm">
                    <MailCheck size={28} />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
                    Clerk Invitation Sent
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-gray-900">{name || invitedEmail}</h3>
                <div className="mt-5 break-all rounded-lg border border-white bg-white px-5 py-4 text-sm font-semibold text-gray-700 shadow-inner">
                    {invitedEmail}
                </div>
                <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-100 bg-white/80 p-4 text-left">
                    <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                    <p className="text-xs font-medium leading-relaxed text-gray-500">
                        Clerk will deliver the sign-up email. The selected role is applied after the invitee accepts the
                        invitation.
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="mt-6 w-full rounded-lg bg-gray-900 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-gray-800"
                >
                    Dismiss & Close
                </button>
            </div>
        </div>
    );
}
