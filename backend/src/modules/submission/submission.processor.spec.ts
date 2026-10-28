import { SubmissionProcessor } from './submission.processor';
import { FLUSH_DUE_KEY } from '../common/session-answers.util';

function makeProcessor(overrides: { redis?: any; examService?: any } = {}) {
  const redis: any = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    eval: jest.fn().mockResolvedValue(1),
    zadd: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    ...overrides.redis,
  };
  const prisma: any = {
    examSession: { findUnique: jest.fn(), updateMany: jest.fn() },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const processor = new SubmissionProcessor(
    { legacyPrisma: prisma } as any,
    redis,
    { addBulk: jest.fn() } as any,
    (overrides.examService ?? {}) as any,
    {} as any,
  );
  return { processor: processor as any, redis, prisma };
}

describe('SubmissionProcessor', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps draining the batch when one flush and its retry bookkeeping fail', async () => {
    const { processor, redis } = makeProcessor({
      redis: {
        eval: jest.fn().mockResolvedValueOnce(['bad', 'good']),
        incr: jest.fn().mockRejectedValue(new Error('redis down')),
      },
    });
    const flushed: string[] = [];
    processor.handleFlushAnswers = jest.fn((id: string) => {
      if (id === 'bad') return Promise.reject(new Error('db'));
      flushed.push(id);
      return Promise.resolve();
    });

    await processor.drainDueFlushes();

    expect(flushed).toEqual(['good']);
    // Secondary failure still re-queues the session.
    expect(redis.zadd).toHaveBeenCalledWith(
      FLUSH_DUE_KEY,
      'NX',
      expect.any(Number),
      'bad',
    );
  });

  it('reschedules instead of flushing when another instance holds the lock', async () => {
    const { processor, redis } = makeProcessor({
      redis: { set: jest.fn().mockResolvedValue(null) },
    });
    processor.flushLocked = jest.fn();

    await processor.handleFlushAnswers('s1');

    expect(processor.flushLocked).not.toHaveBeenCalled();
    expect(redis.zadd).toHaveBeenCalledWith(
      FLUSH_DUE_KEY,
      'NX',
      expect.any(Number),
      's1',
    );
  });

  it('clears only the accepted fields from the stash', async () => {
    const examService = {
      getExamGradingData: jest.fn().mockResolvedValue(null),
      filterAnswersForExam: jest.fn().mockResolvedValue({
        accepted: { q1: 'a' },
        dropped: ['q9'],
        exam: null,
      }),
    };
    const { processor, redis, prisma } = makeProcessor({
      examService,
      redis: {
        hgetall: jest.fn().mockResolvedValue({ q1: '"a"', q9: '"b"' }),
      },
    });
    prisma.examSession.findUnique
      .mockResolvedValueOnce({
        id: 's1',
        userId: 'u1',
        status: 'IN_PROGRESS',
        startTime: new Date(),
        examId: 'e1',
        exam: { linkedCourseId: null, duration: 60 },
      })
      .mockResolvedValueOnce({ answers: {} });

    await processor.handleFlushAnswers('s1');

    const clearCall = redis.eval.mock.calls.find(
      (c: any[]) => c[2] === 'session:answers:h:s1',
    );
    expect(clearCall.slice(3)).toEqual(['q1', '"a"']);
  });

  it('takes the deadline from the exam memo, not the 3h session cache', async () => {
    const examService = {
      getExamGradingData: jest.fn().mockResolvedValue({ duration: 120 }),
    };
    const { processor } = makeProcessor({
      examService,
      redis: {
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            v: 2,
            examId: 'e1',
            startTimeMs: Date.now() - 90 * 60_000,
            durationMins: 60,
          }),
        ),
      },
    });
    const meta = await processor.getSessionMeta('s1');
    expect(meta.durationMins).toBe(120);
    expect(processor.isPastDeadline(meta)).toBe(false);
  });
});
