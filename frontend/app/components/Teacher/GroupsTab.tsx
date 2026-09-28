'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TeacherService } from '@/services/api/TeacherService';
import { useToast } from '@/app/components/Common/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import {
    Users,
    Plus,
    X,
    Search,
    Trash2,
    Mail,
    UserPlus,
    Edit3,
    FolderOpen,
    Upload,
    FileText,
    Download,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import BulkImportReportModal from '@/app/components/Common/BulkImportReportModal';
import AlertModal from '@/app/components/Common/AlertModal';

interface GroupsTabProps {
    onEnrollGroupInCourse?: (groupId: string, groupName: string) => void;
}

export default function GroupsTab({ onEnrollGroupInCourse }: GroupsTabProps) {
    const { success, error: toastError } = useToast();
    const [groups, setGroups] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [manageGroup, setManageGroup] = useState<any>(null);
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const loadGroups = async () => {
        try {
            const data = await TeacherService.getGroups();
            setGroups(data);
        } catch (err) {
            console.error('Failed to load groups', err);
            toastError('Failed to load groups');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadGroups();
    }, []);

    const handleDeleteGroup = (groupId: string) => {
        setAlertConfig({
            isOpen: true,
            title: 'Delete Group?',
            message: "Delete this group? Students won't be removed from enrolled courses.",
            type: 'danger',
            onConfirm: async () => {
                setAlertConfig((prev) => ({ ...prev, isOpen: false }));
                try {
                    await TeacherService.deleteGroup(groupId);
                    success('Group deleted');
                    loadGroups();
                } catch (err) {
                    toastError('Failed to delete group');
                }
            },
        });
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-100 p-8 animate-pulse">
                        <div className="h-6 bg-gray-100 rounded-lg w-1/2 mb-4" />
                        <div className="h-4 bg-gray-50 rounded-lg w-1/3" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
                        <FolderOpen size={18} className="text-gray-400" />
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 leading-none">
                                Total Groups
                            </p>
                            <p className="text-lg font-semibold text-gray-800 leading-none mt-1">{groups.length}</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-[var(--brand)] text-white font-semibold text-xs rounded-lg hover:bg-[var(--brand-dark)] transition-all active:scale-95 uppercase tracking-widest shadow-sm flex items-center gap-2"
                >
                    <Plus size={16} strokeWidth={3} /> New Group
                </button>
            </div>

            {groups.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-100 p-16 text-center">
                    <div className="w-20 h-20 rounded-lg bg-gray-50 flex items-center justify-center mx-auto mb-6">
                        <Users size={32} className="text-gray-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">No Groups Yet</h3>
                    <p className="text-sm font-medium text-gray-400 mb-6">
                        Create your first student group to manage enrollments efficiently.
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-8 py-4 bg-[var(--brand)] text-white font-semibold text-xs rounded-lg hover:bg-[var(--brand-dark)] transition-all active:scale-95 uppercase tracking-widest"
                    >
                        Create Group
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <div
                            key={group.id}
                            className="bg-white rounded-lg border border-gray-100 shadow-sm p-8 hover:border-[var(--brand-light)] hover:shadow-md transition-all group/card"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 tracking-tight">{group.name}</h3>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mt-1">
                                        {group._count?.students || group.students?.length || 0} Students
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDeleteGroup(group.id)}
                                    className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover/card:opacity-100"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Student avatars */}
                            <div className="flex -space-x-2 mb-6">
                                {(group.students || []).slice(0, 5).map((st: any, idx: number) => (
                                    <div
                                        key={st.id}
                                        className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-gray-500 shadow-sm"
                                    >
                                        {st.name?.[0] || '?'}
                                    </div>
                                ))}
                                {(group.students?.length || 0) > 5 && (
                                    <div className="w-9 h-9 rounded-lg bg-[var(--brand-light)] border-2 border-white flex items-center justify-center text-[10px] font-semibold text-[var(--brand)]">
                                        +{group.students.length - 5}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setManageGroup(group)}
                                    className="flex-1 px-4 py-3 rounded-lg bg-gray-50 text-gray-600 hover:bg-[var(--brand-light)] hover:text-[var(--brand)] transition-all text-[10px] font-semibold uppercase tracking-widest flex items-center justify-center gap-1"
                                >
                                    <Edit3 size={12} /> Manage
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CREATE GROUP MODAL */}
            {showCreateModal &&
                typeof document !== 'undefined' &&
                createPortal(
                    <CreateGroupModal
                        onClose={() => setShowCreateModal(false)}
                        onCreated={() => {
                            setShowCreateModal(false);
                            loadGroups();
                        }}
                    />,
                    document.body,
                )}

            {/* MANAGE GROUP MODAL */}
            {manageGroup &&
                typeof document !== 'undefined' &&
                createPortal(
                    <ManageGroupModal
                        group={manageGroup}
                        onClose={() => setManageGroup(null)}
                        onUpdated={() => {
                            setManageGroup(null);
                            loadGroups();
                        }}
                    />,
                    document.body,
                )}

            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type || 'danger'}
                confirmLabel="Delete"
                onConfirm={alertConfig.onConfirm}
                onCancel={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
            />
        </>
    );
}

