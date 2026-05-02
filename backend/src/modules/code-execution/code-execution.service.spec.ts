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
});
