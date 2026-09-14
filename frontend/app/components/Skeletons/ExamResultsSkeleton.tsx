'use client';
import React from 'react';

/**
 * Purpose-built skeleton matching ExamResultsView.tsx:
 * - Title, Assessment ID, Back link, and Publish button placeholder
 * - 6-column KPI grid: Pass/Fail Donut card, 2 CompactStatTiles, and Bar Chart card
 * - Student results table shell with pagination
 */
export default function ExamResultsSkeleton() {
    return (
        <div className="animate-fade-in pb-10 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="space-y-2">
                    <div className="h-8 w-56 rounded-lg bg-slate-200 animate-pulse" />
                    <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-slate-100 animate-pulse" />
                    <div className="h-11 w-36 rounded-2xl bg-slate-200 animate-pulse" />
                </div>
            </div>

            {/* KPI & Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-10">
                {/* Donut Card */}
                <div className="md:col-span-2 lg:col-span-2 bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[260px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
                        <div className="h-5 w-12 rounded-lg bg-slate-100 animate-pulse" />
                    </div>
                    <div className="mx-auto h-32 w-32 rounded-full border-8 border-slate-100 animate-pulse" />
                    <div className="mt-4 flex justify-center gap-6">
                        <div className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
                        <div className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
                    </div>
                </div>

                {/* 2 Stat Tiles */}
                <div className="lg:col-span-1 space-y-4">
                    {[0, 1].map((idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-[24px] border border-slate-100 p-5 shadow-sm space-y-2"
                        >
                            <div className="h-2.5 w-20 rounded bg-slate-100 animate-pulse" />
                            <div className="h-7 w-16 rounded-md bg-slate-200 animate-pulse" />
                            <div className="h-2.5 w-28 rounded bg-slate-100 animate-pulse" />
                        </div>
                    ))}
                </div>

                {/* Distribution Bar Chart Card */}
                <div className="md:col-span-2 lg:col-span-3 bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm flex flex-col justify-between min-h-[260px]">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <div className="space-y-1.5">
                            <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
                            <div className="h-2.5 w-48 rounded bg-slate-50 animate-pulse" />
                        </div>
                        <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
                    </div>
                    <div className="h-36 w-full rounded-2xl bg-slate-50/70 animate-pulse" />
                </div>
            </div>

            {/* Results Table Shell */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="h-5 w-40 rounded-md bg-slate-200 animate-pulse" />
                    <div className="h-9 w-64 rounded-xl bg-slate-100 animate-pulse" />
                </div>
                <div className="divide-y divide-slate-100">
                    {[1, 2, 3, 4, 5].map((row) => (
                        <div key={row} className="p-5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-slate-100 animate-pulse" />
                                <div className="space-y-1.5">
                                    <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                                    <div className="h-2.5 w-44 rounded bg-slate-100 animate-pulse" />
                                </div>
                            </div>
                            <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
                            <div className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
                            <div className="h-6 w-20 rounded-full bg-slate-100 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
