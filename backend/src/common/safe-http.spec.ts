import { Agent as HttpAgent } from 'http';
import {
  isBlockedAddress,
  assertSafeUrl,
  safeRequestConfig,
  BlockedAddressError,
} from './safe-http';

// Node's Agent sets `this.keepAlive` from the constructor options at
// runtime, but @types/node only declares `keepAlive` on the options
// interface, not on the Agent class itself -- so the real property needs
// a narrow, explicit type rather than an `any` cast to read back in a test.
interface AgentWithKeepAlive extends HttpAgent {
  keepAlive: boolean;
}

describe('isBlockedAddress', () => {
  it('blocks loopback', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::1')).toBe(true);
  });

  it('blocks the cloud metadata / link-local range', () => {
    // 169.254.169.254 is the OCI/AWS/GCP instance-credentials endpoint --
    // the actual target of the SSRF this module exists to prevent.
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
    expect(isBlockedAddress('169.254.0.1')).toBe(true);
  });

  it('blocks RFC1918 private ranges', () => {
    expect(isBlockedAddress('10.1.2.3')).toBe(true);
    expect(isBlockedAddress('172.16.0.1')).toBe(true);
    expect(isBlockedAddress('172.31.255.255')).toBe(true);
    expect(isBlockedAddress('192.168.1.1')).toBe(true);
  });

  it('does not block adjacent public ranges that a naive prefix check might catch', () => {
    // One bit outside the RFC1918 172.16.0.0/12 block on each side.
    expect(isBlockedAddress('172.15.255.255')).toBe(false);
    expect(isBlockedAddress('172.32.0.1')).toBe(false);
  });

  it('blocks CGNAT, multicast, and reserved ranges', () => {
    expect(isBlockedAddress('100.64.0.1')).toBe(true);
    expect(isBlockedAddress('224.0.0.1')).toBe(true);
    expect(isBlockedAddress('0.0.0.0')).toBe(true);
    expect(isBlockedAddress('255.255.255.255')).toBe(true);
  });

  it('blocks IPv6 loopback, unspecified, unique-local, link-local, and multicast', () => {
    expect(isBlockedAddress('::1')).toBe(true);
    expect(isBlockedAddress('::')).toBe(true);
    expect(isBlockedAddress('fc00::1')).toBe(true);
    expect(isBlockedAddress('fd00::abcd')).toBe(true);
    expect(isBlockedAddress('fe80::1')).toBe(true);
    expect(isBlockedAddress('ff02::1')).toBe(true);
  });

  it('unwraps IPv4-mapped, NAT64, and 6to4 addresses to check the embedded v4 target', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedAddress('64:ff9b::169.254.169.254')).toBe(true);
    expect(isBlockedAddress('2002:a9fe:a9fe::1')).toBe(true); // 6to4 carrying 169.254.169.254
  });

  it('allows public addresses, including ones adjacent to blocked ranges', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('1.1.1.1')).toBe(false);
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
    expect(isBlockedAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });

  it('fails closed on unparseable input', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
  });
});

describe('assertSafeUrl', () => {
  it('rejects non-http(s) schemes', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow();
    expect(() => assertSafeUrl('gopher://x.com/')).toThrow();
    expect(() => assertSafeUrl('javascript:alert(1)')).toThrow();
  });

  it('rejects URLs carrying credentials', () => {
    expect(() => assertSafeUrl('http://user:pw@example.com/')).toThrow();
  });

  it('rejects an IP-literal host that resolves to blocked space directly, without a DNS lookup', () => {
    // IP literals never reach the agent's `lookup`, so this check has to
    // happen in assertSafeUrl itself -- this is the gap the first version
    // of this module had.
    expect(() =>
      assertSafeUrl('http://169.254.169.254/latest/meta-data/'),
    ).toThrow(BlockedAddressError);
    expect(() => assertSafeUrl('http://127.0.0.1:8080/')).toThrow(
      BlockedAddressError,
    );
    expect(() => assertSafeUrl('http://[::1]:8080/')).toThrow(
      BlockedAddressError,
    );
  });

  it('accepts a well-formed public https URL', () => {
    expect(() => assertSafeUrl('https://example.com/a.png')).not.toThrow();
  });

  it('rejects a malformed URL', () => {
    expect(() => assertSafeUrl('not a url')).toThrow();
  });
});

describe('safeRequestConfig', () => {
  it('pins requests to the SSRF-filtered agents and caps redirects', () => {
    const config = safeRequestConfig();
    expect(config.httpAgent).toBeDefined();
    expect(config.httpsAgent).toBeDefined();
    expect(config.maxRedirects).toBe(3);
    // The agents must never be shared with a plain, unfiltered axios/http
    // call elsewhere in the app -- keepAlive off means a socket validated
    // for one destination can't be reused for a different one.
    expect(config.httpAgent).toBeInstanceOf(HttpAgent);
    expect((config.httpAgent as AgentWithKeepAlive).keepAlive).toBe(false);
    expect((config.httpsAgent as AgentWithKeepAlive).keepAlive).toBe(false);
  });

  it('lets a caller override maxRedirects without losing the filtered agents', () => {
    const config = safeRequestConfig({ maxRedirects: 0 });
    expect(config.maxRedirects).toBe(0);
    expect(config.httpAgent).toBeDefined();
  });

  it('re-validates the next hop on redirect, rejecting one that points at blocked space', () => {
    const config = safeRequestConfig();
    const beforeRedirect = config.beforeRedirect as (options: {
      hostname?: string;
      protocol?: string;
      path?: string;
    }) => void;
    expect(() =>
      beforeRedirect({
        hostname: '169.254.169.254',
        protocol: 'http:',
        path: '/',
      }),
    ).toThrow(BlockedAddressError);
  });
});
