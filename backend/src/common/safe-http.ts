import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { isIP, type LookupFunction } from 'net';
import { lookup as dnsLookup, LookupAddress } from 'dns';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Egress filtering for server-initiated HTTP requests.
 *
 * Several features fetch operator-supplied URLs from inside the API process:
 * certificate background/signature/logo images (rendered into a PDF the
 * requester downloads) and organization webhook endpoints. Without filtering,
 * anyone who can reach those settings — an ADMIN of a self-serve organization —
 * can point them at the cloud metadata service (169.254.169.254) or at
 * services bound to the VM's private network, and read or trigger them through
 * the platform.
 *
 * Two properties are enforced here:
 *
 *  1. Scheme allowlisting, so only http(s) is ever dialled.
 *  2. Destination-IP filtering applied *at connect time* via a custom agent
 *     `lookup`. Doing the check in the lookup — rather than resolving first and
 *     connecting after — closes the DNS-rebinding window, because the socket
 *     can only ever connect to an address this function already approved.
 *     It also covers redirect hops, since every hop opens a new connection
 *     through the same agent.
 */

type Cidr = readonly [string, number];

// Ranges that must never be reachable from server-side fetches. Beyond the
// obvious loopback/private blocks these include the cloud metadata link-local
// range (169.254.0.0/16 — the OCI/AWS credential endpoint lives at
// 169.254.169.254) and CGNAT space, which is routable inside many VPCs.
const BLOCKED_IPV4: readonly Cidr[] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // RFC1918 private
  ['100.64.0.0', 10], // RFC6598 CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local / cloud metadata
  ['172.16.0.0', 12], // RFC1918 private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // RFC1918 private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const address = ipv4ToInt(ip);
  if (address === null) return true; // unparseable — fail closed
  return BLOCKED_IPV4.some(([base, bits]) => {
    const network = ipv4ToInt(base);
    if (network === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (address & mask) === (network & mask);
  });
}

/**
 * Expands an IPv6 address to its 8 hextets. Returns null when the literal is
 * malformed, which callers treat as blocked.
 */
function expandIpv6(ip: string): number[] | null {
  let text = ip.trim().toLowerCase();
  const zone = text.indexOf('%'); // strip scope id, e.g. fe80::1%eth0
  if (zone !== -1) text = text.slice(0, zone);

  // An IPv4 tail (::ffff:1.2.3.4, 64:ff9b::1.2.3.4) becomes two hextets.
  let tail = '';
  const lastColon = text.lastIndexOf(':');
  const suffix = text.slice(lastColon + 1);
  if (suffix.includes('.')) {
    const value = ipv4ToInt(suffix);
    if (value === null) return null;
    tail = `${((value >>> 16) & 0xffff).toString(16)}:${(value & 0xffff).toString(16)}`;
    text = text.slice(0, lastColon + 1) + tail;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (segment: string): number[] | null => {
    if (!segment) return [];
    const groups: number[] = [];
    for (const part of segment.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      groups.push(parseInt(part, 16));
    }
    return groups;
  };

  const head = parseGroups(halves[0]);
  if (head === null) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const rear = parseGroups(halves[1]);
  if (rear === null) return null;

  const gap = 8 - head.length - rear.length;
  if (gap < 0) return null;
  return [...head, ...Array<number>(gap).fill(0), ...rear];
}

function isBlockedIpv6(ip: string): boolean {
  const groups = expandIpv6(ip);
  if (!groups) return true; // unparseable — fail closed

  // Unwrap addresses that embed an IPv4 destination so the v4 rules apply:
  // IPv4-mapped (::ffff:0:0/96), IPv4-compatible (::/96) and NAT64
  // (64:ff9b::/96) all reach a v4 host despite looking like v6.
  const isMapped =
    groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  const isCompatible = groups.slice(0, 6).every((g) => g === 0);
  const isNat64 =
    groups[0] === 0x0064 &&
    groups[1] === 0xff9b &&
    groups.slice(2, 6).every((g) => g === 0);

  if (isMapped || isCompatible || isNat64) {
    const embedded = [
      (groups[6] >> 8) & 0xff,
      groups[6] & 0xff,
      (groups[7] >> 8) & 0xff,
      groups[7] & 0xff,
    ].join('.');
    return isBlockedIpv4(embedded);
  }

  // 6to4 (2002::/16) carries the v4 relay address in the next two hextets.
  if (groups[0] === 0x2002) {
    const embedded = [
      (groups[1] >> 8) & 0xff,
      groups[1] & 0xff,
      (groups[2] >> 8) & 0xff,
      groups[2] & 0xff,
    ].join('.');
    return isBlockedIpv4(embedded);
  }

  if (groups.every((g) => g === 0)) return true; // ::
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  return false;
}

/** True when `ip` is a literal that server-side fetches must never dial. */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true; // not an IP literal — fail closed
}

