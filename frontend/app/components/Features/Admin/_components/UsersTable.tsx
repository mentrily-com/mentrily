'use client';
import { CheckCircle, Trash2, UserMinus } from 'lucide-react';
import RoleBadge from '@/app/components/Common/RoleBadge';

interface UsersTableProps {
    users: any[];
    canManageUsers: boolean;
    onToggleStatus: (user: any) => void;
    onDeleteRequest: (user: any) => void;
}

export default function UsersTable({
    users,
    canManageUsers,
    onToggleStatus,
    onDeleteRequest,
}: UsersTableProps) {
    const getDisplayName = (user: any) => {
        const name = String(user.name || '').trim();
        if (name) return name;
        if (user.isPendingInvite) return 'Pending invite';
        return 'Unnamed user';
    };

    const getInitial = (user: any) => {
        const name = String(user.name || '').trim();
        if (name) return name[0].toUpperCase();
        const email = String(user.email || '').trim();
        return email ? email[0].toUpperCase() : '?';
    };

    return (
        <div
            className="bg-white rounded-xl border shadow-sm overflow-hidden min-h-[500px] flex flex-col"
            style={{ borderColor: 'var(--color-border-subtle)' }}
        >
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr
                            className="border-b"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-subtle)' }}
                        >
                            <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                Identity
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                Role & Dept
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                Account Status
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-right" style={{ color: 'var(--color-text-muted)' }}>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    No users found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => {
                                const isPendingInvite =
                                    user.isPendingInvite === true || user.accountStatus === 'PENDING_INVITE';
                                const statusLabel = isPendingInvite ? 'Pending invite' : user.isActive ? 'Active' : 'Suspended';
                                const statusDotClass = isPendingInvite
                                    ? 'bg-amber-500'
                                    : user.isActive
                                      ? 'bg-emerald-500'
                                      : 'bg-rose-500';
                                const statusTextClass = isPendingInvite
                                    ? 'text-amber-600'
                                    : user.isActive
                                      ? 'text-emerald-600'
                                      : 'text-rose-600';
                                const canActOnUser = canManageUsers && !isPendingInvite;

                                return (
                                <tr
                                    key={user.id || user.email}
                                    className="transition-colors group"
                                    style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                                                style={{ backgroundColor: 'var(--color-bg-muted)', color: 'var(--color-text-secondary)' }}
                                            >
                                                {getInitial(user)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                                    {getDisplayName(user)}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span
                                                        className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                        style={{ backgroundColor: 'var(--color-bg-muted)', color: 'var(--color-text-secondary)' }}
                                                    >
                                                        {user.rollNumber || 'NO ID'}
                                                    </span>
                                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-start gap-1">
                                            <RoleBadge role={user.role} />
                                            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                {user.department || user.dept || 'No'} Department
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                                    <div
                                                className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`}
                                            />
                                            <span
                                                className={`text-xs font-semibold ${statusTextClass}`}
                                            >
                                                {statusLabel}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => canActOnUser && onToggleStatus(user)}
                                                className={`p-2 rounded-lg transition-colors ${!canActOnUser ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                                    }`}
                                                style={{
                                                    color: !canActOnUser ? 'var(--color-text-muted)' : user.isActive ? 'var(--color-text-muted)' : '#D97706',
                                                    backgroundColor: !canActOnUser ? 'transparent' : user.isActive ? 'transparent' : '#FEF3C7',
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!canActOnUser) return;
                                                    e.currentTarget.style.backgroundColor = user.isActive ? '#FEF3C7' : '#FDE68A';
                                                    e.currentTarget.style.color = '#D97706';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!canActOnUser) return;
                                                    e.currentTarget.style.backgroundColor = user.isActive ? 'transparent' : '#FEF3C7';
                                                    e.currentTarget.style.color = user.isActive ? 'var(--color-text-muted)' : '#D97706';
                                                }}
                                                title={
                                                    isPendingInvite
                                                        ? 'Invite is pending acceptance'
                                                        : !canManageUsers
                                                        ? 'Management Locked'
                                                        : user.isActive
                                                            ? 'Suspend User'
                                                            : 'Activate User'
                                                }
                                            >
                                                {user.isActive ? <UserMinus size={16} /> : <CheckCircle size={16} />}
                                            </button>
                                            <button
                                                onClick={() => canActOnUser && onDeleteRequest(user)}
                                                className={`p-2 rounded-lg transition-colors ${!canActOnUser ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                                    }`}
                                                style={{ color: 'var(--color-text-muted)' }}
                                                onMouseEnter={(e) => {
                                                    if (!canActOnUser) return;
                                                    e.currentTarget.style.backgroundColor = '#FEE2E2';
                                                    e.currentTarget.style.color = '#DC2626';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!canActOnUser) return;
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = 'var(--color-text-muted)';
                                                }}
                                                title={
                                                    isPendingInvite
                                                        ? 'Invite is pending acceptance'
                                                        : !canManageUsers
                                                          ? 'Management Locked'
                                                          : 'Delete User'
                                                }
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
