'use client';
import React from 'react';
import Navbar from '@/app/components/Navbar';
import { useSession } from '@/hooks/useSession';
import { usePathname } from 'next/navigation';

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
    const { data: sessionUser } = useSession();
    const pathname = usePathname();

    const role = React.useMemo(() => {
        const backendRole = String(sessionUser?.role || '').toUpperCase();
        if (backendRole === 'STUDENT' || backendRole === 'LEARNER') return 'student';
        if (backendRole === 'TEACHER') return 'teacher';
        if (backendRole === 'ADMIN') return 'admin';
        if (backendRole === 'SUPER_ADMIN') return 'super-admin';
        return null;
    }, [sessionUser?.role]);

    if (pathname?.startsWith('/playground/q') || role !== 'student') {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
            <Navbar userRole="student" />
            <main className="flex-1 min-h-0 flex">
                <div className="flex-1 min-h-0 w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
