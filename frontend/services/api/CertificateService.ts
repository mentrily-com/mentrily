import { API_BASE_URL, apiFetch } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { withClerkAuthorization } from '@/lib/clerk-token';

const BASE_URL = API_BASE_URL;

type QrPosition = 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface CertificateTemplateLayout {
    preset?: 'classic' | 'modern' | 'minimal' | 'dark';
    title?: { text?: string };
    subtitle?: { text?: string };
    qrCode?: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    };
}

export interface CertificateTemplate {
    id: string;
    orgId: string;
    creatorId: string;
    name: string;
    layout?: CertificateTemplateLayout;
    backgroundUrl?: string | null;
    signatureUrl?: string | null;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCertificateTemplateInput {
    name: string;
    layout?: CertificateTemplateLayout;
    backgroundUrl?: string;
    isDefault?: boolean;
}

export interface UpdateCertificateTemplateInput {
    name?: string;
    layout?: CertificateTemplateLayout;
    backgroundUrl?: string;
    isDefault?: boolean;
}

export type CertificateVerificationResponse = {
    valid: boolean;
    certificate: {
        id: string;
        type: 'course' | 'exam';
        title: string;
        score?: number | null;
        completionPercent?: number | null;
        fileUrl?: string;
        issuedAt: string;
        verificationUrl: string;
        user: {
            id: string;
            name?: string;
            email?: string;
        };
        organization?: {
            id: string;
            name: string;
            logo?: string | null;
            slug?: string;
        };
    };
};

const getAuthHeaders = async (method?: string, headers: HeadersInit = {}) => {
    return withClerkAuthorization(withCsrfHeader(method, headers));
};

const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
        ...((options.headers || {}) as Record<string, string>),
    };

    if (!isFormData && options.body) {
        headers['Content-Type'] = 'application/json';
    }

    const authHeaders = await getAuthHeaders(options.method, headers);

    return apiFetch(`${BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: authHeaders,
    });
};

const parseApiError = async (res: Response, fallbackMessage: string) => {
    const payload = await res.json().catch(() => ({}) as any);
    const message =
        typeof payload?.message === 'string'
            ? payload.message
            : Array.isArray(payload?.message)
              ? payload.message.join(', ')
              : fallbackMessage;

    const error = new Error(message || fallbackMessage) as Error & {
        status?: number;
        payload?: unknown;
    };
    error.status = res.status;
    error.payload = payload;
    return error;
};

const getQrPositionLayout = (position: QrPosition) => {
    if (position === 'bottom-left') {
        return { x: 54, y: 455, width: 90, height: 90 };
    }
    if (position === 'bottom-center') {
        return { x: 252, y: 455, width: 90, height: 90 };
    }
    return { x: 454, y: 455, width: 90, height: 90 };
};

export const CertificateService = {
    getQrPositionLayout,

    async listTemplates(): Promise<CertificateTemplate[]> {
        const res = await authFetch('/teacher/certificate-templates');
        if (!res.ok) throw await parseApiError(res, 'Failed to fetch certificate templates');
        return res.json();
    },

    async createTemplate(data: CreateCertificateTemplateInput): Promise<CertificateTemplate> {
        const res = await authFetch('/teacher/certificate-templates', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!res.ok) throw await parseApiError(res, 'Failed to create template');
        return res.json();
    },

    async updateTemplate(id: string, data: UpdateCertificateTemplateInput): Promise<CertificateTemplate> {
        const res = await authFetch(`/teacher/certificate-templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!res.ok) throw await parseApiError(res, 'Failed to update template');
        return res.json();
    },

    async deleteTemplate(id: string): Promise<{ success: boolean }> {
        const res = await authFetch(`/teacher/certificate-templates/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({}),
        });
        if (!res.ok) throw await parseApiError(res, 'Failed to delete template');
        return res.json();
    },

    async uploadSignature(templateId: string, file: File): Promise<{ id: string; signatureUrl: string }> {
        const formData = new FormData();
        formData.append('file', file);

        const res = await authFetch(`/teacher/certificate-templates/${templateId}/signature`, {
            method: 'POST',
            body: formData,
            headers: {
                'x-file-size': String(file.size),
            },
        });
        if (!res.ok) throw await parseApiError(res, 'Failed to upload signature');
        return res.json();
    },

    async verifyCertificate(code: string): Promise<CertificateVerificationResponse> {
        const res = await apiFetch(`${BASE_URL}/certificate/verify/${code}`, {
            method: 'GET',
            cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to verify certificate');
        return res.json();
    },
};
