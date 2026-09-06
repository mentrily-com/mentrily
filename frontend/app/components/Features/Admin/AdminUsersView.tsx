'use client';
import React from 'react';
import { siteConfig } from '@/app/config/site';
import { UserPlus, Search, Lock, ListFilter } from 'lucide-react';
import UserManagementModal from '@/app/components/Common/UserManagementModal';
import UsersTable from './_components/UsersTable';
import DeleteUserModal from './_components/DeleteUserModal';
import { useAdminUsers } from './_components/useAdminUsers';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

interface AdminUsersViewProps {
    basePath?: string;
    organizationId?: string;
}

export default function AdminUsersView({ basePath, organizationId }: AdminUsersViewProps) {
    const {
        searchQuery,
        setSearchQuery,
        isUserModalOpen,
        setIsUserModalOpen,
        userToDelete,
        setUserToDelete,
        setUsers,
        canManageUsers,
        filteredUsers,
        handleToggleStatus,
        handleDelete,
        handleRoleChange,
        loading,
    } = useAdminUsers(organizationId);

    if (loading) {
        return <DashboardSkeleton type="list" />;
    }

    return (
        <div className="animate-fade-in font-sans text-slate-900">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                        User Management
                    </h1>
                    <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Manage institutional users and their platform access.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {canManageUsers ? (
                        <button
                            onClick={() => setIsUserModalOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-all cursor-pointer shadow-sm"
                            style={{ backgroundColor: 'var(--brand)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                            <UserPlus size={16} />
                            Add/Import Users
                        </button>
                    ) : (
                        <div
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-not-allowed opacity-50"
                            style={{
                                backgroundColor: 'var(--color-bg-muted)',
                                color: 'var(--color-text-muted)',
                                border: '1px solid var(--color-border-subtle)',
                            }}
                        >
                            <Lock size={16} />
                            Management Locked
                        </div>
                    )}
                </div>
            </div>

            {/* Filters & Search - Glassmorphism-ish bar */}
            <div
                className="flex flex-col md:flex-row items-center gap-4 mb-6 p-2 rounded-xl border bg-white/50 backdrop-blur-sm"
                style={{ borderColor: 'var(--color-border-subtle)' }}
            >
                <div className="relative flex-1 w-full">
                    <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2"
                        size={16}
                        style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                        type="text"
                        placeholder="Search by name, email or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white rounded-lg text-sm font-medium outline-none transition-all flex-1"
                        style={{
                            border: '1px solid var(--color-border-subtle)',
                            color: 'var(--color-text-primary)',
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-subtle)')}
                        disabled={!canManageUsers && filteredUsers.length === 0}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto shrink-0">
                    <FilterButton label="All Roles" active />
                    <FilterButton label="Active Only" />
                </div>
            </div>

            <UsersTable
                users={filteredUsers}
                canManageUsers={canManageUsers}
                onToggleStatus={handleToggleStatus}
                onDeleteRequest={setUserToDelete}
                onRoleChange={handleRoleChange}
            />

            <UserManagementModal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                orgName={siteConfig.adminSettingsOrgName}
                onImport={(data: any[]) =>
                    setUsers((prev) => {
                        const incomingEmails = new Set(
                            data.map((item) => String(item.email || '').toLowerCase()).filter(Boolean),
                        );
                        return [
                            ...data,
                            ...prev.filter((item) => !incomingEmails.has(String(item.email || '').toLowerCase())),
                        ];
                    })
                }
            />

            <DeleteUserModal user={userToDelete} onClose={() => setUserToDelete(null)} onConfirm={handleDelete} />
        </div>
    );
}

function FilterButton({ label, active = false }: { label: string; active?: boolean }) {
    return (
        <button
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer"
            style={{
                backgroundColor: active ? 'white' : 'transparent',
                borderColor: active ? 'var(--color-border-brand)' : 'var(--color-border-subtle)',
                color: active ? 'var(--brand)' : 'var(--color-text-secondary)',
            }}
            onMouseEnter={(e) => {
                if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                    e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                }
            }}
            onMouseLeave={(e) => {
                if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                }
            }}
        >
            <ListFilter size={14} className={active ? '' : 'opacity-60'} />
            {label}
        </button>
    );
}
