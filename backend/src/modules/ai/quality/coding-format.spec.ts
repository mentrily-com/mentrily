import { toRawQuestion } from '../generation/generation.service';
import type { RawGeneratedQuestion } from '../schemas/generation.schemas';
import {
  assembleProgram,
  callsFunction,
  cleanCode,
  functionName,
  readsInput,
  signature,
  splitCodingStatement,
} from './coding-format';
import { toBuilderQuestion } from './normalize';
import { validateQuestion } from './validators';

const python = {
  header: 'from typing import List',
  starter:
    'def count_pairs(nums: List[int], k: int) -> int:\n    """Return how many pairs (i < j) sum to k."""\n    pass',
  footer:
    'import sys\n\ndata = sys.stdin.read().split()\nn, k = int(data[0]), int(data[1])\nnums = list(map(int, data[2:2 + n]))\nprint(count_pairs(nums, k))',
  solution:
    'def count_pairs(nums: List[int], k: int) -> int:\n    return sum(1 for i in range(len(nums)) for j in range(i + 1, len(nums)) if nums[i] + nums[j] == k)',
};

const javascript = {
  header: '',
  starter:
    '/**\n * @param {number[]} nums\n * @param {number} k\n * @returns {number}\n */\nfunction countPairs(nums, k) {\n  return 0;\n}',
  footer:
    "const data = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconst [n, k] = data;\nconsole.log(countPairs(data.slice(2, 2 + n), k));",
  solution:
    'function countPairs(nums, k) {\n  let count = 0;\n  for (let i = 0; i < nums.length; i++)\n    for (let j = i + 1; j < nums.length; j++) if (nums[i] + nums[j] === k) count++;\n  return count;\n}',
};

const raw = (): RawGeneratedQuestion => ({
  type: 'Coding',
  title: 'Count pairs',
  problemStatement:
    '<p>Count the pairs of numbers that add up to a target.</p>',
  marks: 6,
  difficulty: 'Easy',
  tags: ['arrays'],
  coding: {
    functionDescription:
      'It receives the list and the target and returns the number of pairs. The input is read for you.',
    inputFormat: 'The first line has n and k. The second line has n integers.',
    outputFormat: 'One integer.',
    constraints: ['1 ≤ <code>n</code> ≤ 10<sup>3</sup>'],
    templates: { python, javascript },
    testCases: [
      {
        input: '4 5\n1 4 2 3',
        output: '2',
        isPublic: true,
        explanation: '1 + 4 and 2 + 3.',
      },
      { input: '1 2\n2', output: '0', isPublic: false },
      { input: '3 4\n2 2 2', output: '3', isPublic: false },
    ],
  },
});

const build = (r = raw()) =>
  toBuilderQuestion(r, undefined, ['Coding'], ['python', 'javascript']);