// ─── CREATE GROUP MODAL ────────────────────────────────────────────────

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const { success, error: toastError } = useToast();
    const [name, setName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [step, setStep] = useState<'name' | 'students'>('name');
    const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

    const handleCreateName = async () => {
        if (!name.trim()) return toastError('Group name is required');
        setIsCreating(true);
        try {
            const result = await TeacherService.createGroup({ name: name.trim() });
            setCreatedGroupId(result.id);
            success(`Group "${name}" created`);
            setStep('students');
        } catch (err) {
            toastError('Failed to create group');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
                onClick={step === 'name' ? onClose : undefined}
            />
            <div className="bg-white w-full max-w-xl rounded-lg sm:rounded-lg p-6 sm:p-12 shadow-lg relative z-10 animate-in slide-in-from-bottom-8 duration-500 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <button
                    onClick={() => {
                        if (step === 'students') onCreated();
                        else onClose();
                    }}
                    aria-label="Close"
                    className="absolute top-5 right-5 sm:top-10 sm:right-10 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg sm:rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 transition-all active:scale-95"
                >
                    <X size={20} strokeWidth={3} />
                </button>

                {step === 'name' ? (
                    <>
                        <div className="mb-8">
                            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Create Group</h2>
                            <p className="text-sm font-medium text-gray-400 mt-1">
                                Organize students for easy management.
                            </p>
                        </div>

                        <div>
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 block">
                                Group Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Section A - Data Structures"
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/5 transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateName()}
                                autoFocus
                            />
                        </div>

                        <button
                            onClick={handleCreateName}
                            disabled={isCreating || !name.trim()}
                            className="w-full mt-8 py-5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-semibold text-xs uppercase tracking-[0.2em] transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Creating...
                                </>
                            ) : (
                                'Create & Add Students'
                            )}
                        </button>
                    </>
                ) : (
                    <AddStudentsPanel groupId={createdGroupId!} groupName={name} onDone={onCreated} />
                )}
            </div>
        </div>
    );
}

// ─── MANAGE GROUP MODAL

