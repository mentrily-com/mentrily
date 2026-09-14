import sanitizeHtml from 'sanitize-html';

// Mirrors the frontend's lib/sanitize.ts policy for authored rich text, minus
// iframes: generated content never needs embeds, and reference material fed
// into prompts could otherwise steer the model into emitting one.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'sub',
    'sup',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'h2',
    'h3',
    'h4',
    'a',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    code: ['class'],
    pre: ['class'],
    span: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedClasses: {
    code: [/^language-[\w-]+$/],
    pre: [/^language-[\w-]+$/],
    span: [/^hljs-[\w-]+$/],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
    h1: 'h2',
  },
  disallowedTagsMode: 'discard',
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Model fields that should be text; anything else (objects, arrays) is dropped. */
export function asText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return '';
}

/** Sanitizes model HTML; plain-text answers are wrapped into paragraphs. */
export function sanitizeRichText(raw: unknown): string {
  const text = asText(raw).trim();
  if (!text) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text);
  const html = looksLikeHtml
    ? text
    : text
        .split(/\n{2,}/)
        .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
        .join('');
  return sanitizeHtml(html, OPTIONS).trim();
}

export function plainText(raw: unknown, max = 500): string {
  return sanitizeHtml(asText(raw), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
