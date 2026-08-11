import DOMPurify from 'isomorphic-dompurify';

// The only authoring feature that produces <iframe> in question content is
// the YouTube embed block (RichTextEditor's @tiptap/extension-youtube) —
// ADD_TAGS: ['iframe'] below has to allow the tag, but without this hook any
// Teacher/Admin account (self-serve obtainable) could embed an arbitrary
// third-party iframe into a question shown inside a monitored, timed exam —
// a phishing/clickjacking surface aimed straight at students. Strip any
// iframe whose src isn't a YouTube embed URL.
const ALLOWED_IFRAME_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com']);
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'iframe') return;
    const el = node as unknown as HTMLIFrameElement;
    const src = el.getAttribute?.('src') || '';
    try {
        const url = new URL(src, 'https://invalid.local');
        if (url.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.has(url.hostname)) return;
    } catch {
        // fall through to removal
    }
    el.remove?.();
});

export default DOMPurify;
