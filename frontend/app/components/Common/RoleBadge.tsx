'use client';

interface RoleBadgeProps {
    role: string;
}

export default function RoleBadge({ role }: RoleBadgeProps) {
    if (!role) {
        return (
            <span className="px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 border-slate-100">
                Unknown
            </span>
        );
    }

    const cleanRole = role.replace(/[_-]/g, ' ').trim().toLowerCase();
    const displayRole = cleanRole
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    const styles: Record<string, string> = {
        Student: 'bg-[var(--brand-light)] text-[var(--brand)] border-[var(--brand-light)]',
        Teacher: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        Admin: 'bg-rose-50 text-rose-600 border-rose-100',
        'Super Admin': 'bg-purple-50 text-purple-700 border-purple-100',
    };

    return (
        <span
            className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${styles[displayRole] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
        >
            {displayRole}
        </span>
    );
}
