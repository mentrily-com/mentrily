import type { EditChange } from '../jobs/ai-job.types';
import type { BuilderQuestion, GeneratedQuestion } from '../quality/normalize';
import {
  applyChange,
  invertChange,
  sameItem,
  type EditableContent,
} from './edit-apply';

const item = (id: string, title = `Item ${id}`): BuilderQuestion => ({
  id,
  type: 'Reading',
  title,
  problemStatement: `<p>${title}</p>`,
  marks: 1,
  difficulty: 'Medium',
  tags: [],
});

const generated = (q: BuilderQuestion): GeneratedQuestion => ({
  ...q,
  aiMeta: { status: 'ok', issues: [] },
});

const content = (): EditableContent => ({
  title: 'Fractions',
  description: 'Grade 5',
  sections: [
    { id: 's1', title: 'Basics', items: [item('a'), item('b')] },
    { id: 's2', title: 'Practice', items: [item('c')] },
  ],
});

const ids = (c: EditableContent) =>
  c.sections.map((s) => `${s.id}:${s.items.map((i) => i.id).join(',')}`);

/** Applies `change`, then its inverse, and expects the original back. */
function roundTrip(change: EditChange) {
  const c = content();
  const original = JSON.stringify(c);
  expect(applyChange(c, change)).toEqual({ ok: true });
  expect(JSON.stringify(c)).not.toBe(original);
  expect(applyChange(c, invertChange(change))).toEqual({ ok: true });
  expect(JSON.stringify(c)).toBe(original);
}

describe('edit-apply', () => {
  it('ignores key order and AI metadata when comparing items', () => {
    const a = item('a');
    const reordered = Object.fromEntries(
      Object.entries(a).reverse(),
    ) as unknown as BuilderQuestion;
    expect(sameItem(a, reordered)).toBe(true);
    expect(sameItem(a, generated(a))).toBe(true);
    expect(sameItem(a, { ...a, title: 'Changed' })).toBe(false);
  });

  it('edits an item in place and keeps its id', () => {
    const c = content();
    const after = generated({ ...item('a', 'New title'), id: 'model-id' });
    const res = applyChange(c, {
      id: 'x',
      kind: 'edit_item',
      summary: '',
      sectionId: 's1',
      itemId: 'a',
      before: item('a'),
      after,
    });
    expect(res).toEqual({ ok: true });
    expect(c.sections[0].items[0]).toMatchObject({
      id: 'a',
      title: 'New title',
    });
    expect(c.sections[0].items[0]).not.toHaveProperty('aiMeta');
  });

  it('skips an edit when the item changed since the proposal', () => {
    const c = content();
    c.sections[0].items[0].title = 'Edited in the builder';
    const res = applyChange(c, {
      id: 'x',
      kind: 'edit_item',
      summary: '',
      sectionId: 's1',
      itemId: 'a',
      before: item('a'),
      after: generated(item('a', 'AI title')),
    });
    expect(res.ok).toBe(false);
    expect(c.sections[0].items[0].title).toBe('Edited in the builder');
  });

  it('skips removing an item that changed since the proposal', () => {
    const c = content();
    c.sections[0].items[1].marks = 5;
    const res = applyChange(c, {
      id: 'x',
      kind: 'remove_item',
      summary: '',
      sectionId: 's1',
      index: 1,
      before: item('b'),
    });
    expect(res.ok).toBe(false);
    expect(ids(c)).toEqual(['s1:a,b', 's2:c']);
  });

  it('does not add the same item twice', () => {
    const c = content();
    const change: EditChange = {
      id: 'x',
      kind: 'add_item',
      summary: '',
      sectionId: 's2',
      index: 0,
      after: generated(item('n')),
    };
    expect(applyChange(c, change)).toEqual({ ok: true });
    expect(applyChange(c, change).ok).toBe(false);
    expect(ids(c)).toEqual(['s1:a,b', 's2:n,c']);
  });

  it('clamps out-of-range positions', () => {
    const c = content();
    applyChange(c, {
      id: 'x',
      kind: 'add_item',
      summary: '',
      sectionId: 's2',
      index: 99,
      after: generated(item('n')),
    });
    expect(ids(c)).toEqual(['s1:a,b', 's2:c,n']);
  });

  it('undoes every kind of change', () => {
    roundTrip({
      id: '1',
      kind: 'edit_item',
      summary: '',
      sectionId: 's1',
      itemId: 'b',
      before: item('b'),
      after: generated(item('b', 'Better')),
    });
    roundTrip({
      id: '2',
      kind: 'add_item',
      summary: '',
      sectionId: 's1',
      index: 1,
      after: generated(item('n')),
    });
    roundTrip({
      id: '3',
      kind: 'remove_item',
      summary: '',
      sectionId: 's1',
      index: 0,
      before: item('a'),
    });
    roundTrip({
      id: '4',
      kind: 'move_item',
      summary: '',
      itemId: 'a',
      from: { sectionId: 's1', index: 0 },
      to: { sectionId: 's2', index: 1 },
    });
    roundTrip({
      id: '5',
      kind: 'add_section',
      summary: '',
      sectionId: 's3',
      index: 1,
      title: 'Word problems',
      items: [generated(item('w'))],
    });
    roundTrip({
      id: '6',
      kind: 'remove_section',
      summary: '',
      sectionId: 's2',
      index: 1,
      before: { title: 'Practice', items: [item('c')] },
    });
    roundTrip({
      id: '7',
      kind: 'rename_section',
      summary: '',
      sectionId: 's1',
      before: 'Basics',
      after: 'Fraction basics',
    });
    roundTrip({
      id: '8',
      kind: 'update_details',
      summary: '',
      before: { title: 'Fractions', description: 'Grade 5' },
      after: { title: 'Fractions, grade 5', description: 'Hands-on unit' },
    });
  });
});
