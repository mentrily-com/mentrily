import { customAlphabet } from 'nanoid';

const slugAlphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const MAX_SEGMENT_LENGTH = 40;

function slugifySegment(input: string): string {
  const slug = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

  // Truncate before trimming the dashes, otherwise the cut itself can leave a
  // trailing one ("…-certification-exam" → "…-certification-"). Cutting on a
  // word boundary also avoids ending on half a word.
  let truncated = slug;
  if (slug.length > MAX_SEGMENT_LENGTH) {
    truncated = slug.slice(0, MAX_SEGMENT_LENGTH);
    if (slug[MAX_SEGMENT_LENGTH] !== '-' && truncated.includes('-')) {
      truncated = truncated.slice(0, truncated.lastIndexOf('-'));
    }
  }

  return truncated.replace(/^-+|-+$/g, '');
}

export function generateRandomSlug(
  title?: string,
  prefix = 'item',
  length = 10,
) {
  const base = slugifySegment(title || '') || prefix;
  const createSuffix = customAlphabet(slugAlphabet, length);
  return `${base}-${createSuffix()}`;
}

export function normalizeSlug(input?: string | null) {
  return slugifySegment(String(input || ''));
}
