'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminService } from '@/services/api/AdminService';
import { AuthService } from '@/services/api/AuthService';

export default function StorageLeaderboard() {
    const { data: users, isLoading, error } = useQuery({
        queryKey: ['storage-leaderboard'],
        queryFn: async () => {
            const session = await AuthService.checkSession();
            const orgId = String(session?.orgId || '').trim();
            const response = await AdminService.getStorageUsers(orgId);
            return Array.isArray(response) ? response : response?.data || response?.users || [];
        },
    });

    if (isLoading) {
        return <div className="text-sm font-medium text-slate-500 animate-pulse py-4">Loading storage leaderboard...</div>;
    }

    if (error) {
        return <div className="text-sm text-red-500 font-medium py-4">Failed to load storage leaderboard.</div>;
    }

    if (!users || users.length === 0) {
        return <div className="text-sm text-slate-500 py-4">No storage data found.</div>;
    }

    const formatBytes = (bytes: number) => {
        if (!bytes || isNaN(bytes)) return '0 B';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                    <tr className="border-b border-slate-100">
                        <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">User Name</th>
                        <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
                        <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Storage Used</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((item: any, index: number) => (
                        <tr key={item.userId || index} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 text-sm font-bold text-slate-800">{item.user?.name || item.name || 'Unknown User'}</td>
                            <td className="py-3 text-sm font-medium text-slate-500">{item.user?.email || item.email || 'N/A'}</td>
                            <td className="py-3 text-sm font-black text-slate-700 text-right">{formatBytes(Number(item.totalBytes || item.totalSizeBytes || 0))}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
