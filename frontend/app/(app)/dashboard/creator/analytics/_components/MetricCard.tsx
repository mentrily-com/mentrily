import React from 'react';

export default function MetricCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-2xl border border-gray-100 p-5 bg-gray-50/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{value}</p>
        </div>
    );
}
