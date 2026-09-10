import DOMPurify from 'isomorphic-dompurify';

/**
 * The single sanitization entry point for operator-authored HTML.
 *
 * Course units, question descriptions and announcements are authored by
 * Teacher/Admin accounts and rendered into other users' sessions — including
 * students sitting a monitored, timed exam. Every `dangerouslySetInnerHTML`
 * that carries such content must go through this module.
 *
 * Centralizing matters because DOMPurify hooks are registered on a shared
 * singleton. When individual components call `addHook` at module scope, the
 * active hook set depends on which components happen to have been imported —
 * so the same string can sanitize differently depending on route and code
 * splitting. Registering exactly once, here, makes the policy deterministic
 * for every call site.
 */

// The only authoring feature that emits <iframe> is the RichTextEditor YouTube
// embed (@tiptap/extension-youtube). Allowing the tag without constraining the
// host would let any author frame arbitrary third-party content inside an exam
// — a phishing and clickjacking surface aimed straight at candidates.
const ALLOWED_IFRAME_HOSTS: ReadonlySet<string> = new Set([
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'youtube-nocookie.com',
]);

// Registered once per module evaluation. The hook only ever *removes* nodes,
// so it is fail-closed: a call site that forgets to allow iframes still gets
// the stricter default behaviour.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'iframe') return;
    const el = node as unknown as HTMLIFrameElement;
    const src = el.getAttribute?.('src') || '';
    try {
        const url = new URL(src, 'https://invalid.local');
        if (url.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.has(url.hostname)) {
            // Constrain the frame even when the host is trusted, so a
            // compromised or changed embed cannot navigate the top window.
            el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
            el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            return;
        }
    } catch {
        // fall through to removal
    }
    el.remove?.();
});

// Force every link to open safely: `noopener` denies the target page access to
// `window.opener`, which is otherwise a same-tab redirect vector.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as unknown as HTMLElement;
    if (el.tagName === 'A' && el.hasAttribute?.('href')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
    }
});

const RICH_TEXT_CONFIG = Object.freeze({
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
});

/**
 * Sanitizes authored rich text that may legitimately contain a YouTube embed
 * (course units, question descriptions, reading content).
 */
export function sanitizeRichText(html: unknown): string {
    return DOMPurify.sanitize(String(html ?? ''), RICH_TEXT_CONFIG);
}

/**
 * Sanitizes prose that has no embed affordance (announcements, notifications).
 * Iframes are stripped entirely rather than host-checked.
 */
export function sanitizeProse(html: unknown): string {
    return DOMPurify.sanitize(String(html ?? ''));
}
