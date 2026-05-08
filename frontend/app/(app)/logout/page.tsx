'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import Loading from '../loading';
import { AuthService } from '@/services/api/AuthService';

export default function LogoutPage() {
    const router = useRouter();
    const { signOut } = useClerk();
    const queryClient = useQueryClient();

    useEffect(() => {
        const doLogout = async () => {
            try {
                AuthService.resetSessionCache();
                localStorage.removeItem('user-role');
                queryClient.removeQueries({ queryKey: ['session'] });
                queryClient.clear();
                await signOut({ redirectUrl: '/login' });
            } catch {
                router.replace('/login');
            }
        };

        void doLogout();
    }, [router, signOut, queryClient]);

    return <Loading />;
}
