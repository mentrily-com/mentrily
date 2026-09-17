/** Readable plain text from sanitized rich text, for previews only. */
export function plainTextFromHtml(html: string | undefined): string {
    if (!html) return '';
    return html
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|li|h\d|pre|blockquote|div)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
