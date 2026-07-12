import { API_BASE_URL } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { withClerkAuthorization } from '@/lib/clerk-token';

const BASE_URL = API_BASE_URL;

export type UploadKind = 'course-video' | 'bug-report' | 'announcement' | 'org-logo';

export interface UploadedFile {
    url: string;
    name: string;
    type: string;
    size: number;
}

interface PresignResponse {
    key: string;
    uploadUrl: string;
    publicUrl: string;
}

async function presign(kind: UploadKind, file: File): Promise<PresignResponse> {
    const headers = await withClerkAuthorization(
        withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
    );
    const res = await fetch(`${BASE_URL}/uploads/presign`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
            kind,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
        }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to prepare upload');
    }

    return res.json();
}

function putToS3(uploadUrl: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled')));

        // Direct PUT to S3 — no credentials/CSRF, the presigned URL itself
        // authorizes the write.
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
    });
}

async function confirm(kind: UploadKind, key: string): Promise<UploadedFile> {
    const headers = await withClerkAuthorization(
        withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
    );
    const res = await fetch(`${BASE_URL}/uploads/confirm`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ kind, key }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to confirm upload');
    }

    return res.json();
}

export const UploadService = {
    /**
     * Uploads a file directly to S3 (browser -> S3, bypassing our backend and
     * Vercel entirely) and returns its public CDN URL. Every file, from a 2KB
     * bug-report screenshot to a 500MB course video, goes through this same
     * presign -> PUT -> confirm flow.
     */
    async uploadFile(
        kind: UploadKind,
        file: File,
        onProgress?: (percent: number) => void,
    ): Promise<UploadedFile> {
        const { uploadUrl, key } = await presign(kind, file);
        await putToS3(uploadUrl, file, onProgress);
        return confirm(kind, key);
    },
};
