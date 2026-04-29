"use client";
import React from "react";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import DashboardSkeleton from "@/app/components/Skeletons/DashboardSkeleton";
import Navbar from "@/app/components/Navbar";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const { isAuthorized, isReady } = useRoleGuard(['STUDENT']);

    if (!isReady || !isAuthorized) {
        return (
            <div className="min-h-screen bg-[#F8FAFC]">
                <Navbar userRole="student" />
                <DashboardSkeleton type="main" userRole="student" noNavbar />
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Navbar userRole="student" />
            {children}
        </div>
    );
}
