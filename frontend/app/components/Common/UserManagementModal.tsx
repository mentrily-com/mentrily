'use client';
import React from 'react';
import { siteConfig } from '@/app/config/site';
import { UserPlus, Shield, FileUp } from 'lucide-react';
import AppModal from './AppModal';
import BulkImportReportModal from './BulkImportReportModal';
import BulkUserImport from './_components/BulkUserImport';
import UserCreatedSuccess from './_components/UserCreatedSuccess';
import InviteUserForm from './_components/InviteUserForm';
import { useUserManagement } from './_components/useUserManagement';
import { usePlan } from '@/hooks/usePlan';
import UpgradeModal from './UpgradeModal';
import UpgradeBanner from './UpgradeBanner';

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    orgName: string;
    onImport: (users: any[]) => void;
}

export default function UserManagementModal({ isOpen, onClose, orgName, onImport }: UserManagementModalProps) {
    const { canUse } = usePlan();
    const allowBulkImport = canUse('bulkImport');
    const [upgradeOpen, setUpgradeOpen] = React.useState(false);

    const {
        activeTab,
        setActiveTab,
        inviteFormData,
        setInviteFormData,
        isProcessing,
        error,
        isSuccess,
        invitedEmail,
        importReport,
        setImportReport,
        handleInviteUser,
        handleFileUpload,
        downloadSampleCSV,
        closeSuccess,
    } = useUserManagement(onImport, onClose, allowBulkImport);

    const normalizedImportReport = React.useMemo(() => {
        if (!importReport) {
            return null;
        }

        const summary = (importReport.summary || {}) as Record<string, unknown>;

        return {
            summary: {
                totalProcessed: Number(summary.totalProcessed ?? summary.total ?? 0) || 0,
                created: Number(summary.created ?? summary.success ?? 0) || 0,
                invited: Number(summary.invited ?? 0) || 0,
                alreadyInvited: Number(summary.alreadyInvited ?? 0) || 0,
                failed: Number(summary.failed ?? 0) || 0,
                emailsSent: summary.emailsSent !== undefined ? Number(summary.emailsSent) || 0 : undefined,
                emailsFailed: summary.emailsFailed !== undefined ? Number(summary.emailsFailed) || 0 : undefined,
            },
            details: Array.isArray(importReport.details) ? importReport.details : [],
        };
    }, [importReport]);

    if (!isOpen) return null;

    return (
        <>
            <AppModal
                isOpen={isOpen}
                onClose={onClose}
                title="Access Management"
                subtitle={orgName}
                icon={<UserPlus size={24} />}
                size="md"
                bodyClassName="space-y-5 sm:space-y-6"
                footer={
                    <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">
                        Institutional Access Management • {siteConfig.name} Admin
                    </p>
                }
                footerClassName="border-t-0 bg-transparent pt-0"
            >
                <div className="bg-white/75 p-4 rounded-[18px] flex items-start gap-3 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)] sm:p-5 sm:rounded-[20px] sm:gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] flex items-center justify-center text-[var(--brand)] shrink-0">
                        <Shield size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-[var(--brand-dark)] uppercase tracking-widest mb-1">
                            Authorization Protocol
                        </p>
                        <p className="text-xs font-bold text-[var(--brand)] leading-relaxed">
                            Send Clerk invitations for every new admin, teacher, or user. Password-based account
                            creation is disabled.
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-2 p-1 bg-slate-100 rounded-2xl sm:grid-cols-2">
                    <button
                        onClick={() => setActiveTab('invite')}
                        className={`flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'invite' ? 'bg-white text-[var(--brand)] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <UserPlus size={14} /> Single Invite
                    </button>
                    <button
                        onClick={() => {
                            if (!allowBulkImport) {
                                setUpgradeOpen(true);
                                return;
                            }
                            setActiveTab('bulk');
                        }}
                        className={`flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'bulk' ? 'bg-white text-[var(--brand)] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <FileUp size={14} /> CSV Invites
                    </button>
                </div>

                {isSuccess ? (
                    <UserCreatedSuccess name={inviteFormData.name} invitedEmail={invitedEmail} onClose={closeSuccess} />
                ) : activeTab === 'invite' ? (
                    <InviteUserForm
                        formData={inviteFormData}
                        allowAdmin
                        isProcessing={isProcessing}
                        onSubmit={handleInviteUser}
                        onChange={setInviteFormData}
                    />
                ) : !allowBulkImport ? (
                    <UpgradeBanner
                        title="Bulk Import Locked"
                        message="Bulk CSV import is available on Pro and Enterprise plans."
                        ctaLabel="Upgrade Plan"
                        onUpgrade={() => setUpgradeOpen(true)}
                    />
                ) : (
                    <BulkUserImport
                        error={error}
                        onFileUpload={handleFileUpload}
                        onDownloadSample={downloadSampleCSV}
                    />
                )}
            </AppModal>

            <BulkImportReportModal
                isOpen={!!importReport}
                onClose={() => {
                    setImportReport(null);
                    onClose();
                }}
                report={normalizedImportReport}
            />
            <UpgradeModal
                isOpen={upgradeOpen}
                message="Bulk CSV import is available on Pro and Enterprise plans."
                onClose={() => setUpgradeOpen(false)}
                onUpgrade={() => {
                    setUpgradeOpen(false);
                    window.location.href = '/dashboard/creator/billing';
                }}
            />
        </>
    );
}
