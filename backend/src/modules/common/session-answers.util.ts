import { Redis } from 'ioredis';

/**
 * Hot-path answer staging for exam sessions.
 *
 * Answers are staged in a Redis HASH keyed per question id. HSET is atomic
 * per field, so concurrent saves (multiple tabs, rapid submits) can never
 * lose each other's writes — unlike the previous GET → merge → SET cycle on
 * a single JSON blob, which was a classic lost-update race and rewrote the
 * whole blob on every keystroke.
 *
 * The hash accumulates for the whole session (TTL below) and acts as the
 * source of truth between DB flushes; flush jobs merge it into Postgres.
 */

const ANSWER_STASH_TTL_SEC = 6 * 60 * 60; // longer than any exam

const MAX_PATCH_KEYS = 500;
const MAX_KEY_LENGTH = 200;
const MAX_VALUE_BYTES = 256 * 1024; // _final_sync carries every answer
const SERVER_ONLY_KEYS = new Set([
  '_internal_marks',
  '_internal_score',
  '_internal_metadata',
]);

/**
 * Server-computed coding results live in answers under this prefix (one key
 * per question). Only code-execution writes them; clients can never.
 */
export const CODING_RESULT_PREFIX = '_internal_coding:';

export const isServerOnlyAnswerKey = (key: string) =>
  SERVER_ONLY_KEYS.has(key) || key.startsWith(CODING_RESULT_PREFIX);

/** Postgres jsonb rejects U+0000 anywhere, which would fail the whole flush. */
function containsNul(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.includes('\u0000');
  if (!value || typeof value !== 'object') return false;
  if (depth > 64) return true;
  for (const [k, v] of Object.entries(value)) {
    if (k.includes('\u0000') || containsNul(v, depth + 1)) return true;
  }
  return false;
}

/**
 * Why a client answer patch must be rejected, or null if it's fine. Without
 * caps one student could push megabytes of junk keys into Redis and their
 * session row; section markers may only ever be set, never cleared.
 */
export function answerPatchError(
  answer: unknown,
  maxKeys = MAX_PATCH_KEYS,
): string | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
    return 'INVALID_ANSWER';
  }
  const entries = Object.entries(answer);
  if (entries.length > maxKeys) return 'TOO_MANY_ANSWERS';
  for (const [key, value] of entries) {
    if (key.length > MAX_KEY_LENGTH || isServerOnlyAnswerKey(key)) {
      return 'INVALID_ANSWER_KEY';
    }
    if (/^_section_.+_submitted$/.test(key) && value !== true) {
      return 'INVALID_ANSWER_KEY';
    }
    if (containsNul(key) || containsNul(value)) return 'INVALID_ANSWER';
    const size = Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
    if (size > MAX_VALUE_BYTES) return 'ANSWER_TOO_LARGE';
  }
  return null;
}

const sessionAnswersHashKey = (sessionId: string) =>
  `session:answers:h:${sessionId}`;

/**
 * Sessions with staged answers waiting to be flushed to Postgres, scored by
 * due time (ms). ZADD NX coalesces: one pending flush per session no matter
 * how many saves land. Shared contract with go-connector, which enqueues
 * here too — keep the key and member format in sync.
 */
export const FLUSH_DUE_KEY = 'submission:flush:due';
// Answers are durable in Redis and submit merges the stash, so the DB flush
// can lag. go-connector still enqueues with its own 2500ms; ZADD NX keeps
// whichever due time landed first, so the mismatch is harmless.
export const FLUSH_DELAY_MS = 8000;

export async function scheduleSessionFlush(
  redis: Redis,
  sessionId: string,
  delayMs = FLUSH_DELAY_MS,
): Promise<void> {
  await redis.zadd(FLUSH_DUE_KEY, 'NX', Date.now() + delayMs, sessionId);
}

const POP_DUE_FLUSHES = `
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
if #ids > 0 then redis.call('ZREM', KEYS[1], unpack(ids)) end
return ids`;

/** Atomically claims due sessions, so several instances never flush the same one. */
export async function popDueSessionFlushes(
  redis: Redis,
  limit: number,
): Promise<string[]> {
  return (await redis.eval(
    POP_DUE_FLUSHES,
    1,
    FLUSH_DUE_KEY,
    Date.now(),
    limit,
  )) as string[];
}

/** Pre-hash format; still read for sessions started before deploy. */
const legacySessionAnswersKey = (sessionId: string) =>
  `session:answers:${sessionId}`;

export async function stashSessionAnswers(
  redis: Redis,
  sessionId: string,
  answer: Record<string, unknown>,
): Promise<void> {
  const entries = Object.entries(answer || {});
  if (entries.length === 0) return;

  const flat: string[] = [];
  for (const [key, value] of entries) {
    flat.push(key, JSON.stringify(value ?? null));
  }

  const key = sessionAnswersHashKey(sessionId);
  await redis
    .multi()
    .hset(key, ...flat)
    .expire(key, ANSWER_STASH_TTL_SEC)
    .zadd(FLUSH_DUE_KEY, 'NX', Date.now() + FLUSH_DELAY_MS, sessionId)
    .exec();
}

/** Staged answers plus the exact raw strings read, for compare-and-delete. */
export async function readStashedForFlush(
  redis: Redis,
  sessionId: string,
): Promise<{ answers: Record<string, unknown>; raw: Record<string, string> }> {
  const raw = (await redis.hgetall(sessionAnswersHashKey(sessionId))) || {};
  const answers = await readStashedSessionAnswers(redis, sessionId, raw);
  return { answers, raw };
}

