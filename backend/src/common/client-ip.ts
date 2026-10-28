/**
 * Client IP resolution. Single place for the trust decision so exam IP
 * allowlists and public rate limits can't be bypassed with a spoofed header.
 *
 * - TRUSTED_PROXIES: comma-separated IPs/CIDRs of the reverse proxies in
 *   front of the API (e.g. "127.0.0.1,10.0.0.0/8"). Takes precedence.
 * - TRUSTED_PROXY_HOPS: number of proxies in front (default 1: the nginx/caddy
 *   on the VPS). Fastify then derives req.ip from X-Forwarded-For, trusting
 *   only that many hops from the right — client-prepended entries are ignored.
 * - TRUST_CLOUDFLARE=true: honour cf-connecting-ip. Only set this when the
 *   origin is reachable exclusively through Cloudflare (firewalled to CF
 *   ranges); otherwise anyone can send the header. true-client-ip is never
 *   trusted.
 */
export function resolveTrustProxy(): string | number {
  const list = String(process.env.TRUSTED_PROXIES || '').trim();
  if (list) return list;
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
}

export function getClientIp(req: any): string {
  if (process.env.TRUST_CLOUDFLARE === 'true') {
    const cf = req?.headers?.['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
  }
  if (typeof req?.ip === 'string' && req.ip) return req.ip;
  const socketIp =
    req?.socket?.remoteAddress ?? req?.raw?.socket?.remoteAddress;
  return typeof socketIp === 'string' ? socketIp.trim() : '';
}
