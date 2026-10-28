import { getClientIp, resolveTrustProxy } from './client-ip';

describe('getClientIp', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('ignores spoofable headers by default and uses req.ip', () => {
    delete process.env.TRUST_CLOUDFLARE;
    const req = {
      ip: '203.0.113.9',
      headers: {
        'cf-connecting-ip': '1.1.1.1',
        'true-client-ip': '2.2.2.2',
        'x-forwarded-for': '3.3.3.3',
      },
    };
    expect(getClientIp(req)).toBe('203.0.113.9');
  });

  it('trusts cf-connecting-ip only when TRUST_CLOUDFLARE=true, never true-client-ip', () => {
    process.env.TRUST_CLOUDFLARE = 'true';
    expect(
      getClientIp({
        ip: '10.0.0.1',
        headers: { 'cf-connecting-ip': '1.1.1.1' },
      }),
    ).toBe('1.1.1.1');
    expect(
      getClientIp({ ip: '10.0.0.1', headers: { 'true-client-ip': '2.2.2.2' } }),
    ).toBe('10.0.0.1');
  });

  it('defaults to trusting one proxy hop; a CIDR list overrides', () => {
    delete process.env.TRUSTED_PROXIES;
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(resolveTrustProxy()).toBe(1);
    process.env.TRUSTED_PROXIES = '127.0.0.1,10.0.0.0/8';
    expect(resolveTrustProxy()).toBe('127.0.0.1,10.0.0.0/8');
  });
});
