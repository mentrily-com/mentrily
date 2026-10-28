import { UserAwareThrottlerGuard } from './user-throttler.guard';

describe('UserAwareThrottlerGuard.getTracker', () => {
  const guard = Object.create(UserAwareThrottlerGuard.prototype);
  const track = (req: any) => guard.getTracker(req);

  it('keys verified users by id', async () => {
    expect(await track({ user: { id: 'u1' }, ip: '1.1.1.1' })).toBe('user:u1');
  });

  it('ignores unverified bearer tokens, cookies and device ids', async () => {
    const base = { ip: '9.9.9.9', ips: ['10.0.0.1', '9.9.9.9'] };
    const keys = await Promise.all([
      track({ ...base, headers: { authorization: 'Bearer random-a' } }),
      track({ ...base, headers: { authorization: 'Bearer random-b' } }),
      track({ ...base, headers: { cookie: '__session=xyz' } }),
      track({
        ...base,
        headers: { 'x-device-id': 'd1' },
        body: { deviceId: 'd2' },
      }),
    ]);
    expect(new Set(keys)).toEqual(new Set(['ip:9.9.9.9']));
  });
});
