'use client';

import React from 'react';
import Link from 'next/link';
import AdminSettingsSkeleton from '@/app/components/Skeletons/AdminSettingsSkeleton';
import AdminSettingsView from '@/app/components/Features/Admin/AdminSettingsView';
import { AdminService } from '@/services/api/AdminService';
import { useToast } from '@/app/components/Common/Toast';
import { usePlan } from '@/hooks/usePlan';

export default function CreatorSettingsPage() {
    const { success, error } = useToast();
    const { plan, role, loading } = usePlan();
    const [settingsLoading, setSettingsLoading] = React.useState(true);
    const [settingsData, setSettingsData] = React.useState<any>(null);

    React.useEffect(() => {
        if (loading || role !== 'ADMIN' || plan !== 'ENTERPRISE') {
            return;
        }

        let mounted = true;
        const load = async () => {
            setSettingsLoading(true);
            try {
                const data = await AdminService.getSettings();

                if (!mounted) return;

                setSettingsData({
                    name: data?.name || '',
                    subdomain: String(data?.domain || '').split('.')[0] || '',
                    email: data?.contact?.supportEmail || data?.contact?.adminEmail || '',
                    primaryColor: data?.primaryColor || '#008D98',
                    logo: data?.logo || null,
                    permissions: {
                        ...(data?.features || {}),
                        teacherSelfBilling: data?.features?.teacherSelfBilling !== false,
                    },
                });
            } catch (err: any) {
                if (!mounted) return;
                error(err?.message || 'Failed to load settings', 'Settings Error');
            } finally {
                if (mounted) setSettingsLoading(false);
            }
        };

        void load();

        return () => {
            mounted = false;
        };
    }, [error, loading, plan, role]);

    const handleSave = async (updatedData: any) => {
        try {
            const nextFeatures = {
                ...(updatedData?.permissions || {}),
                teacherSelfBilling: updatedData?.permissions?.teacherSelfBilling !== false,
            };

            const updated = await AdminService.updateSettings({
                features: nextFeatures,
                name: updatedData?.name,
                primaryColor: updatedData?.primaryColor,
                logo: updatedData?.logo,
                contact: { supportEmail: updatedData?.email },
            });

            setSettingsData((prev: any) => ({
                ...(prev || {}),
                permissions: {
                    ...(updated?.features || nextFeatures),
                    teacherSelfBilling: updated?.features?.teacherSelfBilling !== false,
                },
            }));

            success('Billing visibility settings updated successfully.', 'Settings Saved');
        } catch (err: any) {
            error(err?.message || 'Failed to save settings', 'Save Failed');
        }
    };

    if (loading) {
        return <AdminSettingsSkeleton />;
    }

    if (plan !== 'ENTERPRISE') {
        return (
            <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
                <main className="max-w-[980px] mx-auto px-6 lg:px-12 py-12">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-10 text-center">
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Enterprise Only</h1>
                        <p className="text-sm font-bold text-slate-500 mt-3">
                            Organization settings are available only on the Enterprise plan.
                        </p>
                        <Link
                            href="/dashboard/creator/billing"
                            className="mt-6 inline-flex rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--brand-dark)]"
                        >
                            View Plans
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    if (role !== 'ADMIN') {
        return (
            <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
                <main className="max-w-[980px] mx-auto px-6 lg:px-12 py-12">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-10 text-center">
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Admin Access Required</h1>
                        <p className="text-sm font-bold text-slate-500 mt-3">
                            Only organization admins can edit organization settings.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    if (settingsLoading) {
        return <AdminSettingsSkeleton />;
    }

    return <AdminSettingsView initialData={settingsData} onSave={handleSave} />;
}
