'use client';
import Link from 'next/link';
import { Search, Eye, Pencil, UserPlus, Lock, Plus, ClipboardList, Award } from 'lucide-react';

interface StudioModuleListProps {
    modules: any[];
    tab: 'Published' | 'Draft';
    searchQuery: string;
    canCreateCourses: boolean;
    onTabChange: (tab: 'Published' | 'Draft') => void;
    onSearchChange: (value: string) => void;
    onViewCourse: (course: any) => void;
    onOpenEnrollment: (course: any) => void;
}

export default function StudioModuleList({
    modules,
    tab,
    searchQuery,
    canCreateCourses,
    onTabChange,
    onSearchChange,
    onViewCourse,
    onOpenEnrollment,
}: StudioModuleListProps) {
    return (
        <div className="flex-1 min-w-0">
            {/* ── Header ── */}
            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                    My Modules
                </h2>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    {/* Search */}
                    <div className="relative w-full sm:w-auto">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Search modules..."
                            className="w-full pl-9 pr-4 py-2 bg-white border rounded-lg text-sm font-medium outline-none transition-all focus-ring sm:w-56"
                            style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
                        />
                        <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-text-muted)' }}
                        />
                    </div>
                    {/* Create button */}
                    {canCreateCourses ? (
                        <Link
                            href="/dashboard/creator/courses/create"
                            data-element-id="create-course-btn"
                            className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all cursor-pointer sm:w-auto"
                            style={{ backgroundColor: 'var(--brand)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                            <Plus size={16} />
                            Create New Module
                        </Link>
                    ) : (
                        <div
                            className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-not-allowed opacity-50 sm:w-auto"
                            style={{
                                backgroundColor: 'var(--color-bg-muted)',
                                color: 'var(--color-text-muted)',
                                border: '1px solid var(--color-border-subtle)',
                            }}
                        >
                            <Lock size={14} />
                            Creation Locked
                        </div>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div
                className="flex w-full gap-1 mb-5 p-1 rounded-lg sm:w-fit"
                style={{ backgroundColor: 'var(--color-bg-muted)' }}
            >
                <button
                    className={`flex-1 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer sm:flex-none ${
                        tab === 'Published'
                            ? 'bg-white text-[var(--brand)] shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    onClick={() => onTabChange('Published')}
                >
                    Published
                </button>
                <button
                    className={`flex-1 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer sm:flex-none ${
                        tab === 'Draft'
                            ? 'bg-white text-[var(--brand)] shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                    }`}
                    onClick={() => onTabChange('Draft')}
                >
                    Drafts
                </button>
            </div>

            {/* ── Module List ── */}
            <div className="space-y-3">
                {modules.length === 0 ? (
                    <div
                        className="text-sm font-medium py-12 text-center rounded-xl"
                        style={{
                            color: 'var(--color-text-muted)',
                            backgroundColor: 'var(--color-bg-subtle)',
                            border: '1px dashed var(--color-border-subtle)',
                        }}
                    >
                        No {tab === 'Published' ? 'published' : 'draft'} modules found.
                    </div>
                ) : (
                    modules.map((module) => (
                        <div
                            key={module.slug}
                            className="bg-white rounded-xl border p-5 transition-all duration-200 hover:shadow-md cursor-default"
                            style={{ borderColor: 'var(--color-border-subtle)' }}
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                                        <h3
                                            className="min-w-0 text-sm font-semibold sm:truncate"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            {module.title}
                                        </h3>
                                        <span
                                            className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                                module.status === 'Published'
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}
                                        >
                                            {module.status}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                        {module.students} Students Enrolled • Updated {module.lastUpdated}
                                    </p>
                                    {/* Tags */}
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {module.linkedExamId && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px] font-semibold">
                                                <ClipboardList size={10} />
                                                Exam Linked
                                            </span>
                                        )}
                                        {module.certificateTemplateId && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-semibold">
                                                <Award size={10} />
                                                Certificate
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Actions */}
                                <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center sm:shrink-0">
                                    <ActionBtn
                                        label="View"
                                        icon={<Eye size={14} />}
                                        onClick={() => onViewCourse({ ...module, studentsCount: module.students })}
                                    />
                                    <Link href={`/dashboard/creator/courses/${module.id}/edit`}>
                                        <ActionBtn label="Edit" icon={<Pencil size={14} />} />
                                    </Link>
                                    <ActionBtn
                                        label="Enroll"
                                        icon={<UserPlus size={14} />}
                                        onClick={() => onOpenEnrollment(module)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function ActionBtn({ label, icon, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white border text-xs font-medium transition-all cursor-pointer sm:w-auto sm:px-3 sm:py-1.5"
            style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-blue-tint)';
                e.currentTarget.style.borderColor = 'var(--color-border-brand)';
                e.currentTarget.style.color = 'var(--brand, #008D98)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
        >
            {icon}
            {label}
        </button>
    );
}
