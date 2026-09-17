import { countQuestions } from './exam.util';

const section = (id: string, n: number) => ({
  id,
  title: id,
  questions: Array.from({ length: n }, (_, i) => ({ id: `${id}-q${i}` })),
});

describe('countQuestions', () => {
  it('counts questions inside a list of sections (the builder shape)', () => {
    expect(
      countQuestions([
        section('sec-1', 10),
        section('sec-2', 9),
        section('sec-3', 6),
      ]),
    ).toEqual({
      totalQuestions: 25,
      totalSections: 3,
    });
  });

  it('counts a { sections } wrapper', () => {
    expect(
      countQuestions({ sections: [section('s1', 2), section('s2', 3)] }),
    ).toEqual({
      totalQuestions: 5,
      totalSections: 2,
    });
  });

  it('counts a flat list of questions as one section', () => {
    expect(countQuestions([{ id: 'q1' }, { id: 'q2' }])).toEqual({
      totalQuestions: 2,
      totalSections: 1,
    });
  });

  it('counts a map of questions as one section', () => {
    expect(countQuestions({ q1: { id: 'q1' }, q2: { id: 'q2' } })).toEqual({
      totalQuestions: 2,
      totalSections: 1,
    });
  });

  it('counts sections and loose questions together', () => {
    expect(countQuestions([section('s1', 3), { id: 'loose' }])).toEqual({
      totalQuestions: 4,
      totalSections: 2,
    });
  });

  it('handles empty and missing content', () => {
    expect(countQuestions(null)).toEqual({
      totalQuestions: 0,
      totalSections: 0,
    });
    expect(countQuestions([])).toEqual({ totalQuestions: 0, totalSections: 0 });
  });
});
