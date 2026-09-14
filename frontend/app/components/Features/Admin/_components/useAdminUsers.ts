'use client';
import { useMemo, useState } from 'react';
import { AdminService } from '@/services/api/AdminService';
import { useSession } from '@/hooks/useSession';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/app/components/Common/Toast';

export function useAdminUsers(organizationId?: string) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<any | null>(null);
    const { session } = useSession();
    const queryClient = useQueryClient();
    const { success, error: toastError } = useToast();

    const queryKey = ['admin-users', organizationId || session?.orgId || 'current'];

    const { data: usersData, isLoading } = useQuery({
        queryKey,
        queryFn: () => AdminService.getUsers(organizationId),
        staleTime: 30_000,
        gcTime: 5 * 60_000,
    });

    const [localOverrides, setLocalOverrides] = useState<Record<string, any>>({});

    const users = useMemo(() => {
        const base = Array.isArray(usersData) ? usersData : [];
        return base
            .filter((u: any) => localOverrides[u.id]?.deleted !== true)
            .map((u: any) => ({
                ...u,
                ...(localOverrides[u.id] || {}),
            }));
    }, [usersData, localOverrides]);

    const setUsers = (updater: any[] | ((prev: any[]) => any[])) => {
        if (typeof updater === 'function') {
            const next = updater(users);
            queryClient.setQueryData(queryKey, next);
        } else {
            queryClient.setQueryData(queryKey, updater);
        }
    };

    const userData = session;
    const canManageUsers = userData?.features?.canManageUsers !== false;
    const loading = isLoading && users.length === 0;

    const filteredUsers = useMemo(
        () =>
            users.filter(
                (user: any) =>
                    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    user.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    user.rollNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    user.department?.toLowerCase().includes(searchQuery.toLowerCase()),
            ),
        [users, searchQuery],
    );

    const handleToggleStatus = async (user: any) => {
        if (!canManageUsers) return;
        setLocalOverrides((prev) => ({
            ...prev,
            [user.id]: { ...(prev[user.id] || {}), isActive: !user.isActive },
        }));
        try {
            await AdminService.toggleUserStatus(user.id);
            await queryClient.invalidateQueries({ queryKey });
            success(`User ${!user.isActive ? 'activated' : 'suspended'} successfully`, 'Status Updated');
        } catch (error: any) {
            setLocalOverrides((prev) => {
                const next = { ...prev };
                delete next[user.id];
                return next;
            });
            toastError(error.message || 'Failed to update status', 'Error');
        }
    };

    const handleDelete = async (id: string) => {
        setLocalOverrides((prev) => ({
            ...prev,
            [id]: { ...(prev[id] || {}), deleted: true },
        }));
        try {
            const result = await AdminService.deleteUser(id);
            setUserToDelete(null);
            await queryClient.invalidateQueries({ queryKey });
            success(
                result?.accountDeleted === false ? 'User removed from this organization' : 'User deleted successfully',
                'Cleanup Process',
            );
        } catch (error: any) {
            setLocalOverrides((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            toastError(error.message || 'Failed to delete user', 'Error');
        }
    };

    const handleRoleChange = async (user: any, role: string) => {
        if (!canManageUsers || user.role === role) return;
        const previousRole = user.role;
        setLocalOverrides((prev) => ({
            ...prev,
            [user.id]: { ...(prev[user.id] || {}), role },
        }));
        try {
            await AdminService.updateUserRole(user.id, role);
            await queryClient.invalidateQueries({ queryKey });
            success(`Role updated to ${role.charAt(0)}${role.slice(1).toLowerCase()}`, 'Role Updated');
        } catch (error: any) {
            setLocalOverrides((prev) => ({
                ...prev,
                [user.id]: { ...(prev[user.id] || {}), role: previousRole },
            }));
            toastError(error.message || 'Failed to update role', 'Error');
        }
    };

    return {
        searchQuery,
        setSearchQuery,
        isUserModalOpen,
        setIsUserModalOpen,
        userToDelete,
        setUserToDelete,
        users,
        setUsers,
        canManageUsers,
        filteredUsers,
        handleToggleStatus,
        handleDelete,
        handleRoleChange,
        loading,
    };
}
