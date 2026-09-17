// Carries a prompt typed on the public /ai page across sign-in / sign-up so
// the dashboard Studio can pick it up. localStorage (not sessionStorage) so
// it survives the OAuth round trip and the sign-up onboarding flow.

const KEY = 'mentrily-ai-prompt-handoff';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PromptHandoff {
    command: string;
    text: string;
    savedAt: number;
}

export function savePromptHandoff(value: { command?: string | null; text: string }) {
    const text = value.text.trim();
    if (!text) return;
    try {
        const payload: PromptHandoff = { command: value.command ?? '', text: text.slice(0, 4000), savedAt: Date.now() };
        window.localStorage.setItem(KEY, JSON.stringify(payload));
    } catch {
        // Storage disabled: the visitor just retypes after signing in.
    }
}

/** Returns the saved prompt once and clears it. Stale or malformed entries are dropped. */
export function takePromptHandoff(): PromptHandoff | null {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        window.localStorage.removeItem(KEY);
        const parsed = JSON.parse(raw) as Partial<PromptHandoff>;
        if (typeof parsed.text !== 'string' || !parsed.text.trim()) return null;
        if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
        return {
            command: typeof parsed.command === 'string' ? parsed.command : '',
            text: parsed.text,
            savedAt: parsed.savedAt,
        };
    } catch {
        return null;
    }
}

/** Where a saved prompt is resumed after sign-in: the standalone chat app. */
export const STUDIO_RESUME_PATH = '/chat?resume=1';
