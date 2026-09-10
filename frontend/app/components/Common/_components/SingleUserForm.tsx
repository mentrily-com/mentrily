'use client';
import { Loader2 } from 'lucide-react';

interface SingleUserFormProps {
    formData: { name: string; email: string; id: string; role: string; dept: string };
    allowAdmin?: boolean;
    isProcessing: boolean;
    onSubmit: (event: React.FormEvent) => void;
    onChange: (next: { name: string; email: string; id: string; role: string; dept: string }) => void;
}

export default function SingleUserForm({
    formData,
    allowAdmin = false,
    isProcessing,
    onSubmit,
    onChange,
}: SingleUserFormProps) {
    const roles = allowAdmin ? ['Student', 'Teacher', 'Admin'] : ['Student', 'Teacher'];

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <FormInput
                    label="Full Name"
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={(value) => onChange({ ...formData, name: value })}
                />
                <FormInput
                    label="Email Address"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(value) => onChange({ ...formData, email: value })}
                />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <FormInput
                    label="Official ID"
                    placeholder="STU-2025-001"
                    value={formData.id}
                    onChange={(value) => onChange({ ...formData, id: value })}
                />
                <FormInput
                    label="Department"
                    placeholder="Computer Science"
                    value={formData.dept}
                    onChange={(value) => onChange({ ...formData, dept: value })}
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Account Role
                </label>
                <div className={`grid ${roles.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'} gap-3`}>
                    {roles.map((role) => (
                        <button
                            key={role}
                            type="button"
                            onClick={() => onChange({ ...formData, role })}
                            className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${formData.role === role ? 'bg-white border-[var(--brand)] text-[var(--brand)] shadow-lg shadow-[var(--brand)]/10' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            </div>
            <button
                type="submit"
                disabled={isProcessing}
                aria-label={isProcessing ? 'Establishing user access' : undefined}
                className="w-full py-4 bg-[var(--brand)] text-white font-black text-xs uppercase tracking-[0.14em] rounded-[20px] shadow-xl shadow-[var(--brand)]/20 hover:scale-[1.02] active:scale-95 transition-all sm:py-5 sm:tracking-[0.2em] sm:rounded-[24px]"
            >
                {isProcessing ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Establish User Access'}
            </button>
        </form>
    );
}

function FormInput({
    label,
    type = 'text',
    placeholder,
    value,
    onChange,
}: {
    label: string;
    type?: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
            <input
                type={type}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-[var(--brand)] transition-all font-mono"
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required
            />
        </div>
    );
}