describe('coding format', () => {
  it('assembles programs exactly like the learner runtime', () => {
    expect(
      assembleProgram({ head: 'H', body: 'B', tail: 'T', solution: 'S' }, 'X'),
    ).toBe('H\nX\nT');
  });

  it('strips markdown fences and trailing whitespace', () => {
    expect(cleanCode('```python\ndef f():  \r\n    pass\n```')).toBe(
      'def f():\n    pass',
    );
  });

  it('finds functions, calls and input reading', () => {
    expect(functionName('python', python.starter)).toBe('count_pairs');
    expect(functionName('javascript', javascript.starter)).toBe('countPairs');
    expect(functionName('javascript', 'const solve = (a) => a;')).toBe('solve');
    expect(callsFunction(python.footer, 'count_pairs')).toBe(true);
    expect(callsFunction(python.starter, 'count_pairs')).toBe(false);
    expect(readsInput('python', python.footer)).toBe(true);
    expect(readsInput('python', python.starter)).toBe(false);
    expect(readsInput('javascript', javascript.footer)).toBe(true);
    expect(signature('python', python.starter)).toBe(
      'count_pairs(nums: List[int], k: int) -> int',
    );
    expect(signature('javascript', javascript.starter)).toBe(
      'function countPairs(nums, k)',
    );
  });

  it('maps header/starter/footer onto the builder template', () => {
    const q = build();
    expect(q.codingConfig?.templates.python).toEqual({
      head: python.header,
      body: python.starter,
      tail: python.footer,
      solution: python.solution,
    });
    expect(validateQuestion(q)).toEqual([]);
  });

  it('composes a statement with sections and examples from public tests', () => {
    const html = build().problemStatement;
    const headings = [...html.matchAll(/<h3>(.*?)<\/h3>/g)].map((m) => m[1]);
    expect(headings).toEqual([
      'Function',
      'Input format',
      'Output format',
      'Constraints',
      'Example 1',
    ]);
    expect(html).toContain(
      '<code>count_pairs(nums: List[int], k: int) -&gt; int</code>',
    );
    expect(html).toContain('<pre><code>4 5\n1 4 2 3</code></pre>');
    expect(html).toContain('<strong>Explanation:</strong> 1 + 4 and 2 + 3.');
    // Hidden cases never leak into the statement.
    expect(html).not.toContain('2 2 2');
  });

  it('round-trips through the raw shape used for edits', () => {
    const q = build();
    const back = toRawQuestion(q);
    expect(back.problemStatement).toBe(
      '<p>Count the pairs of numbers that add up to a target.</p>',
    );
    expect(back.coding?.templates.python?.footer).toBe(python.footer);
    expect(back.coding?.constraints).toEqual([
      '1 ≤ <code>n</code> ≤ 10<sup>3</sup>',
    ]);
    expect(back.coding?.testCases[0].explanation).toBe('1 + 4 and 2 + 3.');
    // Rebuilding gives the same statement, not duplicated sections.
    expect(build(back).problemStatement).toBe(q.problemStatement);
  });

  it('does not duplicate sections a model echoes back into the task', () => {
    const q = build();
    const echoed = raw();
    echoed.problemStatement = q.problemStatement;
    expect(build(echoed).problemStatement).toBe(q.problemStatement);
  });

  it('keeps line breaks in formats and escapes plain text', () => {
    const r = raw();
    r.coding!.inputFormat =
      'Line 1: an integer <code>n</code>.\nLine 2: <code>n</code> integers.';
    r.coding!.outputFormat = 'Print 1 if a < b, else 0.';
    const html = build(r).problemStatement;
    expect(html).toContain(
      '<p>Line 1: an integer <code>n</code>.<br />Line 2: <code>n</code> integers.</p>',
    );
    expect(html).toContain('<p>Print 1 if a &lt; b, else 0.</p>');
  });

  it('keeps <placeholder> text instead of dropping it as a tag', () => {
    const r = raw();
    r.coding!.outputFormat =
      'Three lines:<br />Positive Even: <count><br />Sum: <sum>';
    expect(build(r).problemStatement).toContain(
      'Positive Even: &lt;count&gt;<br />Sum: &lt;sum&gt;',
    );
  });

  it('keeps extra sections a teacher added', () => {
    const split = splitCodingStatement(
      '<p>Task.</p><h3>Hint</h3><p>Use a set.</p><h3>Input format</h3><p>One line.</p>',
    );
    expect(split.task).toContain('<h3>Hint</h3>');
    expect(split.inputFormat).toBe('<p>One line.</p>');
  });

  it('flags a starter that does all the I/O itself', () => {
    const legacy = raw();
    legacy.coding!.templates = {
      python: {
        header: '',
        starter: 'import sys\ndata = sys.stdin.read()\n# TODO: solve\nprint(0)',
        footer: '',
        solution: 'import sys\nprint(len(sys.stdin.read().split()))',
      },
    };
    const issues = validateQuestion(
      toBuilderQuestion(legacy, undefined, ['Coding'], ['python']),
    );
    expect(issues.join(' ')).toMatch(/starter must be just the function/);
  });

  it('flags a footer that never calls the function and a leaked solution', () => {
    const broken = raw();
    broken.coding!.templates = {
      python: { ...python, footer: 'print(0)', solution: python.starter },
    };
    const issues = validateQuestion(
      toBuilderQuestion(broken, undefined, ['Coding'], ['python']),
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        'the python footer must call count_pairs',
        'the python starter must not contain the solution; leave a placeholder body',
      ]),
    );
  });
});
