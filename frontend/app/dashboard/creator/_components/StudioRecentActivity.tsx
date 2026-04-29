'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Award, BookOpen, FileText, GraduationCap } from 'lucide-react';

interface StudioRecentActivityProps {
    activities: Array<{
        id: string;
        type?: 'exam_submission' | 'certificate_issued' | 'course_completed' | string;
        title?: string;
        name?: string;
        module?: string;
        time?: string;
        status?: string;
        score?: number;
    }>;
}

const itemVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.05, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
    }),
};

export default function StudioRecentActivity({ activities }: StudioRecentActivityProps) {
    return (
        <motion.section
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="glass-card rounded-2xl p-5 shadow-sm"
            data-element-id="creator-recent-activity"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Live activity
                    </p>
                    <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950">
                        Learner signals
                    </h3>
                </div>
                <span className="rounded-full bg-slate-100/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {activities.length} items
                </span>
            </div>

            <div className="mt-4 space-y-2">
                {activities.length > 0 ? (
                    activities.slice(0, 8).map((activity, i) => {
                        const mapped = mapActivity(activity);
                        return (
                            <ActivityItem
                                key={activity.id}
                                index={i}
                                icon={mapped.icon}
                                bgClass={mapped.bgClass}
                                colorClass={mapped.colorClass}
                                title={mapped.title}
                                subtitle={mapped.subtitle}
                                time={mapped.time}
                            />
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                            <BookOpen size={18} />
                        </div>
                        <p className="text-sm font-medium text-slate-400">No recent activity yet.</p>
                    </div>
                )}
            </div>
        </motion.section>
    );
}

function ActivityItem({
    icon,
    bgClass,
    colorClass,
    title,
    subtitle,
    time,
    index,
}: {
    icon: React.ReactNode;
    bgClass: string;
    colorClass: string;
    title: string;
    subtitle: string;
    time: string;
    index: number;
}) {
    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            custom={index}
            className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3 transition-colors duration-200 hover:border-slate-300 hover:bg-white"
        >
            <div className="flex items-start gap-3">
                <div
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bgClass} ${colorClass}`}
                >
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{subtitle}</p>
                    <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                        {time}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

function mapActivity(activity: {
    type?: string;
    title?: string;
    name?: string;
    module?: string;
    time?: string;
    score?: number;
}) {
    const type = String(activity?.type || 'exam_submission');
    const createdAt = activity?.time ? new Date(activity.time) : null;
    const time =
        createdAt && !Number.isNaN(createdAt.getTime())
            ? createdAt.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            })
            : 'Just now';

    if (type === 'certificate_issued') {
        return {
            icon: <Award size={15} />,
            bgClass: 'bg-amber-50',
            colorClass: 'text-amber-600',
            title: 'Certificate issued',
            subtitle: activity?.title || `${activity?.name || 'Learner'} received a certificate`,
            time,
        };
    }

    if (type === 'course_completed') {
        return {
            icon: <GraduationCap size={15} />,
            bgClass: 'bg-emerald-50',
            colorClass: 'text-emerald-600',
            title: 'Course completed',
            subtitle: activity?.title || `${activity?.name || 'Learner'} completed a course`,
            time,
        };
    }

    const scoreSuffix = typeof activity?.score === 'number' ? ` with ${Math.round(activity.score)}%` : '';
    return {
        icon: <FileText size={15} />,
        bgClass: 'bg-violet-50',
        colorClass: 'text-violet-600',
        title: 'Exam submission',
        subtitle: `${activity?.title || activity?.module || 'Assessment submitted'}${scoreSuffix}`,
        time,
    };
}
