import type { EditChange } from '../jobs/ai-job.types';
import type { BuilderQuestion, GeneratedQuestion } from '../quality/normalize';

/** Editable content in the builder's shape: sections of items. */
export interface EditableSection {
  id: string;
  title: string;
  items: BuilderQuestion[];
}

export interface EditableContent {
  title: string;
  description: string;
  sections: EditableSection[];
}

export type ApplyOutcome = { ok: true } | { ok: false; reason: string };

/** Drops the AI review metadata; what gets saved is the builder question. */
export function toSavedItem(
  item: GeneratedQuestion | BuilderQuestion,
): BuilderQuestion {
  const { aiMeta: _aiMeta, ...rest } = item as GeneratedQuestion;
  return rest;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Same item content, ignoring key order and AI metadata. */
export function sameItem(a: BuilderQuestion, b: BuilderQuestion): boolean {
  return stable(toSavedItem(a)) === stable(toSavedItem(b));
}

function findItem(content: EditableContent, itemId: string) {
  for (const section of content.sections) {
    const index = section.items.findIndex((i) => i.id === itemId);
    if (index !== -1) return { section, index, item: section.items[index] };
  }
  return null;
}

const clampIndex = (index: number, length: number) =>
  Math.max(
    0,
    Math.min(Number.isFinite(index) ? Math.round(index) : length, length),
  );

/**
 * Applies one change in place. Changes are checked against the content they
 * were proposed for, so anything edited elsewhere in the meantime is skipped
 * instead of silently overwritten.
 */
export function applyChange(
  content: EditableContent,
  change: EditChange,
): ApplyOutcome {
  switch (change.kind) {
    case 'edit_item': {
      const found = findItem(content, change.itemId);
      if (!found) return { ok: false, reason: 'The item no longer exists.' };
      if (!sameItem(found.item, change.before)) {
        return {
          ok: false,
          reason: 'The item was changed after this edit was proposed.',
        };
      }
      found.section.items[found.index] = {
        ...toSavedItem(change.after),
        id: change.itemId,
      };
      return { ok: true };
    }
    case 'add_item': {
      const section = content.sections.find((s) => s.id === change.sectionId);
      if (!section)
        return { ok: false, reason: 'The section no longer exists.' };
      if (findItem(content, change.after.id))
        return { ok: false, reason: 'Already added.' };
      section.items.splice(
        clampIndex(change.index, section.items.length),
        0,
        toSavedItem(change.after),
      );
      return { ok: true };
    }
    case 'remove_item': {
      const found = findItem(content, change.before.id);
      if (!found) return { ok: false, reason: 'Already removed.' };
      if (!sameItem(found.item, change.before)) {
        return {
          ok: false,
          reason: 'The item was changed after this edit was proposed.',
        };
      }
      found.section.items.splice(found.index, 1);
      return { ok: true };
    }
    case 'move_item': {
      const found = findItem(content, change.itemId);
      if (!found) return { ok: false, reason: 'The item no longer exists.' };
      const target = content.sections.find((s) => s.id === change.to.sectionId);
      if (!target)
        return {
          ok: false,
          reason: 'The destination section no longer exists.',
        };
      found.section.items.splice(found.index, 1);
      target.items.splice(
        clampIndex(change.to.index, target.items.length),
        0,
        found.item,
      );
      return { ok: true };
    }
    case 'add_section': {
      if (content.sections.some((s) => s.id === change.sectionId)) {
        return { ok: false, reason: 'Already added.' };
      }
      content.sections.splice(
        clampIndex(change.index, content.sections.length),
        0,
        {
          id: change.sectionId,
          title: change.title,
          items: change.items.map(toSavedItem),
        },
      );
      return { ok: true };
    }
    case 'remove_section': {
      const index = content.sections.findIndex(
        (s) => s.id === change.sectionId,
      );
      if (index === -1) return { ok: false, reason: 'Already removed.' };
      const current = content.sections[index];
      const unchanged =
        current.items.length === change.before.items.length &&
        current.items.every((item, i) =>
          sameItem(item, change.before.items[i]),
        );
      if (!unchanged) {
        return {
          ok: false,
          reason: 'The section was changed after this edit was proposed.',
        };
      }
      content.sections.splice(index, 1);
      return { ok: true };
    }
    case 'rename_section': {
      const section = content.sections.find((s) => s.id === change.sectionId);
      if (!section)
        return { ok: false, reason: 'The section no longer exists.' };
      if (section.title !== change.before) {
        return {
          ok: false,
          reason: 'The section was renamed after this edit was proposed.',
        };
      }
      section.title = change.after;
      return { ok: true };
    }
    case 'update_details': {
      if (
        content.title !== change.before.title ||
        content.description !== change.before.description
      ) {
        return {
          ok: false,
          reason:
            'The title or description was changed after this edit was proposed.',
        };
      }
      content.title = change.after.title;
      content.description = change.after.description;
      return { ok: true };
    }
  }
}

/** The change that undoes `change` once it has been applied. */
export function invertChange(change: EditChange): EditChange {
  switch (change.kind) {
    case 'edit_item':
      return {
        ...change,
        before: toSavedItem(change.after),
        after: { ...change.before, aiMeta: { status: 'ok', issues: [] } },
      };
    case 'add_item':
      return {
        id: change.id,
        kind: 'remove_item',
        summary: change.summary,
        sectionId: change.sectionId,
        index: change.index,
        before: toSavedItem(change.after),
      };
    case 'remove_item':
      return {
        id: change.id,
        kind: 'add_item',
        summary: change.summary,
        sectionId: change.sectionId,
        index: change.index,
        after: { ...change.before, aiMeta: { status: 'ok', issues: [] } },
      };
    case 'move_item':
      return { ...change, from: change.to, to: change.from };
    case 'add_section':
      return {
        id: change.id,
        kind: 'remove_section',
        summary: change.summary,
        sectionId: change.sectionId,
        index: change.index,
        before: { title: change.title, items: change.items.map(toSavedItem) },
      };
    case 'remove_section':
      return {
        id: change.id,
        kind: 'add_section',
        summary: change.summary,
        sectionId: change.sectionId,
        index: change.index,
        title: change.before.title,
        items: change.before.items.map((item) => ({
          ...item,
          aiMeta: { status: 'ok', issues: [] },
        })),
      };
    case 'rename_section':
      return { ...change, before: change.after, after: change.before };
    case 'update_details':
      return { ...change, before: change.after, after: change.before };
  }
}
