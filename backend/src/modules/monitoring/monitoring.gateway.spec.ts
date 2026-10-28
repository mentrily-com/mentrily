import { MonitoringGateway } from './monitoring.gateway';

describe('MonitoringGateway heartbeat', () => {
  const makeGateway = (redisSet: jest.Mock) => {
    const redis: any = { set: redisSet, get: jest.fn() };
    const submissionService: any = {
      getSessionOwner: jest.fn().mockResolvedValue('user-1'),
      getPresenceGapMs: jest.fn().mockResolvedValue(5_000),
      recordPresence: jest.fn().mockResolvedValue(undefined),
    };
    const prisma: any = { violation: { create: jest.fn() } };
    const gateway = new MonitoringGateway(redis, submissionService, {
      legacyPrisma: prisma,
    } as any);
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;
    const client: any = {
      id: 'sock-1',
      data: { dbUser: { id: 'user-1', role: 'STUDENT' } },
      emit: jest.fn(),
    };
    return { gateway, client, submissionService, prisma };
  };

  it('looks up the session owner once per socket and uses one SET..GET per beat', async () => {
    const set = jest.fn().mockResolvedValue(String(Date.now() - 1_000));
    const { gateway, client, submissionService, prisma } = makeGateway(set);

    await gateway.handleHeartbeat({ sessionId: 's1', timestamp: 0 }, client);
    await gateway.handleHeartbeat({ sessionId: 's1', timestamp: 0 }, client);

    expect(submissionService.getSessionOwner).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledWith(
      'session:lastseen:s1',
      expect.any(String),
      'EX',
      21_600,
      'GET',
    );
    expect(submissionService.getPresenceGapMs).not.toHaveBeenCalled();
    expect(prisma.violation.create).not.toHaveBeenCalled();
  });

  it('flags a gap from the previous SET..GET value', async () => {
    const set = jest.fn().mockResolvedValue(String(Date.now() - 120_000));
    const { gateway, client, prisma } = makeGateway(set);
    prisma.violation.create.mockReturnValue({ catch: jest.fn() });

    await gateway.handleHeartbeat({ sessionId: 's1', timestamp: 0 }, client);

    expect(prisma.violation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'HEARTBEAT_GAP' }),
      }),
    );
  });

  it('falls back to GET-then-SET when SET..GET is rejected', async () => {
    const set = jest.fn().mockRejectedValue(new Error('ERR syntax error'));
    const { gateway, client, submissionService } = makeGateway(set);

    await gateway.handleHeartbeat({ sessionId: 's1', timestamp: 0 }, client);

    expect(submissionService.getPresenceGapMs).toHaveBeenCalledWith('s1');
    expect(submissionService.recordPresence).toHaveBeenCalledWith('s1');
  });

  it('does not cache a failed ownership check', async () => {
    const set = jest.fn().mockResolvedValue(null);
    const { gateway, client, submissionService } = makeGateway(set);
    submissionService.getSessionOwner.mockResolvedValue('someone-else');

    await gateway.handleHeartbeat({ sessionId: 's1', timestamp: 0 }, client);
    await gateway.handleHeartbeat({ sessionId: 's1', timestamp: 0 }, client);

    expect(submissionService.getSessionOwner).toHaveBeenCalledTimes(2);
    expect(set).not.toHaveBeenCalled();
  });
});
