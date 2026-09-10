import { of } from 'rxjs';
import { Judge0Strategy } from './judge0.strategy';

describe('Judge0Strategy', () => {
  const makeStrategy = (post = jest.fn()) =>
    new Judge0Strategy(
      { post } as any,
      { get: jest.fn().mockReturnValue('http://judge0.test') } as any,
    );

  it('uses language ids from the configured Judge0 CE deployment', async () => {
    const post = jest.fn().mockReturnValue(
      of({
        data: {
          stdout: 'ok\n',
          stderr: null,
          compile_output: null,
          status: { id: 3, description: 'Accepted' },
        },
      }),
    );
    const strategy = makeStrategy(post);

    await strategy.execute('javascript', 'console.log("ok")', '');
    await strategy.execute('python', 'print("ok")', '');
    await strategy.execute('typescript', 'console.log("ok")', '');
    await strategy.execute('go', 'package main', '');

    expect(post.mock.calls[0][1].language_id).toBe(63);
    expect(post.mock.calls[1][1].language_id).toBe(71);
    expect(post.mock.calls[2][1].language_id).toBe(74);
    expect(post.mock.calls[3][1].language_id).toBe(60);
  });

  it('maps Judge0 compile errors to stderr and a non-zero code', async () => {
    const post = jest.fn().mockReturnValue(
      of({
        data: {
          stdout: null,
          stderr: null,
          compile_output: 'SyntaxError',
          status: { id: 6, description: 'Compilation Error' },
        },
      }),
    );
    const strategy = makeStrategy(post);

    const result = await strategy.execute('python', 'bad code', '');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('SyntaxError');
    expect(result.signal).toBe('Compilation Error');
  });

  it('rejects languages not supported by Judge0 mapping', async () => {
    const post = jest.fn();
    const strategy = makeStrategy(post);

    await expect(
      strategy.execute('dart', 'void main() {}', ''),
    ).rejects.toThrow(
      "Language 'dart' is not supported by the execution engine.",
    );
    expect(post).not.toHaveBeenCalled();
  });
});
