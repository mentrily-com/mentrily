'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { BookOpen, Eye, Lock, Pencil, Send, Activity, BarChart3 } from 'lucide-react';
import ExamDetailsModal from '@/app/components/Features/Exams/ExamDetailsModal';
import ExamInviteModal from '@/app/components/Features/Exams/ExamInviteModal';
import ExamCalendarView from '@/app/components/Features/Exams/ExamCalendarView';
import { TeacherService } from '@/services/api/TeacherService';
import { AuthService } from '@/services/api/AuthService';
import { usePlan } from '@/hooks/usePlan';

export default function TeacherExamsPage() {
    const { role } = usePlan();
    const [activeTab, setActiveTab] = useState('all');
    const [viewingExam, setViewingExam] = useState<any>(null);
    const [invitingExam, setInvitingExam] = useState<any | null>(null);
    const [exams, setExams] = useState<any[]>([]);
    const [scheduledExams, setScheduledExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        let alive = true;

        void AuthService.checkSession().then((user) => {
            if (alive) setUserData(user);
        });

        const load = async (showLoader = false) => {
            if (showLoader) setLoading(true);
            try {
                const [data, scheduled] = await Promise.all([
                    TeacherService.getExams(),
                    TeacherService.getScheduledExams(),
                ]);
                if (!alive) return;
                setExams(data);
                setScheduledExams(scheduled);
                setViewingExam((prev: any) => {
                    if (!prev) return prev;
                    return data.find((exam: any) => exam.id === prev.id) || prev;
                });
            } catch (error) {
                console.error(error);
            } finally {
                if (showLoader && alive) setLoading(false);
            }
        };

        void load(true);
        const interval = setInterval(() => void load(false), 30 * 1000);

        return () => {
            alive = false;
            clearInterval(interval);
        };
    }, []);

    const orgPermissions = userData?.features || { allowAppExams: true };
    const canCreateExams = orgPermissions?.canCreateExams !== false;
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';

    const filteredExams = exams.filter((exam) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'standalone') return !exam.linkedCourseId && !exam.linkedCourse;
        if (activeTab === 'course-linked') return exam.linkedCourseId || exam.linkedCourse;
        if (activeTab === 'live') return exam.isActive;
        if (activeTab === 'draft') return !exam.isActive;
        return true;
    });
    const standaloneExams = filteredExams.filter((exam) => !exam.linkedCourseId && !exam.linkedCourse);
    const courseLinkedExams = filteredExams.filter((exam) => exam.linkedCourseId || exam.linkedCourse);

    return (
        <div className="animate-fade-in pb-10 font-sans">
            <div className="mb-8 flex flex-col justify-between gap-4 md:mb-12 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800">Exam Management</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Create, monitor and evaluate standalone exams and course assessments.
                    </p>
                </div>
                {canCreateExams ? (
                    <Link
                        href="/dashboard/creator/exams/new"
                        className="w-full cursor-pointer rounded-2xl bg-[var(--brand)] px-6 py-3.5 text-center text-sm font-black text-white shadow-xl shadow-[var(--brand)]/20 transition-all hover:brightness-110 sm:w-auto sm:px-8 sm:py-4"
                    >
                        New Examination
                    </Link>
                ) : (
                    <div className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-slate-100 px-6 py-3.5 text-sm font-black text-slate-400 opacity-50 sm:w-auto sm:px-8 sm:py-4">
                        <Lock size={18} />
                        Creation Locked
                    </div>
                )}
            </div>

            <div className="mb-8 grid grid-cols-2 gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm sm:mb-10 sm:flex sm:items-center sm:gap-3 sm:overflow-x-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                <TabItem
                    active={activeTab === 'all'}
                    onClick={() => setActiveTab('all')}
                    label="All Exams"
                    count={exams.length}
                />
                <TabItem
                    active={activeTab === 'standalone'}
                    onClick={() => setActiveTab('standalone')}
                    label="Live Exams"
                    count={exams.filter((exam) => !exam.linkedCourseId && !exam.linkedCourse).length}
                />
                <TabItem
                    active={activeTab === 'course-linked'}
                    onClick={() => setActiveTab('course-linked')}
                    label="Course Linked"
                    count={exams.filter((exam) => exam.linkedCourseId || exam.linkedCourse).length}
                />
                <TabItem
                    active={activeTab === 'live'}
                    onClick={() => setActiveTab('live')}
                    label="Live Now"
                    count={exams.filter((exam) => exam.isActive).length}
                />
                <TabItem
                    active={activeTab === 'draft'}
                    onClick={() => setActiveTab('draft')}
                    label="Drafts"
                    count={exams.filter((exam) => !exam.isActive).length}
                />
                <TabItem
                    active={activeTab === 'calendar'}
                    onClick={() => setActiveTab('calendar')}
                    label="Calendar"
                    count={scheduledExams.length}
                />
            </div>

            {activeTab === 'calendar' ? (
                <ExamCalendarView exams={scheduledExams} />
            ) : loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <DashboardSkeleton type="list" userRole={dashboardRole} noNavbar />
                </div>
            ) : filteredExams.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center font-black uppercase tracking-widest text-slate-400 shadow-sm">
                    No Exams Found
                </div>
            ) : (
                <div className="space-y-7">
                    {activeTab !== 'course-linked' ? (
                        <ExamSection
                            title="Live Exams"
                            description="Standalone exams with invite, monitor, schedule, and test-code authentication."
                            exams={standaloneExams}
                            emptyLabel="No standalone exams match this filter"
                            onView={setViewingExam}
                            onInvite={setInvitingExam}
                        />
                    ) : null}
                    {activeTab !== 'standalone' ? (
                        <ExamSection
                            title="Course Linked Exams"
                            description="Assessments attached to courses. Learners open these from the course without exam-login."
                            exams={courseLinkedExams}
                            emptyLabel="No course-linked exams match this filter"
                            linked
                            onView={setViewingExam}
                            onInvite={setInvitingExam}
                        />
                    ) : null}
                </div>
            )}

            {viewingExam && (
                <ExamDetailsModal exam={viewingExam} onClose={() => setViewingExam(null)} userRole={dashboardRole} />
            )}
            <ExamInviteModal isOpen={!!invitingExam} onClose={() => setInvitingExam(null)} exam={invitingExam} />
        </div>
    );
}