export async function readStashedSessionAnswers(
  redis: Redis,
  sessionId: string,
  knownHash?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const [legacyRaw, hashRaw] = await Promise.all([
    redis.get(legacySessionAnswersKey(sessionId)),
    knownHash ?? redis.hgetall(sessionAnswersHashKey(sessionId)),
  ]);

  const merged: Record<string, unknown> = {};

  if (legacyRaw) {
    try {
      Object.assign(merged, JSON.parse(legacyRaw));
    } catch {
      /* corrupted legacy blob — hash + DB remain authoritative */
    }
  }

  for (const [key, raw] of Object.entries(hashRaw || {})) {
    try {
      merged[key] = JSON.parse(raw);
    } catch {
      merged[key] = raw;
    }
  }

  return merged;
}

export async function clearStashedSessionAnswers(
  redis: Redis,
  sessionId: string,
): Promise<void> {
  await redis.del(
    sessionAnswersHashKey(sessionId),
    legacySessionAnswersKey(sessionId),
  );
}

const CLEAR_IF_UNCHANGED = `
for i = 1, #ARGV, 2 do
  if redis.call('HGET', KEYS[1], ARGV[i]) == ARGV[i + 1] then
    redis.call('HDEL', KEYS[1], ARGV[i])
  end
end
return 1`;

/**
 * Remove only the fields a flush just persisted, and only if they still hold
 * the value that was flushed. Deleting by name alone dropped a newer answer
 * saved between the flush's read and this call: Postgres kept the old value
 * and the new one was never flushed. The legacy blob is only ever written
 * whole by old clients, so once read it's retired outright.
 */
export async function clearFlushedSessionAnswerFields(
  redis: Redis,
  sessionId: string,
  flushedRaw: Record<string, string>,
): Promise<void> {
  const args = Object.entries(flushedRaw).flat();
  await redis.del(legacySessionAnswersKey(sessionId));
  if (args.length > 0) {
    await redis.eval(
      CLEAR_IF_UNCHANGED,
      1,
      sessionAnswersHashKey(sessionId),
      ...args,
    );
  }
}

const CLIENT_META_KEYS = new Set([
  '_internal_position',
  '_final_sync',
  '_last_section_id',
  '_last_question_id',
]);

/** question id -> section id (null for questions outside any section). */
export function indexExamQuestions(questions: any): Map<string, string | null> {
  const index = new Map<string, string | null>();
  const items: any[] = Array.isArray(questions)
    ? questions
    : Array.isArray(questions?.sections)
      ? questions.sections
      : questions && typeof questions === 'object'
        ? Object.values(questions)
        : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (Array.isArray(item.questions)) {
      for (const q of item.questions) {
        if (q?.id != null) index.set(String(q.id), String(item.id ?? ''));
      }
    } else if (item.id != null) {
      index.set(String(item.id), null);
    }
  }
  return index;
}

/**
 * Server-side half of the exam rules the client already shows: only keys the
 * exam actually has are persisted, and nothing for a section is accepted once
 * its submitted marker is in Postgres. `stored` is the pre-flush DB answers,
 * so a section's own submit batch (answers + marker together) still lands.
 */
export function filterStagedAnswers(
  staged: Record<string, unknown>,
  index: Map<string, string | null>,
  stored: Record<string, unknown>,
): { accepted: Record<string, unknown>; dropped: string[] } {
  const sectionIds = new Set(
    [...index.values()].filter((v): v is string => Boolean(v)),
  );
  const locked = (sectionId: string | null | undefined) =>
    Boolean(sectionId) && stored[`_section_${sectionId}_submitted`] === true;

  const accepted: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(staged)) {
    let ok: boolean;
    if (CLIENT_META_KEYS.has(key)) {
      ok = true;
    } else if (index.has(key)) {
      ok = !locked(index.get(key));
    } else {
      const ref = /^_(?:rev|submitted)_(.+)$/.exec(key)?.[1];
      const section = /^_section_(.+)_submitted(?:_at)?$/.exec(key)?.[1];
      if (ref !== undefined) ok = index.has(ref) && !locked(index.get(ref));
      else if (section !== undefined) ok = sectionIds.has(section);
      else ok = false;
    }
    if (ok) accepted[key] = value;
    else dropped.push(key);
  }
  return { accepted, dropped };
}

const codingResultsKey = (sessionId: string) =>
  `exam:coding-result:${sessionId}`;

export type CodingResult = { passed: number; total: number; at: number };

/** Server-side record of the latest graded run, hidden tests included. */
export async function recordCodingResult(
  redis: Redis,
  sessionId: string,
  questionId: string,
  result: CodingResult,
): Promise<void> {
  const key = codingResultsKey(sessionId);
  await redis
    .multi()
    .hset(key, questionId, JSON.stringify(result))
    .expire(key, ANSWER_STASH_TTL_SEC)
    .exec();
}

/** Coding results keyed as answer fields (`_internal_coding:{qid}`). */
export async function readCodingResults(
  redis: Redis,
  sessionId: string,
): Promise<Record<string, CodingResult>> {
  const raw = (await redis.hgetall(codingResultsKey(sessionId))) || {};
  const out: Record<string, CodingResult> = {};
  for (const [qid, json] of Object.entries(raw)) {
    try {
      out[CODING_RESULT_PREFIX + qid] = JSON.parse(json);
    } catch {
      /* skip corrupt entry */
    }
  }
  return out;
}

/** Dropped keys that might be answers to a question added after a memo. */
export const looksLikeQuestionKey = (key: string) =>
  !key.startsWith('_') || /^_(?:rev|submitted)_|^_section_/.test(key);
