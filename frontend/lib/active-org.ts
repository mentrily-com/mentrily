// Which org the workspace switcher last pointed at, for this browser. A
// plain module-level singleton (same pattern as clerk-token.ts) rather than
// a React context — every API call reads it fresh via withClerkAuthorization,
// no reactivity needed outside the switcher component itself.
const ACTIVE_ORG_STORAGE_KEY = 'active-org-id';

let activeOrgId: string | null = null;
let initialized = false;

function ensureInitialized(): void {
    if (initialized) return;
    initialized = true;
    if (typeof window !== 'undefined') {
        activeOrgId = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) || null;
    }
}

export function getActiveOrgId(): string | null {
    ensureInitialized();
    return activeOrgId;
}

export function setActiveOrgId(orgId: string | null): void {
    ensureInitialized();
    activeOrgId = orgId;
    if (typeof window === 'undefined') return;

    if (orgId) {
        window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
    } else {
        window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
    }
}

export function clearActiveOrgId(): void {
    setActiveOrgId(null);
}
