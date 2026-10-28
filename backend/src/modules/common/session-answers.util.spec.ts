import {
  answerPatchError,
  filterStagedAnswers,
  indexExamQuestions,
} from './session-answers.util';

describe('answerPatchError', () => {
  it('accepts what the exam client sends', () => {
    expect(
      answerPatchError({
        q1: 'q1-opt-2',
        _rev_q1: true,
        _internal_position: { section: 1 },
        _section_s1_submitted: true,
      }),
    ).toBeNull();
  });

  it('rejects writes to server-computed grading keys', () => {
    expect(answerPatchError({ _internal_score: { percentage: 100 } })).toBe(
      'INVALID_ANSWER_KEY',
    );
  });

  it('never lets a submitted section be reopened', () => {
    expect(answerPatchError({ _section_s1_submitted: false })).toBe(
      'INVALID_ANSWER_KEY',
    );
  });

  it('caps value size and key count', () => {
    expect(answerPatchError({ junk: 'A'.repeat(300_000) })).toBe(
      'ANSWER_TOO_LARGE',
    );
    const many = Object.fromEntries(
      Array.from({ length: 501 }, (_, i) => [`q${i}`, 1]),
    );
    expect(answerPatchError(many)).toBe('TOO_MANY_ANSWERS');
  });

  it('rejects non-objects', () => {
    expect(answerPatchError(null)).toBe('INVALID_ANSWER');
    expect(answerPatchError(['q1'])).toBe('INVALID_ANSWER');
  });
});

describe('filterStagedAnswers', () => {
  const index = indexExamQuestions({
    sections: [
      { id: 'sec-1', questions: [{ id: 'q1' }, { id: 'q2' }] },
      { id: 'sec-2', questions: [{ id: 'q3' }] },
    ],
  });

  it('keeps real questions and client bookkeeping, drops junk', () => {
    const { accepted, dropped } = filterStagedAnswers(
      {
        q1: ['a'],
        _rev_q1: true,
        _submitted_q3: true,
        _internal_position: { section: 'sec-1' },
        '_section_sec-1_submitted': true,
        junk_0: 'A'.repeat(10),
        _rev_nope: true,
      },
      index,
      {},
    );
    expect(Object.keys(accepted).sort()).toEqual(
      [
        '_internal_position',
        '_rev_q1',
        '_section_sec-1_submitted',
        '_submitted_q3',
        'q1',
      ].sort(),
    );
    expect(dropped.sort()).toEqual(['_rev_nope', 'junk_0']);
  });

  it('rejects answers to a section already submitted in Postgres', () => {
    const { accepted, dropped } = filterStagedAnswers(
      { q1: ['b'], _submitted_q2: true, q3: ['c'] },
      index,
      { '_section_sec-1_submitted': true },
    );
    expect(accepted).toEqual({ q3: ['c'] });
    expect(dropped.sort()).toEqual(['_submitted_q2', 'q1']);
  });

  it("lets a section's own submit batch land", () => {
    const { accepted } = filterStagedAnswers(
      { q1: ['a'], '_section_sec-1_submitted': true },
      index,
      {},
    );
    expect(accepted).toEqual({ q1: ['a'], '_section_sec-1_submitted': true });
  });

  it('indexes flat question lists', () => {
    expect([...indexExamQuestions([{ id: 'a' }, { id: 'b' }])]).toEqual([
      ['a', null],
      ['b', null],
    ]);
  });
});

describe('answerPatchError hardening', () => {
  it('rejects NUL characters in keys and nested values (Postgres jsonb rejects them)', () => {
    expect(answerPatchError({ q1: 'a\u0000b' })).toBe('INVALID_ANSWER');
    expect(answerPatchError({ q1: { code: ['x', { y: '\u0000' }] } })).toBe(
      'INVALID_ANSWER',
    );
    expect(answerPatchError({ 'q\u00001': 'a' })).toBe('INVALID_ANSWER');
    // The six-character escape text is legitimate code, not a NUL.
    expect(
      answerPatchError({ q1: { code: "char c = '\\u0000';" } }),
    ).toBeNull();
  });

  it('rejects client writes to server coding results', () => {
    expect(
      answerPatchError({ '_internal_coding:q1': { passed: 9, total: 9 } }),
    ).toBe('INVALID_ANSWER_KEY');
  });

  it('allows a larger key cap for the final submit', () => {
    const many = Object.fromEntries(
      Array.from({ length: 600 }, (_, i) => [`q${i}`, 'a']),
    );
    expect(answerPatchError(many)).toBe('TOO_MANY_ANSWERS');
    expect(answerPatchError(many, 5000)).toBeNull();
  });
});

describe('filterStagedAnswers server-only keys', () => {
  it('never persists staged _internal_coding keys', () => {
    const index = indexExamQuestions([{ id: 'q1' }]);
    const { accepted, dropped } = filterStagedAnswers(
      { q1: 'x', '_internal_coding:q1': { passed: 5, total: 5 } },
      index,
      {},
    );
    expect(accepted).toEqual({ q1: 'x' });
    expect(dropped).toEqual(['_internal_coding:q1']);
  });
});
