// Which org the workspace switcher last pointed at, for this browser. A
// plain module-level singleton (same pattern as clerk-token.ts) rather than
// a React context — every API call reads it fresh via withClerkAuthorization,
// no reactivity needed outside the switcher component itself.
const ACTIVE_ORG_STORAGE_KEY = 'active-org-id';
// "Act as learner" persona. When set to 'learner', every request carries an
// X-Active-Persona header and the backend resolves the caller as an org-less
// Student — this is how a creator (even one who was never a learner) can drop
// into the learner experience and switch back. Mutually exclusive with an
// active org: picking one clears the other.
const ACTIVE_PERSONA_STORAGE_KEY = 'active-persona';

let activeOrgId: string | null = null;
let activePersona: string | null = null;
let initialized = false;

function ensureInitialized(): void {
    if (initialized) return;
    initialized = true;
    if (typeof window !== 'undefined') {
        activeOrgId = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) || null;
        activePersona = window.localStorage.getItem(ACTIVE_PERSONA_STORAGE_KEY) || null;
    }
}

export function getActiveOrgId(): string | null {
    ensureInitialized();
    return activeOrgId;
}

export function setActiveOrgId(orgId: string | null): void {
    ensureInitialized();
    activeOrgId = orgId;

    if (orgId) {
        // Switching into a concrete org exits any "act as learner" mode.
        activePersona = null;
    }

    if (typeof window === 'undefined') return;

    if (orgId) {
        window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
        window.localStorage.removeItem(ACTIVE_PERSONA_STORAGE_KEY);
    } else {
        window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
    }
}

export function clearActiveOrgId(): void {
    setActiveOrgId(null);
}

export function getActivePersona(): string | null {
    ensureInitialized();
    return activePersona;
}

// Set to 'learner' to act as a learner, or null to clear. The learner persona
// is always org-less, so activating it drops any active org pointer.
export function setActivePersona(persona: string | null): void {
    ensureInitialized();
    activePersona = persona;

    if (typeof window === 'undefined') return;

    if (persona) {
        window.localStorage.setItem(ACTIVE_PERSONA_STORAGE_KEY, persona);
    } else {
        window.localStorage.removeItem(ACTIVE_PERSONA_STORAGE_KEY);
    }
}

export function clearActivePersona(): void {
    setActivePersona(null);
}
