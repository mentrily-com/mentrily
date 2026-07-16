/**
 * Per-org Crisp gating: an org opted into support chat via
 * features.crispChat (set by the super admin, e.g. the beta/tester org)
 * shows the widget to its members in any workspace view — creator AND
 * learner-preview. The flag arrives on sessionUser.features via /auth/me
 * (the backend spreads org features into the session payload).
 */
export function orgHasCrispChat(sessionUser: any): boolean {
    return sessionUser?.features?.crispChat === true;
}
