'use client';
import { useState } from 'react';
import { AdminService } from '@/services/api/AdminService';
import { useToast } from '../Toast';
import posthog from 'posthog-js';

type ImportedUser = Record<string, unknown>;

type InviteFormData = {
    name: string;
    email: string;
    id: string;
    role: string;
    dept: string;
};

type ImportDetail = {
    email?: string;
    success: boolean;
    invited?: boolean;
    alreadyInvited?: boolean;
    role?: string;
    name?: string | null;
    department?: string | null;
    rollNumber?: string | null;
    pendingInviteId?: string | null;
    clerkInvitationId?: string | null;
    user?: ImportedUser;
    error?: string;
};

type ImportReport = {
    summary?: {
        totalProcessed?: number;
        invited?: number;
        alreadyInvited?: number;
        created?: number;
        failed?: number;
        emailsSent?: number;
        emailsFailed?: number;
    };
    details?: ImportDetail[];
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getErrorMessage = (value: unknown, fallback: string) => {
    if (value instanceof Error) return value.message;
    if (typeof value === 'object' && value !== null && 'message' in value) {
        const message = (value as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) return message;
    }
    return fallback;
};

const normalizeHeader = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/\([^)]*\)/g, '')
        .replace(/[^a-z0-9]+/g, '');

const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            row.push(cell.trim());
            cell = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') index += 1;
            row.push(cell.trim());
            if (row.some((value) => value.trim())) rows.push(row);
            row = [];
            cell = '';
            continue;
        }

        cell += char;
    }

    row.push(cell.trim());
    if (row.some((value) => value.trim())) rows.push(row);
    return rows;
};

