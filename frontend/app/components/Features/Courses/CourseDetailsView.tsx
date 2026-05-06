'use client';
import React, { useState } from 'react';
import { Users, BookOpen, Clock, BarChart3 } from 'lucide-react';
import AppModal from '@/app/components/Common/AppModal';

interface CourseDetailsViewProps {
    isOpen: boolean;
    onClose: () => void;
    course: {
        title: string;
        slug: string;
        studentsCount?: number;
        status: string;
        lastUpdated?: string;
        updatedAt?: string;
        shortDescription?: string;
        longDescription?: string;
        courseSummary?: string;
        completion?: number;
        avgTimeMinutes?: number;
        avgTimeLabel?: string;
        // Optional extended props
        teacher?: string;
        modules?: number;
        _count?: {
            students?: number;
        };
    } | null;
    userRole?: 'admin' | 'teacher';
}

export default function CourseDetailsView({ isOpen, onClose, course }: CourseDetailsViewProps) {
    const [activeTab] = useState<'overview'>('overview');

    if (!isOpen || !course) return null;

    const enrolledCount = Number(course.studentsCount ?? course._count?.students ?? 0);

    const lastUpdatedLabel = course.lastUpdated || course.updatedAt || '-';
    const descriptionText = getCourseDescription(course);
    const completionLabel = typeof course.completion === 'number' ? `${course.completion}%` : '-';
    const avgTimeLabel =
        course.avgTimeLabel || (typeof course.avgTimeMinutes === 'number' ? formatMinutes(course.avgTimeMinutes) : '-');

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title={course.title}
            subtitle={`Last Updated ${lastUpdatedLabel}`}
            icon={<BookOpen size={24} />}
            size="xl"
            bodyClassName="space-y-6"
        >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${course.status === 'Published' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
                >
                    {course.status}
                </span>
            </div>

            {/* Stats/Quick Actions */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
                <StatItem icon={<Users size={18} />} label="Enrolled" value={String(enrolledCount)} color="brand" />
                <StatItem icon={<BarChart3 size={18} />} label="Completion" value={completionLabel} color="emerald" />
                <StatItem icon={<Clock size={18} />} label="Avg. Time" value={avgTimeLabel} color="amber" />
            </div>

            {activeTab === 'overview' ? (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 gap-6">
                        <InfoCard
                            title="Course Description"
                            content={descriptionText || 'No description available for this course.'}
                        />
                    </div>
                </div>
            ) : (
                <></>
            )}
        </AppModal>
    );
}

function getCourseDescription(course: any): string {
    const candidates = [course?.longDescription, course?.shortDescription, course?.courseSummary];

    for (const candidate of candidates) {
        const cleaned = sanitizeText(candidate);
        if (cleaned) return cleaned;
    }

    return '';
}

function sanitizeText(value: unknown): string {
    if (!value || typeof value !== 'string') return '';

    const withoutTags = value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();

    return withoutTags;
}

function formatMinutes(totalMinutes: number): string {
    if (!totalMinutes || totalMinutes <= 0) return '0m';

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function StatItem({
    icon,
    label,
    value,
    color,
}: {
    icon: any;
    label: string;
    value: string;
    color: 'brand' | 'emerald' | 'amber';
}) {
    const colors = {
        brand: 'text-[var(--brand)] bg-[var(--brand-light)]',
        emerald: 'text-emerald-600 bg-emerald-50',
        amber: 'text-amber-600 bg-amber-50',
    };
    return (
        <div className="flex items-center gap-3 sm:gap-4">
            <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${colors[color]}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                    {label}
                </p>
                <p className="text-lg font-black text-slate-800 leading-none">{value}</p>
            </div>
        </div>
    );
}

function InfoCard({ title, content }: { title: string; content: string }) {
    return (
        <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm sm:p-8 sm:rounded-[32px]">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{title}</h4>
            <p className="text-sm font-bold text-slate-600 leading-relaxed">{content}</p>
        </div>
    );
}
