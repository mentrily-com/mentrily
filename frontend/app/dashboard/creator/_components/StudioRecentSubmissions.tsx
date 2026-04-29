'use client';

interface StudioRecentSubmissionsProps {
    submissions: any[];
}

export default function StudioRecentSubmissions({ submissions }: StudioRecentSubmissionsProps) {
    return (
        <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 tracking-tight mb-6">Recent Submissions</h3>
            <div className="space-y-6">
                {submissions.length > 0 ? (
                    submissions.map((submission) => (
                        <SubmissionItem
                            key={submission.id}
                            name={submission.name}
                            module={submission.module}
                            time={submission.time ? new Date(submission.time).toLocaleTimeString() : 'Just now'}
                            status={submission.status}
                        />
                    ))
                ) : (
                    <div className="text-slate-400 text-sm font-bold">No recent activity.</div>
                )}
            </div>
            <button className="w-full mt-8 py-3 bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-colors">
                View All Activity
            </button>
        </div>
    );
}

function SubmissionItem({ name, module, time, status }: any) {
    const displayName = name || 'Unknown User';
    const initial = displayName ? displayName.charAt(0) : '?';
    return (
        <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs shrink-0">
                {initial}
            </div>
            <div>
                <p className="text-sm font-black text-slate-800 leading-none mb-1">{displayName}</p>
                <p className="text-[10px] font-bold text-slate-400 mb-2">{module}</p>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-slate-300 uppercase">{time}</span>
                    <span
                        className={`text-[9px] font-black uppercase ${status === 'Pending' ? 'text-amber-500' : 'text-emerald-500'}`}
                    >
                        {status}
                    </span>
                </div>
            </div>
        </div>
    );
}