export function useUserManagement(
    onImport: (users: ImportedUser[]) => void,
    onClose: () => void,
    allowBulkImport = true,
) {
    const [activeTab, setActiveTab] = useState<'invite' | 'bulk'>('invite');
    const [inviteFormData, setInviteFormData] = useState<InviteFormData>({
        name: '',
        email: '',
        id: '',
        role: 'User',
        dept: '',
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
    const [importReport, setImportReport] = useState<ImportReport | null>(null);
    const { success: toastSuccess, error: toastError } = useToast();

    const normalizeRole = (value?: string) => {
        const normalized = String(value || '')
            .trim()
            .toUpperCase();

        if (normalized === 'ADMIN') return 'ADMIN';
        if (normalized === 'TEACHER') return 'TEACHER';
        return 'STUDENT';
    };

    const parseInviteCsv = (text: string) => {
        const rows = parseCsv(text);
        if (rows.length < 2) return { invites: [], rejected: [] as ImportDetail[] };

        const headers = rows[0].map(normalizeHeader);
        const headerIndex = (names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0);
        const emailIndex = headerIndex(['email', 'emailaddress']);
        const roleIndex = headerIndex(['role', 'type']);
        const nameIndex = headerIndex(['name', 'fullname']);
        const deptIndex = headerIndex(['department', 'dept']);
        const idIndex = headerIndex(['id', 'studentid', 'officialid']);

        const useLegacyOrder = emailIndex === undefined || roleIndex === undefined;
        const seen = new Set<string>();
        const invites: InviteFormData[] = [];
        const rejected: ImportDetail[] = [];

        rows.slice(1).forEach((row, rowIndex) => {
            const legacy = {
                name: row[0] || '',
                role: row[1] || '',
                id: row[2] || '',
                email: row[3] || '',
                dept: row[4] || '',
            };
            const parsed = useLegacyOrder
                ? legacy
                : {
                      email: row[emailIndex] || '',
                      role: row[roleIndex] || '',
                      name: nameIndex !== undefined ? row[nameIndex] || '' : '',
                      dept: deptIndex !== undefined ? row[deptIndex] || '' : '',
                      id: idIndex !== undefined ? row[idIndex] || '' : '',
                  };

            const email = parsed.email.trim().toLowerCase();
            const role = normalizeRole(parsed.role);
            if (!EMAIL_REGEX.test(email)) {
                rejected.push({
                    email: email || `row ${rowIndex + 2}`,
                    success: false,
                    error: 'Invalid email address',
                });
                return;
            }

            if (seen.has(email)) {
                rejected.push({ email, success: false, error: 'Duplicate email in CSV' });
                return;
            }
            seen.add(email);

            invites.push({
                email,
                name: parsed.name.trim(),
                role,
                id: parsed.id.trim(),
                dept: parsed.dept.trim(),
            });
        });

        return { invites, rejected };
    };

    const handleInviteUser = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsProcessing(true);
        setError(null);

        try {
            const payload = {
                email: inviteFormData.email.trim().toLowerCase(),
                name: inviteFormData.name || undefined,
                role: normalizeRole(inviteFormData.role),
                dept: inviteFormData.dept || undefined,
                id: inviteFormData.id || undefined,
            };

            const result = await AdminService.inviteUser(payload);
            setInvitedEmail(result?.email || payload.email);
            setIsSuccess(true);
            posthog.capture('clerk_invite_success', { role: payload.role });
            toastSuccess(result?.alreadyInvited ? 'Invite already exists' : 'Clerk invitation sent');
            onImport([
                {
                    id: `pending-invite:${result?.pendingInviteId || payload.email}`,
                    pendingInviteId: result?.pendingInviteId,
                    email: result?.email || payload.email,
                    name: result?.name ?? payload.name ?? null,
                    role: result?.role || payload.role,
                    rollNumber: result?.rollNumber ?? payload.id ?? null,
                    department: result?.department ?? payload.dept ?? null,
                    isActive: null,
                    isPendingInvite: true,
                    accountStatus: 'PENDING_INVITE',
                    invited: true,
                    alreadyInvited: result?.alreadyInvited === true,
                    clerkInvitationId: result?.clerkInvitationId,
                    createdAt: new Date().toISOString(),
                },
            ]);
        } catch (error: unknown) {
            const message = getErrorMessage(error, 'Failed to send invitation');
            setError(message);
            toastError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!allowBulkImport) {
            setError('Bulk import is not available on your current plan.');
            return;
        }

        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) {
            setError('Please upload a valid CSV file.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
            try {
                const text = String(readerEvent.target?.result || '');
                const { invites, rejected } = parseInviteCsv(text);

                if (invites.length === 0) {
                    setImportReport({
                        summary: {
                            totalProcessed: rejected.length,
                            invited: 0,
                            alreadyInvited: 0,
                            created: 0,
                            failed: rejected.length,
                            emailsSent: 0,
                            emailsFailed: rejected.length,
                        },
                        details: rejected,
                    });
                    setError('No valid invite rows found in CSV.');
                    return;
                }

                const results = await AdminService.createUsersBulk(invites);
                const details = [...(results.details || []), ...rejected];
                const summary = {
                    ...(results.summary || {}),
                    totalProcessed: Number(results.summary?.totalProcessed || 0) + rejected.length,
                    failed: Number(results.summary?.failed || 0) + rejected.length,
                    emailsFailed: Number(results.summary?.emailsFailed || 0) + rejected.length,
                };
                setImportReport({ summary, details });
                toastSuccess(`Processed ${summary.totalProcessed} CSV invite rows.`);
                onImport(
                    details
                        .filter((item) => item.success)
                        .map((item) => ({
                            id: `pending-invite:${item.pendingInviteId || item.email}`,
                            pendingInviteId: item.pendingInviteId,
                            email: item.email,
                            name: item.name ?? null,
                            role: item.role,
                            rollNumber: item.rollNumber ?? null,
                            department: item.department ?? null,
                            isActive: null,
                            isPendingInvite: true,
                            accountStatus: 'PENDING_INVITE',
                            invited: item.invited === true,
                            alreadyInvited: item.alreadyInvited === true,
                            clerkInvitationId: item.clerkInvitationId,
                            createdAt: new Date().toISOString(),
                        })),
                );
            } catch (error: unknown) {
                const message = getErrorMessage(error, 'Failed to process bulk import');
                setError(message);
                toastError(message);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(file);
    };

    const downloadSampleCSV = () => {
        const content =
            'Email,Role,Name,Department,ID\njohn@example.com,User,John Doe,Computer Science,STU001\njane@example.com,Teacher,Dr. Jane Smith,Information Technology,TEA002\nadmin@example.com,Admin,Campus Admin,Administration,ADM001';
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'sample_clerk_invites.csv';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
    };

    const closeSuccess = () => {
        setIsSuccess(false);
        setInvitedEmail(null);
        setInviteFormData({ name: '', email: '', id: '', role: 'User', dept: '' });
        onClose();
    };

    return {
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
    };
}
