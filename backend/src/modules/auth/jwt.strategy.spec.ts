import { UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { ClerkAuthGuard } from './jwt.strategy';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
  createClerkClient: jest.fn(),
}));

describe('ClerkAuthGuard token verification', () => {
  const ctx = (token: string): any => ({
    switchToHttp: () => ({
      getRequest: () => ({
        url: '/api/x',
        headers: { authorization: `Bearer ${token}` },
      }),
    }),
  });
  let guard: ClerkAuthGuard;

  beforeEach(() => {
    (verifyToken as jest.Mock)
      .mockReset()
      .mockRejectedValue(
        Object.assign(new Error('azp'), {
          reason: 'token-invalid-authorized-parties',
        }),
      );
    delete process.env.ALLOW_LOAD_TEST_TOKENS;
    guard = new ClerkAuthGuard(
      { get: () => 'sk_test_x' } as any,
      {} as any,
      { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as any,
    );
    jest.spyOn((guard as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('does not retry without authorizedParties when strict verification fails', async () => {
    await expect(guard.canActivate(ctx('a.b.c'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyToken).toHaveBeenCalledTimes(1);
    expect(
      (verifyToken as jest.Mock).mock.calls[0][1].authorizedParties,
    ).toContain('http://localhost:3000');
  });

  it('treats test-load-token-* as a normal token unless ALLOW_LOAD_TEST_TOKENS=true', async () => {
    await expect(
      guard.canActivate(ctx('test-load-token-student_1')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyToken).toHaveBeenCalledTimes(1);
  });
});
