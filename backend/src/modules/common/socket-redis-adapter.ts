import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';

/**
 * Installs the Socket.IO Redis adapter on the root server exactly once.
 *
 * Every gateway used to call `rootServer.adapter(createAdapter(...))` itself.
 * The second call replaced the first adapter, but the discarded one kept its
 * Redis subscriptions alive, so `serverCount()` (a PUBSUB NUMSUB count) saw
 * two servers while only one could answer. Cluster-wide calls like
 * `fetchSockets()` then waited for a reply that never came and rejected —
 * which in `join_exam` aborted the handler before the socket joined its room,
 * silently disabling the takeover kick and live monitoring.
 */
const INSTALLED = Symbol.for('mentrily.socketRedisAdapter');

interface AdapterHost {
  adapter: (factory: ReturnType<typeof createAdapter>) => unknown;
  [INSTALLED]?: { pub: Redis; sub: Redis };
}

function asHost(rootServer: unknown): AdapterHost {
  const host = rootServer as AdapterHost | null;
  if (!host || typeof host.adapter !== 'function') {
    throw new Error('Socket.IO root server adapter API is unavailable');
  }
  return host;
}

/** True when this call installed the adapter, false when one was already set. */
export function ensureSocketRedisAdapter(
  rootServer: unknown,
  redis: Redis,
): boolean {
  const host = asHost(rootServer);
  if (host[INSTALLED]) return false;

  const pub = redis.duplicate();
  const sub = redis.duplicate();
  host.adapter(createAdapter(pub, sub));
  host[INSTALLED] = { pub, sub };
  return true;
}

/** Closes the connections opened by ensureSocketRedisAdapter, if any. */
export async function closeSocketRedisAdapter(
  rootServer: unknown,
): Promise<void> {
  const host = rootServer as AdapterHost | null;
  const installed = host?.[INSTALLED];
  if (!host || !installed) return;
  host[INSTALLED] = undefined;
  await Promise.allSettled([installed.pub.quit(), installed.sub.quit()]);
}
