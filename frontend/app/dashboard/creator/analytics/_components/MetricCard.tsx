import React from 'react';

export default function MetricCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{value}</p>
        </div>
    );
}
