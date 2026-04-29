const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getCookieValue(name: string): string {
    if (typeof document === 'undefined') return '';

    const raw =
        document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
            ?.split('=')[1] || '';

    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

export function withCsrfHeader(method: string | undefined, headers: HeadersInit = {}): HeadersInit {
    const normalizedMethod = String(method || 'GET').toUpperCase();
    if (!STATE_CHANGING_METHODS.has(normalizedMethod)) {
        return headers;
    }

    const token = getCookieValue('csrf_token');
    if (!token) {
        return headers;
    }

    return {
        ...(headers as Record<string, string>),
        'X-CSRF-Token': token,
    };
}