function ManageGroupModal({ group, onClose, onUpdated }: { group: any; onClose: () => void; onUpdated: () => void }) {
    const { success, error: toastError } = useToast();
    const [students, setStudents] = useState<any[]>(group.students || []);
    const [groupName, setGroupName] = useState(group.name);
    const [isEditingName, setIsEditingName] = useState(false);
    const [showAddStudents, setShowAddStudents] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 300);

    const filteredStudents = students.filter(
        (st) =>
            st.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            st.email?.toLowerCase().includes(debouncedSearch.toLowerCase()),
    );

    const handleRenameSave = async () => {
        if (!groupName.trim()) return;
        try {
            await TeacherService.updateGroup(group.id, { name: groupName.trim() });
            success('Group renamed');
            setIsEditingName(false);
        } catch (err) {
            toastError('Failed to rename group');
        }
    };

    const handleRemoveStudent = async (studentId: string) => {
        try {
            await TeacherService.removeGroupStudent(group.id, studentId);
            setStudents((prev) => prev.filter((s) => s.id !== studentId));
            success('Student removed from group');
        } catch (err) {
            toastError('Failed to remove student');
        }
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
                onClick={() => {
                    onUpdated();
                }}
            />
            <div className="bg-white w-full max-w-2xl rounded-lg sm:rounded-lg p-6 sm:p-12 shadow-lg relative z-10 animate-in slide-in-from-bottom-8 duration-500 max-h-[85vh] overflow-hidden flex flex-col">
                <button
                    onClick={() => {
                        onUpdated();
                    }}
                    aria-label="Close"
                    className="absolute top-5 right-5 sm:top-10 sm:right-10 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg sm:rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 transition-all active:scale-95"
                >
                    <X size={20} strokeWidth={3} />
                </button>

                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-[var(--brand)] flex items-center justify-center shadow-sm">
                        <Users size={28} className="text-white" />
                    </div>
                    <div className="flex-1">
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="text-2xl font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 outline-none focus:border-[var(--brand)]"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSave()}
                                />
                                <button
                                    onClick={handleRenameSave}
                                    className="text-[var(--brand)] font-semibold text-xs uppercase"
                                >
                                    Save
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">{groupName}</h2>
                                <button
                                    onClick={() => setIsEditingName(true)}
                                    className="p-1 text-gray-300 hover:text-[var(--brand)] transition-colors"
                                >
                                    <Edit3 size={14} />
                                </button>
                            </div>
                        )}
                        <p className="text-sm font-medium text-gray-400">{students.length} students</p>
                    </div>
                </div>

                {/* Actions bar */}
                <div className="flex items-center justify-between mb-6 gap-3">
                    <div className="relative flex-1">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
                            size={14}
                            strokeWidth={3}
                        />
                        <input
                            type="text"
                            placeholder="Search students..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/5 transition-all w-full"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddStudents(!showAddStudents)}
                        className="px-5 py-2.5 bg-[var(--brand)] text-white font-semibold text-[10px] rounded-lg hover:bg-[var(--brand-dark)] transition-all active:scale-95 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"
                    >
                        <UserPlus size={14} /> Add Students
                    </button>
                </div>

                {/* Add students panel */}
                {showAddStudents && (
                    <div className="mb-6">
                        <AddStudentsPanel
                            groupId={group.id}
                            groupName={group.name}
                            onDone={async () => {
                                setShowAddStudents(false);
                                const updated = await TeacherService.getGroup(group.id);
                                setStudents(updated.students || []);
                            }}
                            compact
                        />
                    </div>
                )}

                {/* Student list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {filteredStudents.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 font-medium text-sm">
                            {students.length === 0 ? 'No students in this group yet.' : 'No matching students.'}
                        </div>
                    ) : (
                        filteredStudents.map((st) => (
                            <div
                                key={st.id}
                                className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors group/student"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-semibold text-gray-500 text-sm shadow-inner border border-white">
                                        {st.name?.[0] || '?'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{st.name}</p>
                                        <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                                            <Mail size={8} /> {st.email}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveStudent(st.id)}
                                    className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all sm:opacity-0 sm:group-hover/student:opacity-100 opacity-100"
                                    title="Remove from group"
                                >
                                    <X size={16} strokeWidth={3} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── ADD STUDENTS PANEL (reused in CreateGroupModal + ManageGroupModal) ─────

interface AddStudentsPanelProps {
    groupId: string;
    groupName: string;
    onDone: () => void;
    compact?: boolean;
}

function AddStudentsPanel({ groupId, groupName, onDone, compact }: AddStudentsPanelProps) {
    const { success, error: toastError } = useToast();
    const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
    const [email, setEmail] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importReport, setImportReport] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (importReport) {
        return (
            <BulkImportReportModal
                isOpen={!!importReport}
                onClose={() => {
                    setImportReport(null);
                    onDone();
                }}
                report={{
                    summary: {
                        totalProcessed: importReport.summary.totalProcessed,
                        created: importReport.summary.added,
                        failed: importReport.summary.failed,
                    },
                    details: importReport.details,
                }}
            />
        );
    }

    const handleSingleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setIsProcessing(true);
        setError(null);
        try {
            const result = await TeacherService.addGroupStudents(groupId, [email.trim()]);
            if (result.summary.added > 0) {
                success(`Student added to ${groupName}`);
                setEmail('');
                onDone();
            } else {
                const msg = result.details?.[0]?.error || 'Student not found or already in group';
                setError(msg);
                toastError(msg);
            }
        } catch (err: any) {
            const message = err?.message || 'Failed to add student';
            setError(message);
            toastError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.csv')) {
            setError('Please upload a valid CSV file.');
            return;
        }

        setIsProcessing(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n');
            const emails = lines
                .slice(1)
                .map((line) => {
                    const parts = line.split(',');
                    // Try column 3 first (Name,ID,Email), then column 1, then the whole line
                    return (parts[2] || parts[0] || '').trim();
                })
                .filter((e) => e && e.includes('@'));

            if (emails.length === 0) {
                setError('No valid email addresses found in CSV.');
                setIsProcessing(false);
                return;
            }

            try {
                const result = await TeacherService.addGroupStudents(groupId, emails);
                if (result.summary) {
                    setImportReport(result);
                    if (result.summary.added > 0) {
                        success(`${result.summary.added} student(s) added to ${groupName}`);
                    }
                }
            } catch (err: any) {
                const message = err?.message || 'Failed to process bulk import';
                setError(message);
                toastError(message);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(file);
    };

    const downloadSampleCSV = () => {
        const content = 'Name,Student ID,Email\nJohn Doe,STU001,john@example.com\nJane Smith,STU002,jane@example.com';
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample_group_import.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className={compact ? 'p-6 bg-gray-50 rounded-lg border border-gray-100' : ''}>
            {!compact && (
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-lg bg-[var(--brand-light)] flex items-center justify-center text-[var(--brand)]">
                            <UserPlus size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-800 tracking-tight">Add Students</h3>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                {groupName}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-gray-50 rounded-lg mb-6">
                <button
                    onClick={() => {
                        setActiveTab('single');
                        setError(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-semibold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'single' ? 'bg-white text-[var(--brand)] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <FileText size={12} /> Custom Add
                </button>
                <button
                    onClick={() => {
                        setActiveTab('bulk');
                        setError(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-semibold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'bulk' ? 'bg-white text-[var(--brand)] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <Upload size={12} /> Bulk CSV
                </button>
            </div>

            {activeTab === 'single' ? (
                <form onSubmit={handleSingleAdd} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">
                            Student Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g., student@university.edu"
                            className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/5 transition-all placeholder:text-gray-300"
                            required
                            autoFocus
                        />
                    </div>
                    {error && (
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-lg flex items-center gap-2 text-xs font-medium">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={isProcessing || !email}
                        className="w-full py-3.5 bg-[var(--brand)] text-white font-semibold text-xs rounded-lg shadow-sm hover:bg-[var(--brand-dark)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:bg-[var(--brand)] uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={14} className="animate-spin" /> Adding...
                            </>
                        ) : (
                            'Add Student'
                        )}
                    </button>
                </form>
            ) : (
                <div className="space-y-4">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-lg bg-white p-8 flex flex-col items-center text-center cursor-pointer hover:border-[var(--brand-light)] hover:bg-gray-50 transition-all group"
                    >
                        <div className="w-10 h-10 rounded-lg bg-gray-50 shadow-sm flex items-center justify-center text-gray-400 group-hover:text-[var(--brand)] transition-colors mb-3">
                            <Upload size={20} />
                        </div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Upload CSV File</p>
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                            Click to select file
                        </p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".csv"
                            className="hidden"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[var(--brand-light)] rounded-lg border border-[var(--brand-light)]">
                        <div className="flex items-center gap-2 text-[var(--brand)]">
                            <Download size={14} />
                            <span className="text-[10px] font-semibold uppercase tracking-widest">Sample CSV</span>
                        </div>
                        <button
                            onClick={downloadSampleCSV}
                            className="px-3 py-1.5 bg-white text-[var(--brand)] text-[10px] font-semibold uppercase tracking-widest rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 border border-[var(--brand-light)]"
                        >
                            Download
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-lg flex items-center gap-2 text-xs font-medium">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    {isProcessing && (
                        <div className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-gray-400">
                            <Loader2 size={16} className="animate-spin" /> Processing CSV...
                        </div>
                    )}
                </div>
            )}

            {compact && (
                <button
                    onClick={onDone}
                    className="w-full mt-4 py-2 text-gray-400 font-semibold text-[10px] uppercase tracking-widest hover:text-gray-600 transition-colors"
                >
                    Done
                </button>
            )}
        </div>
    );
}
