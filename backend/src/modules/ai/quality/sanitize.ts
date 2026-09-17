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

// Real HTML elements are left to the sanitizer (kept or stripped, e.g. script).
const HTML_ELEMENTS = new Set(
  `a abbr address area article aside audio b base bdi bdo blockquote body br
  button canvas caption cite code col colgroup data datalist dd del details dfn
  dialog div dl dt em embed fieldset figcaption figure footer form frame frameset
  h1 h2 h3 h4 h5 h6 head header hr html i iframe img input ins kbd label legend
  li link main map mark math menu meta meter nav noscript object ol optgroup
  option output p param picture pre progress q rp rt ruby s samp script section
  select slot small source span strong style sub summary sup svg table tbody td
  template textarea tfoot th thead time title tr track u ul var video wbr`.split(
    /\s+/,
  ),
);

/**
 * Placeholders like "Print <count>" or "#include <vector>" look like tags to
 * the sanitizer, which would silently delete them. Anything that isn't an
 * HTML element is escaped so it shows as text instead.
 */
function escapeUnknownTags(html: string): string {
  return html.replace(
    /<(\/?)([a-zA-Z][\w-]*)([^<>]*)>/g,
    (match, slash: string, name: string, rest: string) =>
      HTML_ELEMENTS.has(name.toLowerCase())
        ? match
        : `&lt;${slash}${name}${rest}&gt;`,
  );
}

/** Sanitizes model HTML; plain-text answers are wrapped into paragraphs. */
export function sanitizeRichText(raw: unknown): string {
  const text = asText(raw).trim();
  if (!text) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text);
  const html = looksLikeHtml
    ? escapeUnknownTags(text)
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
