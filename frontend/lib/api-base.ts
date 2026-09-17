export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);

    // Add ngrok bypass header if the request goes to our API base URL
    const urlString = typeof input === 'string' ? input : input.toString();
    if (urlString.startsWith(API_BASE_URL)) {
        headers.set('ngrok-skip-browser-warning', '69420');
    }

    return fetch(input, {
        ...init,
        headers,
    });
}
