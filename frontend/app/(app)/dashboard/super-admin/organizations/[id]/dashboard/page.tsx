'use client';
import React, { useEffect, useState } from 'react';
import AdminDashboardView from '@/app/components/Features/Admin/AdminDashboardView';
import { SuperAdminService } from '@/services/api/SuperAdminService';
import { AdminService } from '@/services/api/AdminService';
import OrgControlsSkeleton from '@/app/components/Skeletons/OrgControlsSkeleton';

type PlanType = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

type OrgUser = {
    role?: string;
};

type LimitState = {
    students: number;
    courses: number;
    storageMb: number;
    seats: number;
    maxAdminSeats: number;
};

type LimitField = keyof LimitState;

const limitFields: Array<{ key: LimitField; label: string }> = [
    { key: 'students', label: 'Students' },
    { key: 'courses', label: 'Courses' },
    { key: 'storageMb', label: 'Storage (MB)' },
    { key: 'seats', label: 'Team Seats' },
    { key: 'maxAdminSeats', label: 'Admin Seats' },
];

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) return error.message;
    return 'Request failed';
};

export default function SuperAdminOrganizationDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const [loading, setLoading] = useState(true);
    const [savingPlan, setSavingPlan] = useState(false);
    const [savingLimits, setSavingLimits] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<PlanType>('FREE');
    const [limits, setLimits] = useState({
        students: 0,
        courses: 0,
        storageMb: 0,
        seats: 0,
        maxAdminSeats: 1,
    });
    const [usage, setUsage] = useState({
        users: 0,
        admins: 0,
        courses: 0,
        exams: 0,
    });

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const [org, users, courses, exams] = await Promise.all([
                    SuperAdminService.getOrganization(id),
                    AdminService.getUsers(id),
                    AdminService.getCourses(id),
                    AdminService.getExams(id),
                ]);

                if (!mounted) return;

                const orgPlan = (org?.plan || 'FREE') as PlanType;
                const orgLimits = org?.limits || {};

                setOrgName(org?.name || 'Organization');
                setSelectedPlan(orgPlan);
                setLimits({
                    students: Number(orgLimits?.students || 0),
                    courses: Number(orgLimits?.courses || 0),
                    storageMb: Number(orgLimits?.storageMb || 0),
                    seats: Number(orgLimits?.seats || 0),
                    maxAdminSeats: Number(org?.maxAdminSeats || 1),
                });
                const typedUsers: OrgUser[] = Array.isArray(users) ? users : [];
                setUsage({
                    users: typedUsers.length,
                    admins: typedUsers.filter((user) => user.role === 'ADMIN').length,
                    courses: Array.isArray(courses) ? courses.length : 0,
                    exams: Array.isArray(exams) ? exams.length : 0,
                });
            } catch (error) {
                console.error('[SuperAdminOrganizationDashboard] Failed to load organization controls', error);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();

        return () => {
            mounted = false;
        };
    }, [id]);

    const savePlan = async () => {
        try {
            setSavingPlan(true);
            await SuperAdminService.updateOrganizationPlan(id, selectedPlan);
            alert('Plan updated successfully');
        } catch (error: unknown) {
            alert(getErrorMessage(error) || 'Failed to update plan');
        } finally {
            setSavingPlan(false);
        }
    };

    const saveLimits = async () => {
        try {
            setSavingLimits(true);
            await SuperAdminService.updateOrganizationLimits(id, {
                students: Number(limits.students),
                courses: Number(limits.courses),
                storageMb: Number(limits.storageMb),
                seats: Number(limits.seats),
                maxAdminSeats: Number(limits.maxAdminSeats),
            });
            alert('Limits updated successfully');
        } catch (error: unknown) {
            alert(getErrorMessage(error) || 'Failed to update limits');
        } finally {
            setSavingLimits(false);
        }
    };

    if (loading) {
        return <OrgControlsSkeleton />;
    }

    return (
        <div className="space-y-6">
            <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-8">
                <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Organization Controls</h2>
                            <p className="text-xs font-bold text-slate-400 mt-1">{orgName}</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                            <div className="bg-slate-50 rounded-xl px-3 py-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Users</p>
                                <p className="text-sm font-black text-slate-700">{usage.users}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl px-3 py-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Admins
                                </p>
                                <p className="text-sm font-black text-slate-700">{usage.admins}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl px-3 py-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Courses
                                </p>
                                <p className="text-sm font-black text-slate-700">{usage.courses}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl px-3 py-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exams</p>
                                <p className="text-sm font-black text-slate-700">{usage.exams}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-100 p-4">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3">
                                Plan Management
                            </h3>
                            <select
                                value={selectedPlan}
                                onChange={(e) => setSelectedPlan(e.target.value as PlanType)}
                                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                            >
                                <option value="FREE">FREE</option>
                                <option value="STARTER">STARTER</option>
                                <option value="PRO">PRO</option>
                                <option value="ENTERPRISE">ENTERPRISE</option>
                            </select>
                            <button
                                onClick={savePlan}
                                disabled={savingPlan}
                                className="mt-3 w-full h-10 rounded-xl bg-[var(--brand)] text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
                            >
                                {savingPlan ? 'Saving Plan...' : 'Save Plan'}
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-100 p-4">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3">
                                Limits & Seats
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {limitFields.map((field) => (
                                    <label key={field.key} className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {field.label}
                                        </span>
                                        <input
                                            type="number"
                                            min={field.key === 'maxAdminSeats' ? 1 : -1}
                                            value={limits[field.key]}
                                            onChange={(e) =>
                                                setLimits((prev) => ({
                                                    ...prev,
                                                    [field.key]: Number(e.target.value),
                                                }))
                                            }
                                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                                        />
                                    </label>
                                ))}
                            </div>
                            <button
                                onClick={saveLimits}
                                disabled={savingLimits}
                                className="mt-3 w-full h-10 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
                            >
                                {savingLimits ? 'Saving Limits...' : 'Save Limits'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <AdminDashboardView basePath={`/dashboard/super-admin/organizations/${id}`} organizationId={id} />
        </div>
    );
}
