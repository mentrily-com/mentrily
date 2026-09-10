import { customAlphabet } from 'nanoid';

const slugAlphabet = 'abcdefghjkmnpqrstuvwxyz23456789';

function slugifySegment(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
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
