import { generateRandomSlug, normalizeSlug } from './slug.util';

describe('slug.util', () => {
  it('never ends with a dash when the title is truncated', () => {
    // 44 chars before truncation: the 40-char cut lands on the dash.
    expect(normalizeSlug('Java Programming Beginner Certification Exam')).toBe(
      'java-programming-beginner-certification',
    );
  });

  it('does not cut a word in half', () => {
    const slug = normalizeSlug(
      'Introduction to Advanced Thermodynamics Laboratory',
    );
    expect(slug).toBe('introduction-to-advanced-thermodynamics');
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it('still truncates a single long word', () => {
    expect(normalizeSlug('a'.repeat(60))).toBe('a'.repeat(40));
  });

  it('cleans punctuation, spacing and stray dashes', () => {
    expect(normalizeSlug('  --Grade 5: Fractions & Decimals!--  ')).toBe(
      'grade-5-fractions-decimals',
    );
    expect(normalizeSlug('')).toBe('');
  });

  it('adds a unique suffix with exactly one dash before it', () => {
    const slug = generateRandomSlug(
      'Java Programming Beginner Certification Exam',
      'exam',
    );
    expect(slug).toMatch(
      /^java-programming-beginner-certification-[a-z2-9]{10}$/,
    );
    expect(slug).not.toContain('--');
  });

  it('falls back to the prefix when the title has no usable characters', () => {
    expect(generateRandomSlug('!!!', 'exam')).toMatch(/^exam-[a-z2-9]{10}$/);
  });
});
