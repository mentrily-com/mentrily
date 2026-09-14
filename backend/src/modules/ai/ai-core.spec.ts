import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { creditsForUsage, estimateCredits } from './engine/ai-types';
import {
  AiCallMeta,
  AiOutputError,
  OmniRouteService,
} from './engine/omniroute.service';
import {
  BuilderQuestion,
  coerceDifficulty,
  coerceMarks,
  coerceType,
} from './quality/normalize';
import { asText, plainText, sanitizeRichText } from './quality/sanitize';
import { validateQuestion } from './quality/validators';

describe('AI credits', () => {
  const usage = (input: number, output: number, cached = 0) => ({
    inputTokens: input,
    outputTokens: output,
    cachedTokens: cached,
    totalTokens: input + output,
  });

  it('charges nothing for a call that used no tokens', () => {
    expect(creditsForUsage('standard', usage(0, 0))).toBe(0);
  });

  it('charges at least one credit for any real call', () => {
    expect(creditsForUsage('lite', usage(10, 5))).toBe(1);
  });

  it('weights output 3x and scales by tier', () => {
    // (1000 + 1000 * 3) = 4000 weighted tokens = 2 lite credits.
    expect(creditsForUsage('lite', usage(1000, 1000))).toBe(2);
    expect(creditsForUsage('standard', usage(1000, 1000))).toBe(4);
    expect(creditsForUsage('pro', usage(1000, 1000))).toBe(8);
  });

  it('discounts cached input to a quarter, never below zero', () => {
    // 8000 input, all cached => 2000 weighted => 1 lite credit.
    expect(creditsForUsage('lite', usage(8000, 0, 8000))).toBe(1);
    // Cached larger than input is clamped to input.
    expect(creditsForUsage('lite', usage(8000, 0, 99_999))).toBe(1);
  });

  it('estimates with the same formula as actual usage', () => {
    expect(estimateCredits('standard', 1200, 1400)).toBe(
      creditsForUsage('standard', usage(1200, 1400)),
    );
  });
});

describe('AI output normalisation', () => {
  it('coerces loose question type names within the allowed set', () => {
    expect(coerceType('multi select', ['MCQ', 'MultiSelect'], 'MCQ')).toBe(
      'MultiSelect',
    );
    expect(coerceType('single choice', ['MCQ'], 'MCQ')).toBe('MCQ');
    expect(coerceType('Coding', ['MCQ', 'MultiSelect'], 'MCQ')).toBe('MCQ');
    expect(coerceType({ type: 'Coding' }, ['Reading', 'MCQ'], 'MCQ')).toBe(
      'MCQ',
    );
  });

  it('maps difficulty synonyms and defaults to Medium', () => {
    expect(coerceDifficulty('beginner')).toBe('Easy');
    expect(coerceDifficulty('ADVANCED')).toBe('Hard');
    expect(coerceDifficulty(undefined)).toBe('Medium');
  });

  it('keeps sane marks and falls back otherwise', () => {
    expect(coerceMarks('5', 1)).toBe(5);
    expect(coerceMarks(-3, 2)).toBe(2);
    expect(coerceMarks('lots', 0)).toBe(1);
  });

  it('treats non-text model fields as empty rather than "[object Object]"', () => {
    expect(asText({ a: 1 })).toBe('');
    expect(asText(['x'])).toBe('');
    expect(asText(42)).toBe('42');
  });

  it('strips unsafe HTML and wraps plain text into paragraphs', () => {
    expect(
      sanitizeRichText('<p onclick="x()">Hi<script>alert(1)</script></p>'),
    ).toBe('<p>Hi</p>');
    expect(sanitizeRichText('One\n\nTwo < 3 & more')).toBe(
      '<p>One</p><p>Two &lt; 3 &amp; more</p>',
    );
    expect(sanitizeRichText('<iframe src="https://x.test"></iframe>')).toBe('');
    expect(plainText('<p>Hello <b>there</b></p>')).toBe('Hello there');
  });
});

describe('question validation', () => {
  const mcq = (correct: number[]): BuilderQuestion => ({
    id: 'q1',
    type: 'MCQ',
    title: 'Pick one',
    problemStatement: '<p>Which of these is a prime number?</p>',
    marks: 1,
    difficulty: 'Easy',
    tags: [],
    options: ['4', '6', '7', '9'].map((text, i) => ({
      id: `o${i}`,
      text,
      isCorrect: correct.includes(i),
    })),
  });

  it('accepts a well-formed MCQ', () => {
    expect(validateQuestion(mcq([2]))).toEqual([]);
  });

  it('flags an MCQ with more than one correct option', () => {
    expect(validateQuestion(mcq([1, 2]))).toContain(
      'MCQ needs exactly 1 correct option (has 2)',
    );
  });
});

describe('structured output repair', () => {
  const service = new OmniRouteService({
    get: () => undefined,
  } as unknown as ConfigService);
  const schema = z.object({ title: z.string(), count: z.number() });
  const meta = {} as AiCallMeta;
  const repair = (text: string) =>
    (
      service as unknown as {
        repairStructured: (
          s: typeof schema,
          t: string,
          m: AiCallMeta,
        ) => z.infer<typeof schema>;
      }
    ).repairStructured(schema, text, meta);

  it('parses JSON wrapped in fences and prose', () => {
    expect(
      repair('Here you go:\n```json\n{"title": "A", "count": 2}\n```'),
    ).toEqual({ title: 'A', count: 2 });
  });

  it('repairs trailing commas and single quotes', () => {
    expect(repair("{'title': 'B', 'count': 3,}")).toEqual({
      title: 'B',
      count: 3,
    });
  });

  it('rejects output that does not match the schema', () => {
    expect(() => repair('{"title": "C"}')).toThrow(AiOutputError);
  });
});
