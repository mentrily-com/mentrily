'use client';
import React, { useState, useEffect } from 'react';
import { StudentService } from '@/services/api/StudentService';
import { Loader2, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Bookmark {
    id: string;
    unitId: string;
    unitTitle: string;
    unitType: string;
    moduleTitle: string;
    courseTitle: string;
    bookmarkedAt: string;
}

export default function BookmarksPage() {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBookmarks();
    }, []);

    const fetchBookmarks = async () => {
        try {
            setLoading(true);
            const data = await StudentService.getBookmarks();
            setBookmarks(data);
        } catch (error) {
            console.error('Failed to fetch bookmarks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveBookmark = async (bookmarkId: string) => {
        try {
            await StudentService.removeBookmark(bookmarkId);
            setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
        } catch (error) {
            console.error('Failed to remove bookmark:', error);
        }
    };
    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            <div className="border-b border-slate-100">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-wrap items-center gap-4 sm:gap-10">
                    <button className="py-4 text-sm font-black text-[var(--brand)] border-b-2 border-[var(--brand)] px-1">
                        Bookmarks
                    </button>
                    <div className="text-xs font-bold text-slate-400">{bookmarks.length} saved units</div>
                </div>
            </div>

            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8 animate-fade-in text-left">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 text-[var(--brand)] animate-spin mb-4" />
                        <p className="text-slate-500 font-bold">Loading your saved secrets...</p>
                    </div>
                ) : bookmarks.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                        <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-sm mb-4 text-2xl">
                            🔖
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">No bookmarks yet</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-8 font-medium">
                            Save important lessons, questions or code snippets so you can find them easily later.
                        </p>
                        <Link
                            href="/dashboard/learner"
                            className="inline-flex px-6 py-3 bg-[var(--brand)] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[var(--brand-dark)] transition-all"
                        >
                            Browse Courses
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-hidden bg-white border border-slate-100 rounded-xl shadow-sm">
                        <table className="hidden w-full text-left border-collapse md:table">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                                        Topic
                                    </th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                                        Module
                                    </th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                                        Course
                                    </th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                                        Saved On
                                    </th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {bookmarks.map((b) => (
                                    <tr key={b.id} className="hover:bg-slate-50/40 transition-colors group">
                                        <td className="px-6 py-5">
                                            <Link
                                                href={`/dashboard/learner/unit/${b.unitId}`}
                                                className="text-sm font-bold text-[var(--brand-dark)] hover:text-[var(--brand)] transition-colors flex items-center gap-2 group/link"
                                            >
                                                {b.unitTitle}
                                                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                            </Link>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 block px-2 py-0.5 bg-slate-100 rounded-md w-fit">
                                                {b.unitType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-sm font-medium text-slate-700">{b.moduleTitle}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-sm font-medium text-slate-500">{b.courseTitle}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-sm font-medium text-slate-400">
                                                {new Date(b.bookmarkedAt).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button
                                                onClick={() => handleRemoveBookmark(b.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Remove Bookmark"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="divide-y divide-slate-100 md:hidden">
                            {bookmarks.map((b) => (
                                <article key={b.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <Link
                                                href={`/dashboard/learner/unit/${b.unitId}`}
                                                className="flex items-center gap-2 text-sm font-black text-[var(--brand-dark)]"
                                            >
                                                {b.unitTitle}
                                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                            </Link>
                                            <span className="mt-2 block w-fit rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                {b.unitType}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveBookmark(b.id)}
                                            className="rounded-lg p-2 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500"
                                            title="Remove Bookmark"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl bg-slate-50 p-3 text-xs sm:grid-cols-2">
                                        <div>
                                            <p className="font-black uppercase tracking-widest text-slate-400">
                                                Module
                                            </p>
                                            <p className="mt-1 font-bold text-slate-700">{b.moduleTitle}</p>
                                        </div>
                                        <div>
                                            <p className="font-black uppercase tracking-widest text-slate-400">Saved</p>
                                            <p className="mt-1 font-bold text-slate-500">
                                                {new Date(b.bookmarkedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <p className="font-black uppercase tracking-widest text-slate-400">
                                                Course
                                            </p>
                                            <p className="mt-1 font-bold text-slate-500">{b.courseTitle}</p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function SortIcon() {
    return (
        <div className="flex flex-col gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity">
            <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="m18 15-6-6-6 6" />
            </svg>
            <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="m6 9 6 6 6-6" />
            </svg>
        </div>
    );
}
