import { NotFoundException } from '@nestjs/common';
import { CodeExecutionService } from './code-execution.service';

describe('CodeExecutionService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeService = (
    examQuestions: any,
    outputsByInput: Record<string, string>,
  ) => {
    const add = jest.fn().mockImplementation((_name, data) => ({
      waitUntilFinished: jest.fn().mockImplementation(() => {
        if (outputsByInput[data.stdin] === '__THROW__') {
          throw new Error('secret runtime failure');
        }

        return Promise.resolve({
          stdout: outputsByInput[data.stdin] ?? '',
          stderr: '',
          output: outputsByInput[data.stdin] ?? '',
          code: 0,
          signal: '',
        });
      }),
    }));

    const service = new CodeExecutionService(
      {} as any,
      {
        exam: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'exam-1',
            slug: 'exam-slug',
            questions: examQuestions,
          }),
        },
        unit: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        examSession: {
          findFirst: jest.fn().mockResolvedValue({ id: 'sess-1' }),
        },
      } as any,
      {
        add,
        opts: { connection: {} },
      } as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      } as any,
    );
    (service as any).getQueueEvents = jest.fn().mockReturnValue({});

    return { service, add };
  };

  it('uses authoritative exam test cases and ignores client-supplied test cases', async () => {
    const { service, add } = makeService(
      [
        {
          id: 'q1',
          codingConfig: {
            testCases: [
              { input: 'public', output: 'ok', isPublic: true },
              {
                input: 'hidden-secret',
                output: 'expected-secret',
                isPublic: false,
              },
            ],
          },
        },
      ],
      {
        public: 'ok\n',
        'hidden-secret': 'wrong\n',
        client: 'client-pass\n',
      },
    );

    const result = await service.submitCode(
      'q1',
      'python',
      'print(input())',
      'exam-slug',
      [{ input: 'client', output: 'client-pass', isPublic: true }],
    );

    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((call) => call[1].stdin)).toEqual([
      'public',
      'hidden-secret',
    ]);
    expect(result.status).toBe('Wrong Answer');
    expect(result.passedTests).toBe(1);
    expect(result.totalTests).toBe(2);
  });

  it('redacts hidden exam test case input, expected output, actual output, and errors', async () => {
    const { service } = makeService(
      [
        {
          id: 'q1',
          codingConfig: {
            testCases: [
              { input: 'visible', output: 'ok', isPublic: true },
              {
                input: 'secret-input',
                output: 'secret-output',
                isPublic: false,
              },
            ],
          },
        },
      ],
      {
        visible: 'ok\n',
        'secret-input': 'wrong-output\n',
      },
    );

    const result = await service.submitCode(
      'q1',
      'python',
      'print(input())',
      'exam-slug',
    );
    const hidden = result.results[1];

    expect(hidden.passed).toBe(false);
    expect(hidden.isPublic).toBe(false);
    expect(hidden.input).toBeNull();
    expect(hidden.expectedOutput).toBeNull();
    expect(hidden.actualOutput).toBeNull();
    expect(hidden.error).toBeNull();
  });

  it('redacts execution errors from hidden exam test cases', async () => {
    const { service } = makeService(
      [
        {
          id: 'q1',
          codingConfig: {
            testCases: [
              { input: 'visible', output: 'ok', isPublic: true },
              {
                input: 'secret-input',
                output: 'secret-output',
                isPublic: false,
              },
            ],
          },
        },
      ],
      {
        visible: 'ok\n',
        'secret-input': '__THROW__',
      },
    );

    const result = await service.submitCode(
      'q1',
      'python',
      'print(input())',
      'exam-slug',
    );

    expect(result.results[1].status).toBe('Error');
    expect(result.results[1].error).toBeNull();
  });

  it('does not fall back to client test cases when an exam question is missing', async () => {
    const { service } = makeService([], { client: 'client-pass\n' });

    await expect(
      service.submitCode('missing', 'python', 'print(input())', 'exam-slug', [
        { input: 'client', output: 'client-pass', isPublic: true },
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('shares one execution between identical concurrent runs and sets a deadline', async () => {
    const { service, add } = makeService([], { same: 'out' });

    const [a, b] = await Promise.all([
      service.runCode('python', 'print(1)', 'same'),
      service.runCode('python', 'print(1)', 'same'),
    ]);

    expect(add).toHaveBeenCalledTimes(1);
    expect(a.stdout).toBe('out');
    expect(b.stdout).toBe('out');
    const data = add.mock.calls[0][1];
    expect(data.deadline).toBeGreaterThan(Date.now());
    expect((service as any).inFlight.size).toBe(0);
  });

  it('records the server-computed result (hidden tests included) against the caller session', async () => {
    const { service } = makeService(
      [
        {
          id: 'q1',
          codingConfig: {
            testCases: [
              { input: 'a', output: 'ok', isPublic: true },
              { input: 'b', output: 'ok', isPublic: false },
            ],
          },
        },
      ],
      { a: 'ok', b: 'nope' },
    );
    const hset = jest.fn();
    const chain: any = { hset, expire: jest.fn(), exec: jest.fn() };
    hset.mockReturnValue(chain);
    chain.expire.mockReturnValue(chain);
    (service as any).redis.multi = jest.fn().mockReturnValue(chain);
    const executeRaw = jest.fn().mockResolvedValue(1);
    (service as any).prisma.$executeRaw = executeRaw;

    await service.submitCode('q1', 'python', 'x', 'exam-slug', undefined, {
      id: 'student-1',
      role: 'STUDENT',
    });

    expect(hset.mock.calls[0][0]).toBe('exam:coding-result:sess-1');
    expect(hset.mock.calls[0][1]).toBe('q1');
    expect(JSON.parse(hset.mock.calls[0][2])).toMatchObject({
      passed: 1,
      total: 2,
    });
    expect(executeRaw).toHaveBeenCalled();
  });

  it('hides hidden test cases and the solution of a shared question from non-creators', async () => {
    const { service } = makeService([], {});
    const question = {
      id: 'public-1',
      codingConfig: {
        solution: 'print(42)',
        testCases: [
          { input: 'pub', output: '1', isPublic: true },
          { input: 'secret', output: 'hidden-out', isPublic: false },
        ],
      },
    };
    (service as any).prisma.publicCodingQuestion = {
      findUnique: jest.fn().mockResolvedValue({
        slug: 's',
        question,
        creatorUserId: 'owner',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      }),
    };

    const viewer = await service.getPublicQuestionForViewer('s');
    const text = JSON.stringify(viewer);
    expect(text).not.toContain('hidden-out');
    expect(text).not.toContain('print(42)');
    expect(text).not.toContain('owner');

    const owner = await service.getPublicQuestionForViewer('s', {
      id: 'owner',
    });
    expect(JSON.stringify(owner)).toContain('hidden-out');
  });

  it('marks a course coding unit passed only when every test (hidden too) passes', async () => {
    const unitWith = (outputs: Record<string, string>) => {
      const { service } = makeService([], outputs);
      (service as any).prisma.unit.findUnique = jest.fn().mockResolvedValue({
        id: 'u1',
        content: {
          testCases: [
            { input: 'a', output: 'ok', isPublic: true },
            { input: 'b', output: 'ok', isPublic: false },
          ],
        },
        module: { course: { id: 'c1', orgId: null, creatorId: 'student-1' } },
      });
      return service;
    };
    const user = { id: 'student-1', role: 'STUDENT' };

    const passing = unitWith({ a: 'ok', b: 'ok' });
    await passing.submitCode('u1', 'python', 'x', undefined, undefined, user);
    expect((passing as any).redis.set).toHaveBeenCalledWith(
      'unit-pass:student-1:u1',
      '1',
      'EX',
      3600,
    );

    const failing = unitWith({ a: 'ok', b: 'nope' });
    await failing.submitCode('u1', 'python', 'y', undefined, undefined, user);
    expect((failing as any).redis.set).not.toHaveBeenCalledWith(
      'unit-pass:student-1:u1',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});
