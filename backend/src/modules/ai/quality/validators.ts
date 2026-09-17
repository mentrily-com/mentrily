import {
  callsFunction,
  definesFunction,
  functionName,
  readsInput,
  type CodeTemplate,
} from './coding-format';
import type { BuilderQuestion } from './normalize';
import { plainText } from './sanitize';

/**
 * The header / starter / footer split: the learner writes one function, the
 * hidden footer does all input and output around it.
 */
function validateTemplate(lang: string, tpl: CodeTemplate): string[] {
  const issues: string[] = [];
  const name = functionName(lang, tpl.body);
  if (!name) {
    return [
      `the ${lang} starter must be just the function the learner completes (a def/function with its signature)`,
    ];
  }
  if (!tpl.tail.trim()) {
    issues.push(
      `the ${lang} footer is empty: it must read stdin, call ${name} and print the result`,
    );
  } else if (!callsFunction(tpl.tail, name)) {
    issues.push(`the ${lang} footer must call ${name}`);
  }
  if (readsInput(lang, tpl.body)) {
    issues.push(
      `the ${lang} starter must not read input; the footer reads stdin and passes it to ${name}`,
    );
  }
  if (tpl.head && definesFunction(lang, tpl.head, name)) {
    issues.push(`the ${lang} header must not define ${name}`);
  }
  if (tpl.solution.trim()) {
    if (!definesFunction(lang, tpl.solution, name)) {
      issues.push(
        `the ${lang} solution must be the same function ${name} as the starter, fully implemented`,
      );
    }
    if (readsInput(lang, tpl.solution)) {
      issues.push(
        `the ${lang} solution must not read input; the footer does that`,
      );
    }
    if (tpl.solution.trim() === tpl.body.trim()) {
      issues.push(
        `the ${lang} starter must not contain the solution; leave a placeholder body`,
      );
    }
  }
  return issues;
}

/**
 * Deterministic checks run on every generated question. Each message is
 * phrased so it can be fed straight back to the model as repair feedback.
 */
export function validateQuestion(q: BuilderQuestion): string[] {
  const issues: string[] = [];
  const statementText = plainText(q.problemStatement, 5000);

  if (!q.title.trim()) issues.push('title is empty');
  if (q.type !== 'Reading' && statementText.length < 15) {
    issues.push('problemStatement is missing or too short');
  }

  switch (q.type) {
    case 'MCQ': {
      const options = q.options ?? [];
      if (options.length < 4) {
        issues.push(
          `MCQ needs at least 4 distinct options (has ${options.length})`,
        );
      }
      const correct = options.filter((o) => o.isCorrect).length;
      if (correct !== 1) {
        issues.push(`MCQ needs exactly 1 correct option (has ${correct})`);
      }
      break;
    }
    case 'MultiSelect': {
      const options = q.options ?? [];
      if (options.length < 4) {
        issues.push(
          `MultiSelect needs at least 4 distinct options (has ${options.length})`,
        );
      }
      const correct = options.filter((o) => o.isCorrect).length;
      if (correct < 1)
        issues.push('MultiSelect needs at least 1 correct option');
      if (correct === options.length) {
        issues.push('MultiSelect needs at least 1 incorrect option');
      }
      break;
    }
    case 'Coding': {
      const config = q.codingConfig;
      const tests = config?.testCases ?? [];
      if (tests.length < 3) {
        issues.push(`Coding needs 3 to 6 test cases (has ${tests.length})`);
      }
      if (!tests.some((t) => !t.isPublic)) {
        issues.push(
          'Coding needs at least 1 hidden test case (isPublic false)',
        );
      }
      const hasSolution = Object.values(config?.templates ?? {}).some(
        (tpl) => tpl.solution.trim().length > 0,
      );
      if (!hasSolution) issues.push('Coding needs a solution');
      if (tests.some((t) => t.output.length > 400)) {
        issues.push(
          'test case outputs must be exact program output, not prose',
        );
      }
      for (const [lang, tpl] of Object.entries(config?.templates ?? {})) {
        issues.push(...validateTemplate(lang, tpl));
      }
      break;
    }
    case 'Web':
      if (!q.webConfig?.html.trim()) issues.push('Web needs starter HTML');
      break;
    case 'Reading': {
      const text = (q.readingConfig?.contentBlocks ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => plainText(b.content, 20000))
        .join(' ');
      if (text.length < 200) {
        issues.push('Reading lesson is too short (needs several paragraphs)');
      }
      break;
    }
    case 'Notebook':
      if (!q.notebookConfig?.initialCode.trim()) {
        issues.push('Notebook needs starter code');
      }
      break;
  }

  return issues;
}
