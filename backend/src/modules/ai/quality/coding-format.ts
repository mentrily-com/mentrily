import { plainText, sanitizeRichText } from './sanitize';

/**
 * Coding questions follow the builder's header / body / footer split, the way
 * HackerRank-style problems work: the learner only writes one function (body),
 * hidden code before it holds imports (header) and hidden code after it reads
 * stdin, calls the function and prints the result (footer).
 */

export interface CodeTemplate {
  head: string;
  body: string;
  tail: string;
  solution: string;
}

/** Exactly how the learner runtime assembles a submission (CodingQuestionRenderer). */
export function assembleProgram(template: CodeTemplate, code: string): string {
  return `${template.head}\n${code}\n${template.tail}`;
}

/** Normalises model code: no markdown fences, Unix newlines, no trailing spaces. */
export function cleanCode(raw: unknown): string {
  let code = typeof raw === 'string' ? raw : '';
  const fenced = code.match(/^\s*```[\w+-]*\s*\n([\s\S]*?)\n?```\s*$/);
  if (fenced) code = fenced[1];
  return code
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

const FUNCTION_PATTERNS: Record<string, RegExp[]> = {
  python: [/^\s*def\s+([A-Za-z_]\w*)\s*\(/m],
  javascript: [
    /^\s*(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/m,
    /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/m,
  ],
};

/** Name of the first function the code defines, if any. */
export function functionName(language: string, code: string): string | null {
  for (const pattern of FUNCTION_PATTERNS[language] ?? []) {
    const match = code.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function definesFunction(
  language: string,
  code: string,
  name: string,
): boolean {
  const escaped = name.replace(/[$]/g, '\\$');
  return language === 'python'
    ? new RegExp(`^\\s*def\\s+${escaped}\\s*\\(`, 'm').test(code)
    : new RegExp(
        `(?:function\\s*\\*?\\s*${escaped}\\s*\\(|(?:const|let|var)\\s+${escaped}\\s*=)`,
      ).test(code);
}

export function callsFunction(code: string, name: string): boolean {
  const escaped = name.replace(/[$]/g, '\\$');
  return new RegExp(`(^|[^\\w$.])${escaped}\\s*\\(`, 'm').test(
    // A call, not the definition itself.
    code.replace(new RegExp(`(def|function)\\s+${escaped}\\s*\\(`, 'g'), ''),
  );
}

const INPUT_READERS: Record<string, RegExp> = {
  python: /\binput\s*\(|sys\.stdin|open\s*\(\s*0\b/,
  javascript:
    /readFileSync\s*\(|process\.stdin|require\s*\(\s*['"]readline['"]\s*\)/,
};

export function readsInput(language: string, code: string): boolean {
  return INPUT_READERS[language]?.test(code) ?? false;
}

/** The signature line learners see, e.g. `count_pairs(nums: List[int], k: int) -> int`. */
export function signature(language: string, code: string): string | null {
  const name = functionName(language, code);
  if (!name) return null;
  const line = code
    .split('\n')
    .find((l) => definesFunction(language, l, name))
    ?.trim();
  if (!line) return null;
  if (language === 'python') {
    return line.replace(/^def\s+/, '').replace(/:\s*$/, '');
  }
  return line.replace(/\s*\{\s*$/, '').replace(/^(export\s+)?/, '');
}

const LANGUAGE_LABEL: Record<string, string> = {
  python: 'Python',
  javascript: 'JavaScript',
};

// ── Problem statement ──────────────────────────────────────────────────────

export interface CodingStatementParts {
  /** What to compute, as HTML. */
  task: string;
  functionDescription: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  /** Public test cases shown as worked examples. */
  examples: { input: string; output: string; explanation?: string }[];
}

const HEADINGS = {
  function: 'Function',
  input: 'Input format',
  output: 'Output format',
  constraints: 'Constraints',
  example: 'Example',
} as const;

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Sanitised block HTML. Text without block tags (plain, or with inline tags
 * like <code>) becomes paragraphs, keeping the line breaks models use for
 * "Line 1: … / Line 2: …" formats.
 */
function block(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  if (/<(p|ul|ol|pre|blockquote|table|h[2-4])\b/i.test(text)) {
    return sanitizeRichText(text);
  }
  const body = /<\/?[a-z][\s\S]*>/i.test(text) ? text : escapeHtml(text);
  return sanitizeRichText(
    body
      .split(/\n\s*\n/)
      .map((para) => `<p>${para.trim().replace(/\n/g, '<br />')}</p>`)
      .join(''),
  );
}

/** Inline HTML without a wrapping paragraph (for list items). */
function inline(raw: string): string {
  const html = sanitizeRichText(raw);
  const single = html.match(/^<p>([\s\S]*)<\/p>$/);
  return single && !single[1].includes('<p>') ? single[1] : html;
}

const MAX_EXAMPLES = 2;

/**
 * Builds the learner-facing statement in one consistent layout. Examples come
 * from the public test cases, so they always match what the grader checks.
 */
export function composeCodingStatement(
  parts: CodingStatementParts,
  templates: Record<string, CodeTemplate>,
): string {
  const html: string[] = [];
  if (parts.task.trim()) html.push(block(parts.task));

  const signatures = Object.entries(templates)
    .map(([lang, tpl]) => ({ lang, sig: signature(lang, tpl.body) }))
    .filter((s): s is { lang: string; sig: string } => Boolean(s.sig));
  if (signatures.length || parts.functionDescription.trim()) {
    html.push(`<h3>${HEADINGS.function}</h3>`);
    if (signatures.length === 1) {
      html.push(`<p><code>${escapeHtml(signatures[0].sig)}</code></p>`);
    } else if (signatures.length > 1) {
      html.push(
        `<ul>${signatures
          .map(
            (s) =>
              `<li><strong>${LANGUAGE_LABEL[s.lang] ?? s.lang}:</strong> <code>${escapeHtml(s.sig)}</code></li>`,
          )
          .join('')}</ul>`,
      );
    }
    if (parts.functionDescription.trim()) {
      html.push(block(parts.functionDescription));
    }
  }

  if (parts.inputFormat.trim()) {
    html.push(`<h3>${HEADINGS.input}</h3>`, block(parts.inputFormat));
  }
  if (parts.outputFormat.trim()) {
    html.push(`<h3>${HEADINGS.output}</h3>`, block(parts.outputFormat));
  }
  const constraints = parts.constraints.map(inline).filter(Boolean);
  if (constraints.length) {
    html.push(
      `<h3>${HEADINGS.constraints}</h3>`,
      `<ul>${constraints.map((c) => `<li>${c}</li>`).join('')}</ul>`,
    );
  }

  parts.examples.slice(0, MAX_EXAMPLES).forEach((example, i) => {
    html.push(`<h3>${HEADINGS.example} ${i + 1}</h3>`);
    if (example.input.trim()) {
      html.push(
        '<p><strong>Input</strong></p>',
        `<pre><code>${escapeHtml(example.input.replace(/\s+$/, ''))}</code></pre>`,
      );
    }
    html.push(
      '<p><strong>Output</strong></p>',
      `<pre><code>${escapeHtml(example.output.replace(/\s+$/, ''))}</code></pre>`,
    );
    const explanation = example.explanation?.trim();
    if (explanation) {
      html.push(`<p><strong>Explanation:</strong> ${inline(explanation)}</p>`);
    }
  });

  return html.join('\n');
}

/**
 * Reverses composeCodingStatement so a saved question can be sent back to the
 * model in parts. Sections the teacher added under other headings stay with
 * the task; the signature line and examples are rebuilt, so they are dropped.
 */
export function splitCodingStatement(html: string): Omit<
  CodingStatementParts,
  'examples'
> & {
  explanations: string[];
} {
  const result = {
    task: '',
    functionDescription: '',
    inputFormat: '',
    outputFormat: '',
    constraints: [] as string[],
    explanations: [] as string[],
  };
  const pieces = html.split(/<h3>([\s\S]*?)<\/h3>/);
  const task: string[] = [pieces[0]];

  for (let i = 1; i < pieces.length; i += 2) {
    const heading = plainText(pieces[i], 80);
    const body = (pieces[i + 1] ?? '').trim();
    const key = heading.toLowerCase();
    if (key === HEADINGS.function.toLowerCase()) {
      // Drop the rebuilt signature line (a list or a lone <code> paragraph).
      result.functionDescription = body
        .replace(/^<ul>[\s\S]*?<\/ul>\s*/, (m) => (/<code>/.test(m) ? '' : m))
        .replace(/^<p><code>[^<]*<\/code><\/p>\s*/, '')
        .trim();
    } else if (key === HEADINGS.input.toLowerCase()) {
      result.inputFormat = body;
    } else if (key === HEADINGS.output.toLowerCase()) {
      result.outputFormat = body;
    } else if (key === HEADINGS.constraints.toLowerCase()) {
      result.constraints = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(
        (m) => m[1].trim(),
      );
    } else if (key.startsWith(HEADINGS.example.toLowerCase())) {
      const explanation = body.match(
        /<p><strong>Explanation:<\/strong>\s*([\s\S]*?)<\/p>/,
      );
      result.explanations.push(explanation ? explanation[1].trim() : '');
    } else {
      task.push(`<h3>${pieces[i]}</h3>`, body);
    }
  }
  result.task = task.join('\n').trim();
  return result;
}
