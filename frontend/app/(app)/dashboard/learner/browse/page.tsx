'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentService, BrowseCourse } from '@/services/api/StudentService';
import { useToast } from '@/app/components/Common/Toast';

interface EnrolledSummary {
    slug: string;
    percent: number;
    status: string;
}

const DIFFICULTY_STYLES: Record<string, string> = {
    Beginner: 'bg-emerald-50 text-emerald-600',
    Intermediate: 'bg-amber-50 text-amber-600',
    Advanced: 'bg-rose-50 text-rose-600',
};

export default function BrowseCoursesPage() {
    const router = useRouter();
    const { success: showSuccess, error: showError } = useToast();

    const [courses, setCourses] = useState<BrowseCourse[]>([]);
    const [enrolledBySlug, setEnrolledBySlug] = useState<Record<string, EnrolledSummary>>({});
    const [loading, setLoading] = useState(true);
    const [enrollingId, setEnrollingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                setLoading(true);
                const [catalog, enrolled] = await Promise.all([
                    StudentService.getBrowseCourses(),
                    StudentService.getCourses().catch(() => []),
                ]);
                if (cancelled) return;
                setCourses(catalog);
                const map: Record<string, EnrolledSummary> = {};
                (enrolled || []).forEach((c: any) => {
                    map[c.slug] = { slug: c.slug, percent: c.percent ?? 0, status: c.status || 'Not Started' };
                });
                setEnrolledBySlug(map);
            } catch (err) {
                console.error('[Browse] Failed to load catalog', err);
                if (!cancelled) showError('Could not load the course catalog.', 'Error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredCourses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return courses;
        return courses.filter(
            (c) =>
                c.title.toLowerCase().includes(q) ||
                (c.shortDescription || '').toLowerCase().includes(q) ||
                (c.tags || []).some((t) => t.toLowerCase().includes(q)),
        );
    }, [courses, searchQuery]);

    const handleEnroll = async (course: BrowseCourse) => {
        if (enrollingId) return;
        setEnrollingId(course.id);
        try {
            await StudentService.enrollInCourse(course.id);
            setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, enrolled: true } : c)));
            setEnrolledBySlug((prev) => ({
                ...prev,
                [course.slug]: { slug: course.slug, percent: 0, status: 'Not Started' },
            }));
            showSuccess(`You're enrolled in “${course.title}”.`, 'Enrolled');
        } catch (err: any) {
            console.error('[Browse] Enroll failed', err);
            showError(err?.message || 'Failed to enroll in this course.', 'Error');
        } finally {
            setEnrollingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10 animate-fade-in">
                <div className="flex flex-col gap-4 mb-6 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-800">Browse Courses</h2>
                        <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Explore the catalog and enroll instantly
                        </p>
                    </div>
                    <div className="relative w-full sm:w-auto">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search courses..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-[var(--brand)] transition-all shadow-sm sm:w-72"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                        </span>
                    </div>
                </div>

                <p className="mb-6 -mt-3 text-[11px] font-medium leading-relaxed text-slate-500 sm:mb-10">
                    We don&apos;t claim ownership of the videos or content featured in these courses — they&apos;re
                    included for demonstration purposes. A full course marketplace is a coming-soon feature.
                </p>

                {loading ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-3xl border border-slate-100 bg-white p-0 shadow-sm overflow-hidden"
                            >
                                <div className="h-40 w-full bg-slate-100 animate-pulse" />
                                <div className="p-5 space-y-3">
                                    <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
                                    <div className="h-3 w-full bg-slate-50 rounded animate-pulse" />
                                    <div className="h-9 w-full bg-slate-100 rounded-2xl animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredCourses.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 font-bold">
                        {courses.length === 0
                            ? 'No courses are open for enrollment yet. Check back soon!'
                            : 'No courses match your search.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredCourses.map((course) => {
                            const enrolledInfo = enrolledBySlug[course.slug];
                            const isEnrolled = course.enrolled || !!enrolledInfo;
                            const percent = enrolledInfo?.percent ?? 0;
                            const isEnrolling = enrollingId === course.id;

                            return (
                                <div
                                    key={course.id}
                                    className="group flex flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all hover:border-[var(--brand-light)] hover:shadow-md"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                                        {course.thumbnail ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={course.thumbnail}
                                                alt={course.title}
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)]">
                                                <span className="px-6 text-center text-lg font-black tracking-tight text-white/90">
                                                    {course.title}
                                                </span>
                                            </div>
                                        )}
                                        {course.difficulty && (
                                            <span
                                                className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                                    DIFFICULTY_STYLES[course.difficulty] || 'bg-slate-50 text-slate-500'
                                                }`}
                                            >
                                                {course.difficulty}
                                            </span>
                                        )}
                                    </div>

                                    {/* Body */}
                                    <div className="flex flex-1 flex-col p-5">
                                        <h3 className="mb-1 text-lg font-black leading-snug text-slate-800">
                                            {course.title}
                                        </h3>
                                        {course.shortDescription && (
                                            <p className="mb-3 text-sm font-semibold leading-6 text-slate-500 line-clamp-2">
                                                {course.shortDescription}
                                            </p>
                                        )}
                                        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {course.sections} Sections · {course.totalUnits} Learning Units
                                            {course.hasFinalExam ? ' · Final Exam' : ''}
                                        </p>

                                        {course.tags?.length > 0 && (
                                            <div className="mb-4 flex flex-wrap gap-1.5">
                                                {course.tags.slice(0, 3).map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="mt-auto">
                                            {isEnrolled ? (
                                                <Link
                                                    href={`/dashboard/learner/module/${course.slug}`}
                                                    className="block space-y-2.5"
                                                >
                                                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                                        <span>{enrolledInfo?.status || 'Enrolled'}</span>
                                                        <span className="text-[var(--brand)]">{percent}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-50 shadow-inner">
                                                        <div
                                                            className="h-full rounded-full bg-[var(--brand)] transition-all duration-1000"
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand-lighter)] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[var(--brand-dark)] transition-colors hover:bg-[var(--brand-light)]">
                                                        {percent > 0 ? 'Continue Learning' : 'Start Learning'}
                                                        <svg
                                                            width="12"
                                                            height="12"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="3.5"
                                                        >
                                                            <path d="M9 18l6-6-6-6" />
                                                        </svg>
                                                    </span>
                                                </Link>
                                            ) : (
                                                <button
                                                    onClick={() => handleEnroll(course)}
                                                    disabled={isEnrolling}
                                                    className="w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[var(--brand)]/20 transition-all hover:bg-[var(--brand-dark)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                                                >
                                                    {isEnrolling ? 'Enrolling…' : 'Enroll Now'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
