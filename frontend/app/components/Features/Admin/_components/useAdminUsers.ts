'use client';
import { useEffect, useMemo, useState } from 'react';
import { AdminService } from '@/services/api/AdminService';
import { AuthService } from '@/services/api/AuthService';
import { useToast } from '@/app/components/Common/Toast';

export function useAdminUsers(organizationId?: string) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<any | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { success, error: toastError } = useToast();

    useEffect(() => {
        async function load() {
            try {
                const [user, data] = await Promise.all([
                    AuthService.checkSession(),
                    AdminService.getUsers(organizationId),
                ]);
                setUserData(user);
                setUsers(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, [organizationId]);

    const canManageUsers = userData?.features?.canManageUsers !== false;
    const filteredUsers = useMemo(
        () =>
            users.filter(
                (user) =>
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
        try {
            await AdminService.toggleUserStatus(user.id);
            setUsers((prev) =>
                prev.map((item) => (item.id === user.id ? { ...item, isActive: !item.isActive } : item)),
            );
            success(`User ${!user.isActive ? 'activated' : 'suspended'} successfully`, 'Status Updated');
        } catch (error: any) {
            toastError(error.message || 'Failed to update status', 'Error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await AdminService.deleteUser(id);
            setUsers((prev) => prev.filter((user) => user.id !== id));
            setUserToDelete(null);
            success(
                result?.accountDeleted === false ? 'User removed from this organization' : 'User deleted successfully',
                'Cleanup Process',
            );
        } catch (error: any) {
            toastError(error.message || 'Failed to delete user', 'Error');
        }
    };

    const handleRoleChange = async (user: any, role: string) => {
        if (!canManageUsers || user.role === role) return;
        const previousRole = user.role;
        setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, role } : item)));
        try {
            await AdminService.updateUserRole(user.id, role);
            success(`Role updated to ${role.charAt(0)}${role.slice(1).toLowerCase()}`, 'Role Updated');
        } catch (error: any) {
            setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, role: previousRole } : item)));
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
