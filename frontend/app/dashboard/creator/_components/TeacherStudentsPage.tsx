'use client';
import React, { useState, useEffect } from 'react';
import { TeacherService } from '@/services/api/TeacherService';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { useToast } from '@/app/components/Common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { Users, GraduationCap, Search, Filter, Mail, Calendar, Trash2, ClipboardList, Megaphone } from 'lucide-react';
import GroupsTab from '@/app/components/Teacher/GroupsTab';
import AnnouncementsTab from '@/app/components/Teacher/AnnouncementsTab';
import AppModal from '@/app/components/Common/AppModal';

type Tab = 'roster' | 'groups' | 'announcements';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'roster', label: 'Student Roster', icon: <GraduationCap size={15} /> },
    { key: 'groups', label: 'Groups', icon: <Users size={15} /> },
    { key: 'announcements', label: 'Announcements', icon: <Megaphone size={15} /> },
];

export default function TeacherStudentsPage() {
    const { error: toastError } = useToast();
    const [students, setStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<Tab>('roster');

    useEffect(() => {
        async function loadData() {
            try {
                const data = await TeacherService.getStudents();
                setStudents(data);
            } catch (error) {
                console.error('Failed to fetch data', error);
                toastError('Could not load student data');
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [toastError]);

    const filteredStudents = students.filter(
        (st) =>
            st.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            st.course.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
    );

    const handleUnenroll = async (courseId: string, studentId: string) => {
        if (!confirm('Are you sure you want to unenroll this student from the course?')) return;

        try {
            await TeacherService.unenrollStudent(courseId, studentId);

            // Update selected student state immediately
            if (selectedStudent) {
                const updatedCourses = selectedStudent.courses.filter((c: any) => c.id !== courseId);
                setSelectedStudent({ ...selectedStudent, courses: updatedCourses });
            }

            // Refresh the main list
            const data = await TeacherService.getStudents();
            setStudents(data);
        } catch (error) {
            console.error('Failed to unenroll', error);
            toastError('Failed to unenroll student');
        }
    };

    const handlePreviewProgress = (student: any) => {
        setSelectedStudent(student);
    };

    if (isLoading) return <DashboardSkeleton type="list" userRole="teacher" />;

    return (
        <div className="animate-fade-in font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                        Students &amp; Groups
                    </h1>
                    <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Manage students, groups, and announcements.
                    </p>
                </div>
            </div>

            {/* ─── TABS ─── */}
            <div
                className="flex items-center gap-1 mb-8 p-1 w-fit rounded-lg shadow-sm"
                style={{ backgroundColor: 'var(--color-bg-muted)' }}
            >
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === tab.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                        }`}
                        style={{
                            color: activeTab === tab.key ? 'var(--brand)' : 'var(--color-text-muted)',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── GROUPS TAB ─── */}
            {activeTab === 'groups' && <GroupsTab />}

            {/* ─── ANNOUNCEMENTS TAB ─── */}
            {activeTab === 'announcements' && <AnnouncementsTab />}

            {/* ─── ROSTER TAB ─── */}
            {activeTab === 'roster' && (
                <>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div
                                className="bg-white border rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-sm"
                                style={{ borderColor: 'var(--color-border-subtle)' }}
                            >
                                <Users size={18} style={{ color: 'var(--color-text-muted)' }} />
                                <div>
                                    <p
                                        className="text-[10px] font-semibold uppercase tracking-wider leading-none"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        Total Students
                                    </p>
                                    <p
                                        className="text-lg font-bold leading-none mt-1"
                                        style={{ color: 'var(--color-text-primary)' }}
                                    >
                                        {students.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            className="px-5 py-2.5 bg-white border text-xs font-semibold rounded-lg transition-all uppercase tracking-wider shadow-sm cursor-pointer"
                            style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                e.currentTarget.style.color = 'var(--color-text-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                            }}
                        >
                            Export PDF
                        </button>
                    </div>

                    <div
                        className="bg-white rounded-xl border shadow-sm overflow-hidden z-0 relative"
                        style={{ borderColor: 'var(--color-border-subtle)' }}
                    >
                        <div
                            className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b"
                            style={{
                                borderColor: 'var(--color-border-subtle)',
                                backgroundColor: 'var(--color-bg-subtle)',
                            }}
                        >
                            <h3
                                className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                <GraduationCap size={18} style={{ color: 'var(--brand)' }} />
                                Enrolled Students
                            </h3>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:flex-none">
                                    <Search
                                        className="absolute left-3 top-1/2 -translate-y-1/2"
                                        size={16}
                                        style={{ color: 'var(--color-text-muted)' }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Search by name or course..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full md:w-72 pl-10 pr-4 py-2 bg-white border rounded-lg text-xs font-medium outline-none transition-all flex-1"
                                        style={{
                                            borderColor: 'var(--color-border-subtle)',
                                            color: 'var(--color-text-primary)',
                                        }}
                                        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
                                        onBlur={(e) =>
                                            (e.currentTarget.style.borderColor = 'var(--color-border-subtle)')
                                        }
                                    />
                                </div>
                                <button
                                    className="p-2 bg-white border rounded-lg transition-colors cursor-pointer shrink-0"
                                    style={{
                                        borderColor: 'var(--color-border-subtle)',
                                        color: 'var(--color-text-muted)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                        e.currentTarget.style.color = 'var(--brand)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'white';
                                        e.currentTarget.style.color = 'var(--color-text-muted)';
                                    }}
                                >
                                    <Filter size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold tracking-wider"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            Student Profile
                                        </th>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold tracking-wider"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            Primary Course
                                        </th>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold tracking-wider"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            Progress
                                        </th>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold tracking-wider"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            Activity
                                        </th>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold tracking-wider text-right"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredStudents.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-6 py-12 text-center text-sm"
                                                style={{ color: 'var(--color-text-muted)' }}
                                            >
                                                No students found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStudents.map((st) => (
                                            <tr
                                                key={st.id}
                                                className="transition-colors group"
                                                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                                                onMouseEnter={(e) =>
                                                    (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')
                                                }
                                                onMouseLeave={(e) =>
                                                    (e.currentTarget.style.backgroundColor = 'transparent')
                                                }
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                                                            style={{
                                                                backgroundColor: 'var(--color-bg-muted)',
                                                                color: 'var(--color-text-secondary)',
                                                            }}
                                                        >
                                                            {st.name[0]}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p
                                                                className="text-sm font-semibold truncate"
                                                                style={{ color: 'var(--color-text-primary)' }}
                                                            >
                                                                {st.name}
                                                            </p>
                                                            <p
                                                                className="text-[10px] font-medium flex items-center gap-1 uppercase tracking-wider mt-0.5"
                                                                style={{ color: 'var(--color-text-muted)' }}
                                                            >
                                                                <Mail size={10} /> ID: {st.id.substring(0, 8)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className="px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border truncate max-w-full"
                                                        style={{
                                                            backgroundColor:
                                                                st.course !== 'Not Enrolled'
                                                                    ? 'var(--color-bg-blue-tint)'
                                                                    : 'var(--color-bg-muted)',
                                                            borderColor:
                                                                st.course !== 'Not Enrolled'
                                                                    ? 'var(--color-border-brand)'
                                                                    : 'var(--color-border-subtle)',
                                                            color:
                                                                st.course !== 'Not Enrolled'
                                                                    ? 'var(--brand)'
                                                                    : 'var(--color-text-secondary)',
                                                        }}
                                                    >
                                                        {st.course}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="flex-1 max-w-[120px] h-2 rounded-full overflow-hidden"
                                                            style={{ backgroundColor: 'var(--color-bg-muted)' }}
                                                        >
                                                            <div
                                                                className="h-full transition-all duration-1000"
                                                                style={{
                                                                    width: `${st.progress}%`,
                                                                    backgroundColor:
                                                                        st.progress === 100
                                                                            ? '#10B981'
                                                                            : 'var(--brand)',
                                                                }}
                                                            />
                                                        </div>
                                                        <span
                                                            className="text-xs font-semibold"
                                                            style={{ color: 'var(--color-text-secondary)' }}
                                                        >
                                                            {st.progress}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div
                                                        className="flex items-center gap-1 text-[10px] font-semibold uppercase mb-0.5"
                                                        style={{ color: 'var(--color-text-muted)' }}
                                                    >
                                                        <Calendar size={10} /> Updated
                                                    </div>
                                                    <p
                                                        className="text-xs font-medium"
                                                        style={{ color: 'var(--color-text-secondary)' }}
                                                    >
                                                        {st.lastActive}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handlePreviewProgress(st)}
                                                        className="px-4 py-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                                        style={{
                                                            backgroundColor: 'white',
                                                            borderColor: 'var(--color-border-subtle)',
                                                            color: 'var(--color-text-secondary)',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor =
                                                                'var(--color-bg-blue-tint)';
                                                            e.currentTarget.style.borderColor =
                                                                'var(--color-border-brand)';
                                                            e.currentTarget.style.color = 'var(--brand)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'white';
                                                            e.currentTarget.style.borderColor =
                                                                'var(--color-border-subtle)';
                                                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                                                        }}
                                                    >
                                                        Full Progress
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* PREVIEW POPUP */}
            {selectedStudent && (
                <AppModal
                    isOpen={!!selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    title={selectedStudent.name}
                    subtitle={selectedStudent.course}
                    eyebrow="Student Progress"
                    icon={<span className="text-xl font-black">{selectedStudent.name?.[0] || '?'}</span>}
                    size="xl"
                    zIndexClass="z-[1100]"
                    panelClassName="max-w-[860px]"
                >
                    <div className="mb-6 rounded-xl bg-white/70 p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                        <div className="mb-3 flex items-center justify-between gap-4">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Overall Progress
                            </p>
                            <p className="text-sm font-black text-slate-900">{selectedStudent.progress}%</p>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80">
                            <div
                                className="h-full rounded-full bg-[var(--brand)] transition-all duration-700"
                                style={{ width: `${selectedStudent.progress}%` }}
                            />
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-800">
                            Course Progress
                        </h4>
                        <div className="space-y-3">
                            {selectedStudent.courses && selectedStudent.courses.length > 0 ? (
                                selectedStudent.courses.map((course: any) => (
                                    <div
                                        key={course.id}
                                        className="rounded-xl bg-white/90 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] group/course"
                                    >
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[var(--brand)]">
                                                    <BookOpen size={22} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="truncate text-sm font-black leading-tight text-slate-800">
                                                        {course.title}
                                                    </h4>
                                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                        {course.completedUnits}/{course.totalUnits} Units Completed
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleUnenroll(course.id, selectedStudent.id)}
                                                className="rounded-xl p-2 text-slate-300 transition-all hover:bg-rose-50 hover:text-rose-500 sm:opacity-0 sm:group-hover/course:opacity-100"
                                                title="Unenroll Student"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                                                <div
                                                    className="h-full rounded-full bg-[var(--brand)] transition-all duration-1000"
                                                    style={{ width: `${course.progress}%` }}
                                                />
                                            </div>
                                            <span className="w-10 text-right text-xs font-black text-slate-600">
                                                {course.progress}%
                                            </span>
                                        </div>
                                        {course.tests && course.tests.length > 0 && (
                                            <div className="mt-4 border-t border-slate-200 pt-4">
                                                <p className="mb-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    <ClipboardList size={10} /> Test Scores
                                                </p>
                                                <div className="space-y-1.5">
                                                    {course.tests.map((test: any) => (
                                                        <div
                                                            key={test.id}
                                                            className="flex items-center justify-between"
                                                        >
                                                            <span className="max-w-[60%] truncate text-[11px] font-bold text-slate-500">
                                                                {test.title}
                                                            </span>
                                                            {test.attempted ? (
                                                                <span
                                                                    className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${test.score >= 70 ? 'bg-emerald-50 text-emerald-600' : test.score >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-500'}`}
                                                                >
                                                                    {test.correctAnswers}/{test.totalQuestions} &nbsp;(
                                                                    {test.score}%)
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] font-bold text-slate-300 px-2 py-0.5 rounded-lg bg-slate-50">
                                                                    Not attempted
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-xl bg-white p-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                                    <p className="text-sm font-bold text-slate-500">
                                        No courses enrolled under your management.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </AppModal>
            )}
        </div>
    );
}

function BookOpen({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    );
}
