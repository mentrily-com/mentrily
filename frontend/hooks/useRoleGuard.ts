"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/services/api/AuthService";

function hasAllowedRole(user: any, allowedRoles: string[]): boolean {
    if (!user) return false;
    if (!allowedRoles.length) return true;
    return allowedRoles.includes(user.role);
}

export function useRoleGuard(allowedRoles: string[]) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(() => {
        if (typeof window === 'undefined') return false;
        const user = AuthService.getUser();
        return hasAllowedRole(user, allowedRoles);
    });

    useEffect(() => {
        // Soft check only - strict check matches happen via API cookies
        const user = AuthService.getUser();
        const role = user?.role;

        if (!user) {
            setIsAuthorized(false);
            router.push("/login");
            return;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
            setIsAuthorized(false);
            // Redirect to their own dashboard if they try to access another one
            if (role === 'STUDENT') router.push("/dashboard/student");
            else if (role === 'TEACHER') router.push("/dashboard/teacher");
            else if (role === 'ADMIN') router.push("/dashboard/admin");
            else if (role === 'SUPER_ADMIN') router.push("/dashboard/super-admin");
            else router.push("/login"); // Fallback
            return;
        }

        setIsAuthorized(true);
    }, [allowedRoles, router]);

    return { isAuthorized };
}
