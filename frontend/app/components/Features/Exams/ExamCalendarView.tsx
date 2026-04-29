'use client';

import React, { useMemo } from 'react';

type ScheduledExam = {
    id: string;
    title: string;
    slug: string;
    startTime: string;
    endTime: string;
};

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(value: Date) {
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ExamCalendarView({ exams }: { exams: ScheduledExam[] }) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    const startWeekDay = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    const dayCells: Array<Date | null> = [];
    for (let i = 0; i < startWeekDay; i += 1) {
        dayCells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        dayCells.push(new Date(currentYear, currentMonth, day));
    }
    while (dayCells.length % 7 !== 0) {
        dayCells.push(null);
    }

    const grouped = useMemo(() => {
        const map = new Map<string, ScheduledExam[]>();

        for (const exam of exams || []) {
            if (!exam.startTime) continue;
            const date = new Date(exam.startTime);
            if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) continue;
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const existing = map.get(key) || [];
            existing.push(exam);
            map.set(key, existing);
        }

        for (const [key, value] of map.entries()) {
            value.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            map.set(key, value);
        }

        return map;
    }, [exams, currentMonth, currentYear]);

    return (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900">
                    {monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled Exams</p>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
                {weekDays.map((label) => (
                    <div
                        key={label}
                        className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center"
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {dayCells.map((cell, idx) => {
                    if (!cell) {
                        return (
                            <div
                                key={`empty-${idx}`}
                                className="min-h-[130px] border-r border-b border-slate-100/80 bg-slate-50/30"
                            />
                        );
                    }

                    const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
                    const items = grouped.get(key) || [];

                    return (
                        <div key={key} className="min-h-[130px] border-r border-b border-slate-100/80 p-3 space-y-2">
                            <div className="text-xs font-black text-slate-500">{cell.getDate()}</div>
                            <div className="space-y-2">
                                {items.map((exam) => {
                                    const start = new Date(exam.startTime);
                                    const end = exam.endTime ? new Date(exam.endTime) : null;

                                    return (
                                        <div
                                            key={exam.id}
                                            className="rounded-xl border border-[var(--brand)]/20 bg-[var(--brand-light)] px-2.5 py-2"
                                        >
                                            <p className="text-[11px] font-black text-[var(--brand-dark)] leading-tight line-clamp-2">
                                                {exam.title}
                                            </p>
                                            <p className="text-[10px] font-bold text-[var(--brand)] mt-1">
                                                {formatTime(start)}
                                                {end ? ` - ${formatTime(end)}` : ''}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