function ExamSection({
    title,
    description,
    exams,
    emptyLabel,
    linked = false,
    onView,
    onInvite,
}: {
    title: string;
    description: string;
    exams: any[];
    emptyLabel: string;
    linked?: boolean;
    onView: (exam: any) => void;
    onInvite: (exam: any) => void;
}) {
    return (
        <section
            className={`overflow-hidden rounded-3xl border shadow-sm ${linked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}
        >
            <div className="flex flex-col justify-between gap-3 border-b border-black/5 px-6 py-5 sm:flex-row sm:items-center sm:px-8">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-black text-slate-900">{title}</h2>
                        <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${linked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                            {exams.length}
                        </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500">{description}</p>
                </div>
            </div>

            {exams.length === 0 ? (
                <div className="p-10 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                    {emptyLabel}
                </div>
            ) : (
                <>
                    <table className="hidden w-full text-left md:table">
                        <thead>
                            <tr className="border-b border-slate-100 bg-white/60">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Exam Details
                                </th>
                                <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Questions
                                </th>
                                <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Status
                                </th>
                                <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {exams.map((exam) => (
                                <ExamRow
                                    key={exam.id}
                                    exam={exam}
                                    linked={linked}
                                    onView={onView}
                                    onInvite={onInvite}
                                />
                            ))}
                        </tbody>
                    </table>
                    <div className="divide-y divide-slate-100 md:hidden">
                        {exams.map((exam) => (
                            <ExamMobileCard
                                key={exam.id}
                                exam={exam}
                                linked={linked}
                                onView={onView}
                                onInvite={onInvite}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}

function ExamRow({
    exam,
    linked,
    onView,
    onInvite,
}: {
    exam: any;
    linked: boolean;
    onView: (exam: any) => void;
    onInvite: (exam: any) => void;
}) {
    return (
        <tr className="group transition-colors hover:bg-white/70">
            <td className="px-8 py-6">
                <ExamIdentity exam={exam} linked={linked} />
            </td>
            <td className="px-8 py-6 text-center">
                <ExamMeta exam={exam} />
            </td>
            <td className="px-8 py-6">
                <div className="flex justify-center">
                    <StatusBadge status={exam.isActive ? 'Published' : 'Draft'} />
                </div>
            </td>
            <td className="px-8 py-6 text-right">
                <ExamActions exam={exam} linked={linked} onView={onView} onInvite={onInvite} />
            </td>
        </tr>
    );
}

function ExamMobileCard({
    exam,
    linked,
    onView,
    onInvite,
}: {
    exam: any;
    linked: boolean;
    onView: (exam: any) => void;
    onInvite: (exam: any) => void;
}) {
    return (
        <article className="p-4">
            <div className="flex items-start justify-between gap-3">
                <ExamIdentity exam={exam} linked={linked} />
                <StatusBadge status={exam.isActive ? 'Published' : 'Draft'} />
            </div>
            <div className="mt-4 rounded-2xl bg-white/70 p-3">
                <ExamMeta exam={exam} />
            </div>
            <div className="mt-4">
                <ExamActions exam={exam} linked={linked} onView={onView} onInvite={onInvite} mobile />
            </div>
        </article>
    );
}

function ExamIdentity({ exam, linked }: { exam: any; linked: boolean }) {
    const courseTitle = exam.linkedCourse?.title || exam.linkedCourseTitle || 'Linked course';

    return (
        <div className="min-w-0">
            <p className="text-base font-black text-slate-800">{exam.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{exam.slug}</span>
                {linked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                        <BookOpen size={11} /> Course Linked: {courseTitle}
                    </span>
                ) : exam.testCode ? (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">
                        <Lock size={10} /> {exam.testCode}
                    </span>
                ) : null}
                {exam.examMode && !linked ? (
                    <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${exam.examMode === 'App' ? 'bg-indigo-50 text-indigo-500' : 'bg-blue-50 text-blue-500'}`}
                    >
                        {exam.examMode}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

function ExamMeta({ exam }: { exam: any }) {
    return (
        <div>
            <div className="text-sm font-black text-slate-700">
                {Array.isArray(exam.questions) ? exam.questions.length : 0} Sections
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">{exam.duration ?? '-'} mins</span>
                {exam.totalMarks ? (
                    <span className="text-[10px] font-black text-[var(--brand)]">{exam.totalMarks} Marks</span>
                ) : null}
            </div>
        </div>
    );
}

function ExamActions({
    exam,
    linked,
    mobile = false,
    onView,
    onInvite,
}: {
    exam: any;
    linked: boolean;
    mobile?: boolean;
    onView: (exam: any) => void;
    onInvite: (exam: any) => void;
}) {
    const editHref =
        linked && exam.linkedCourseId
            ? `/dashboard/creator/exams/${exam.id}/edit?courseId=${exam.linkedCourseId}`
            : `/dashboard/creator/exams/${exam.id}/edit`;

    return (
        <div className={`grid gap-2 ${mobile ? 'grid-cols-2' : 'grid-cols-4 md:flex md:items-center md:justify-end'}`}>
            <ExamAction onClick={() => onView(exam)} label="View" icon={<Eye size={14} strokeWidth={2.5} />} />
            {!linked ? (
                <ExamAction
                    onClick={() => onInvite(exam)}
                    label="Invite"
                    variant="brand"
                    icon={<Send size={14} strokeWidth={2.5} />}
                />
            ) : null}
            <Link href={editHref}>
                <ExamAction label="Edit" variant="brand" icon={<Pencil size={14} strokeWidth={2.5} />} />
            </Link>
            <Link href={`/dashboard/creator/exams/${exam.id}/monitor`}>
                <ExamAction
                    label="Monitor"
                    variant="accent"
                    active={exam.isActive}
                    icon={<Activity size={14} strokeWidth={2.5} />}
                />
            </Link>
            <Link className={mobile ? 'col-span-2' : ''} href={`/dashboard/creator/exams/${exam.id}/results`}>
                <ExamAction label="Results" variant="success" icon={<BarChart3 size={14} strokeWidth={2.5} />} />
            </Link>
        </div>
    );
}

function TabItem({ active, onClick, label, count }: any) {
    return (
        <button
            onClick={onClick}
            className={`relative flex cursor-pointer items-center justify-between gap-2 whitespace-nowrap rounded-2xl px-3 py-3 transition-all sm:justify-start sm:border-b-[3px] sm:rounded-none sm:px-0 sm:pb-4 sm:pt-0 sm:gap-3 ${active ? 'bg-[var(--brand-light)] text-slate-900 sm:border-[var(--brand)] sm:bg-transparent' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 sm:border-transparent sm:hover:bg-transparent'}`}
        >
            <span className="text-xs font-black uppercase tracking-widest sm:text-sm">{label}</span>
            <span
                className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${active ? 'bg-white text-[var(--brand)] sm:bg-[var(--brand-light)]' : 'bg-slate-50 text-slate-400'}`}
            >
                {count}
            </span>
        </button>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: any = {
        Published: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        Draft: 'bg-slate-50 text-slate-400 border-slate-100',
    };
    return (
        <span
            className={`rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${styles[status]}`}
        >
            {status}
        </span>
    );
}

function ExamAction({ label, icon, active, variant = 'default', onClick }: any) {
    const variants: any = {
        default: 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600',
        brand: 'bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white',
        accent: 'bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white',
        success: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/5 px-3 py-2.5 shadow-sm transition-all sm:w-auto sm:px-4 sm:py-2 ${active ? 'border-transparent bg-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/20' : variants[variant]}`}
        >
            {icon}
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );
}
