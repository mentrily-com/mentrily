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

export const sessionAnswersHashKey = (sessionId: string) =>
  `session:answers:h:${sessionId}`;

/** Pre-hash format; still read for sessions started before deploy. */
export const legacySessionAnswersKey = (sessionId: string) =>
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
    .exec();
}

export async function readStashedSessionAnswers(
  redis: Redis,
  sessionId: string,
): Promise<Record<string, unknown>> {
  const [legacyRaw, hashRaw] = await Promise.all([
    redis.get(legacySessionAnswersKey(sessionId)),
    redis.hgetall(sessionAnswersHashKey(sessionId)),
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

/**
 * Remove only the fields a flush just persisted to Postgres, not the whole
 * hash — a save_answer socket event can HSET a new field in between the
 * flush's HGETALL snapshot and this call, and a blanket DEL would silently
 * drop that concurrent write (it would never be flushed again). The legacy
 * blob key is still deleted outright: it's only ever written as a whole
 * atomic blob by old clients, never partially, so once read it's safe to
 * retire entirely.
 */
export async function clearFlushedSessionAnswerFields(
  redis: Redis,
  sessionId: string,
  fields: string[],
): Promise<void> {
  const multi = redis.multi().del(legacySessionAnswersKey(sessionId));
  if (fields.length > 0) {
    multi.hdel(sessionAnswersHashKey(sessionId), ...fields);
  }
  await multi.exec();
}