export class BlockedAddressError extends Error {
  constructor(host: string, address?: string) {
    super(
      address
        ? `Refusing to connect to ${host}: ${address} is a private or reserved address`
        : `Refusing to connect to ${host}: no public address available`,
    );
    this.name = 'BlockedAddressError';
  }
}

/**
 * A `dns.lookup`-compatible function that drops every private/reserved
 * candidate before the socket is created. Because the agent connects to the
 * address returned here, an attacker-controlled DNS record cannot swap in an
 * internal IP after validation.
 */
interface LookupOptions {
  all?: boolean;
  family?: number;
  hints?: number;
  verbatim?: boolean;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: string | LookupAddress[],
  family?: number,
) => void;

function safeLookup(
  hostname: string,
  options: number | LookupOptions,
  callback: LookupCallback,
): void {
  const opts: LookupOptions =
    typeof options === 'number' ? { family: options } : (options ?? {});
  // A bare IP literal never reaches DNS — check it directly.
  const literal = isIP(hostname);
  if (literal) {
    if (isBlockedAddress(hostname)) {
      callback(new BlockedAddressError(hostname, hostname));
      return;
    }
    if (opts.all) {
      callback(null, [{ address: hostname, family: literal }]);
    } else {
      callback(null, hostname, literal);
    }
    return;
  }

  dnsLookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) {
      callback(err);
      return;
    }

    const list = (addresses as unknown as LookupAddress[]) || [];
    const allowed = list.filter((entry) => !isBlockedAddress(entry.address));

    if (allowed.length === 0) {
      callback(new BlockedAddressError(hostname, list[0]?.address));
      return;
    }

    if (opts.all) {
      callback(null, allowed);
    } else {
      callback(null, allowed[0].address, allowed[0].family);
    }
  });
}

// Shared agents. Keep-alive is off: pooling a socket across requests would let
// a connection validated for one destination be reused for another.
const safeHttpAgent = new HttpAgent({
  keepAlive: false,
  lookup: safeLookup as unknown as LookupFunction,
});
const safeHttpsAgent = new HttpsAgent({
  keepAlive: false,
  lookup: safeLookup as unknown as LookupFunction,
});

/**
 * Rejects URLs that are malformed, non-http(s), or embed credentials. The
 * destination address itself is checked later, by the agent.
 */
export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(String(rawUrl));
  } catch {
    throw new BlockedAddressError(String(rawUrl));
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(
      `Refusing to connect to ${url.protocol}// URL: only http and https are permitted`,
    );
  }

  if (url.username || url.password) {
    throw new Error('Refusing to connect to a URL containing credentials');
  }

  // A hostname that is already an IP literal never reaches DNS, so the agent's
  // `lookup` is not consulted and cannot filter it. Check it here instead —
  // without this, http://169.254.169.254/ would connect straight through.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isBlockedAddress(host)) {
    throw new BlockedAddressError(url.hostname, host);
  }

  return url;
}

/** The subset of follow-redirects' options we need to rebuild the next hop. */
interface RedirectTarget {
  href?: string;
  protocol?: string;
  host?: string;
  hostname?: string;
  path?: string;
}

/**
 * Axios config that pins the request to the SSRF-filtered agents. Redirects are
 * capped but remain safe to follow: each hop dials through the same agent, so
 * a 302 pointing at an internal host fails the lookup like any other request.
 */
export function safeRequestConfig(
  config: AxiosRequestConfig = {},
): AxiosRequestConfig {
  return {
    ...config,
    httpAgent: safeHttpAgent,
    httpsAgent: safeHttpsAgent,
    maxRedirects: config.maxRedirects ?? 3,
    beforeRedirect: (redirect: RedirectTarget) => {
      const href =
        redirect.href ??
        `${redirect.protocol ?? 'https:'}//${redirect.host ?? redirect.hostname ?? ''}${redirect.path ?? ''}`;
      assertSafeUrl(href);
    },
  };
}

/** GET with scheme validation and destination-IP filtering. */
export async function safeGet<T = any>(
  url: string,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const target = assertSafeUrl(url);
  return axios.get<T>(target.toString(), safeRequestConfig(config));
}

/** POST with scheme validation and destination-IP filtering. */
export async function safePost<T = any>(
  url: string,
  data: unknown,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const target = assertSafeUrl(url);
  return axios.post<T>(target.toString(), data, safeRequestConfig(config));
}
