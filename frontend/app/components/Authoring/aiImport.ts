// Temporary bridge feature: lets a creator paste a hand-written or externally-generated
// JSON blob (e.g. from pasting a prompt into an external AI chat) and have it normalized
// into real Section/Question objects for the course/exam builder. This is intentionally
// separate from any real AI integration.
import { Question, Section } from './types';

export type AiImportKind = 'exam' | 'course';

export interface AiImportTypeInfo {
    type: Question['type'];
    key: string;
    label: string;
    feature?: string;
}

// Order mirrors each builder's "Add Question" menu.
const EXAM_TYPES: AiImportTypeInfo[] = [
    { type: 'MCQ', key: 'mcq', label: 'Single choice (MCQ)' },
    { type: 'MultiSelect', key: 'multiselect', label: 'Multiple choice' },
    { type: 'Coding', key: 'coding', label: 'Coding exercise', feature: 'coding' },
    { type: 'Web', key: 'web', label: 'Web project', feature: 'webEditor' },
    { type: 'Notebook', key: 'notebook', label: 'Python notebook', feature: 'pythonNotebook' },
];

const COURSE_TYPES: AiImportTypeInfo[] = [
    { type: 'MCQ', key: 'mcq', label: 'Single choice (MCQ)' },
    { type: 'MultiSelect', key: 'multiselect', label: 'Multiple choice' },
    { type: 'Coding', key: 'coding', label: 'Coding exercise', feature: 'coding' },
    { type: 'Web', key: 'web', label: 'Web project', feature: 'webEditor' },
    { type: 'Reading', key: 'reading', label: 'Reading / content' },
    { type: 'Notebook', key: 'notebook', label: 'Python notebook', feature: 'pythonNotebook' },
];

export function getAvailableImportTypes(kind: AiImportKind, canUse: (feature: string) => boolean): AiImportTypeInfo[] {
    const all = kind === 'exam' ? EXAM_TYPES : COURSE_TYPES;
    return all.filter((t) => !t.feature || canUse(t.feature));
}

function typeSchemaSnippet(key: string): string {
    switch (key) {
        case 'mcq':
        case 'multiselect':
            return `      "options": [
        { "text": "Option text", "isCorrect": true },
        { "text": "Option text", "isCorrect": false }
      ]`;
        case 'coding':
            return `      "testCases": [
        { "input": "sample input", "output": "expected output", "isPublic": true }
      ],
      "solution": "reference solution code (optional)"`;
        case 'web':
            return `      "html": "<h1>Hello</h1>",
      "css": "body { color: blue; }",
      "js": ""`;
        case 'reading':
            return `      "content": "HTML or plain text for the reading block"`;
        case 'notebook':
            return `      "initialCode": "# starter python code"`;
        default:
            return '';
    }
}

export function buildAiPrompt(kind: AiImportKind, availableTypes: AiImportTypeInfo[]): string {
    const noun = kind === 'exam' ? 'exam' : 'course';
    const typeList = availableTypes.map((t) => `"${t.key}"`).join(', ');
    const exampleType = availableTypes[0]?.key || 'mcq';
    const extraFields = typeSchemaSnippet(exampleType);

    return `You are helping me draft ${noun} content as JSON so I can import it into my ${noun} builder.

Only use these question types: ${typeList}.

Return ONLY valid JSON (no markdown fences, no commentary) matching this shape:

{
  "sections": [
    {
      "title": "Section title",
      "questions": [
        {
          "type": "${exampleType}",
          "title": "Question title",
          "problemStatement": "Question text / instructions",
          "marks": 10,
          "difficulty": "Easy | Medium | Hard",
          "tags": ["optional", "tags"],
${extraFields}
        }
      ]
    }
  ]
}

Notes:
- "type" must be one of: ${typeList} (lowercase, exactly as listed).
- Every question needs: type, title, problemStatement, marks, difficulty, tags.
- Add the extra fields relevant to each question's type (options for mcq/multiselect, testCases/solution for coding, html/css/js for web, content for reading, initialCode for notebook) — omit fields that don't apply.
- Include as many sections/questions as I ask for.

Topic / requirements:
<describe what you want the ${noun} to cover here>`;
}

export interface AiJsonParseResult {
    data: any | null;
    error?: string;
}

export function parseAiJson(raw: string): AiJsonParseResult {
    if (!raw || !raw.trim()) {
        return { data: null, error: 'Paste the JSON the AI gave you first.' };
    }

    let text = raw.trim();

    // Strip ```json ... ``` or ``` ... ``` code fences if present.
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        text = fenceMatch[1].trim();
    }

    // If there's leading/trailing prose around the JSON object, try to isolate it.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace > 0 || (lastBrace >= 0 && lastBrace < text.length - 1)) {
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            text = text.slice(firstBrace, lastBrace + 1);
        }
    }

    try {
        return { data: JSON.parse(text) };
    } catch {
        // Lenient retry: strip trailing commas before ] or }.
        const repaired = text.replace(/,\s*([\]}])/g, '$1');
        try {
            return { data: JSON.parse(repaired) };
        } catch (err: any) {
            return { data: null, error: `Could not parse that as JSON (${err?.message || 'invalid syntax'}).` };
        }
    }
}

function normalizeTypeKey(raw: unknown): string {
    return String(raw ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
}

function coerceDifficulty(raw: unknown): Question['difficulty'] {
    const v = String(raw ?? '')
        .trim()
        .toLowerCase();
    if (v === 'easy') return 'Easy';
    if (v === 'hard') return 'Hard';
    return 'Medium';
}

function coerceTags(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map((t) => String(t)).filter(Boolean);
    if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
    return [];
}

function coerceMarks(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 10;
    return Math.round(n);
}

function buildQuestionFromRaw(type: Question['type'], raw: any, id: string): Question {
    const base: Question = {
        id,
        type,
        title: String(raw?.title || raw?.question || `New ${type} Question`).slice(0, 300),
        problemStatement: String(raw?.problemStatement || raw?.description || raw?.prompt || ''),
        marks: coerceMarks(raw?.marks ?? raw?.points),
        difficulty: coerceDifficulty(raw?.difficulty),
        tags: coerceTags(raw?.tags),
    };

    if (type === 'MCQ' || type === 'MultiSelect') {
        const rawOptions = Array.isArray(raw?.options) ? raw.options : [];
        let options: { id: string; text: string; isCorrect: boolean }[] = rawOptions
            .map((opt: any, idx: number) => ({
                id: `opt-${id}-${idx}`,
                text: String(typeof opt === 'string' ? opt : opt?.text || `Option ${idx + 1}`),
                isCorrect: typeof opt === 'object' ? Boolean(opt?.isCorrect) : false,
            }))
            .slice(0, 10);

        if (options.length < 2) {
            options = [
                { id: `opt-${id}-1`, text: 'Option 1', isCorrect: true },
                { id: `opt-${id}-2`, text: 'Option 2', isCorrect: false },
            ];
        } else if (type === 'MCQ' && !options.some((o) => o.isCorrect)) {
            options[0].isCorrect = true;
        } else if (type === 'MultiSelect' && !options.some((o) => o.isCorrect)) {
            options[0].isCorrect = true;
        }

        base.options = options;
    }

    if (type === 'Coding') {
        const rawTestCases = Array.isArray(raw?.testCases) ? raw.testCases : [];
        const testCases = rawTestCases.slice(0, 20).map((tc: any) => ({
            input: String(tc?.input ?? ''),
            output: String(tc?.output ?? ''),
            isPublic: tc?.isPublic !== false,
            points: Number.isFinite(Number(tc?.points)) ? Number(tc.points) : 10,
        }));

        const solution = String(raw?.solution || '');
        base.codingConfig = {
            templates: {
                javascript: { head: '', body: '// Write your code here', tail: '', solution },
                python: { head: '', body: '# Write your code here', tail: '', solution },
            },
            testCases,
            showTestCases: false,
        };
    }

    if (type === 'Web') {
        base.webConfig = {
            html: String(raw?.html || '<h1>Hello World</h1>'),
            css: String(raw?.css || 'body { color: blue; }'),
            js: String(raw?.js || ''),
            showFiles: { html: true, css: true, js: true },
            testCases: [],
        };
    }

    if (type === 'Reading') {
        const content = String(raw?.content || raw?.problemStatement || '<p>Start writing your content...</p>');
        base.readingConfig = {
            contentBlocks: [{ id: `${id}-block-1`, type: 'text', content }],
        };
    }

    if (type === 'Notebook') {
        base.notebookConfig = {
            initialCode: String(raw?.initialCode || raw?.code || '# Write your Python code here'),
            language: 'python',
            maxExecutionTime: 10,
            allowedLibraries: Array.isArray(raw?.allowedLibraries)
                ? raw.allowedLibraries.map(String)
                : ['numpy', 'matplotlib'],
        };
    }

    return base;
}

export interface NormalizeStats {
    sectionsImported: number;
    questionsImported: number;
    questionsSkipped: number;
    skippedReasons: string[];
}

export interface NormalizeOptions {
    allowedTypes: AiImportTypeInfo[];
}

export function normalizeImportedSections(
    rawSections: unknown,
    opts: NormalizeOptions,
): { sections: Section[]; stats: NormalizeStats } {
    const stats: NormalizeStats = {
        sectionsImported: 0,
        questionsImported: 0,
        questionsSkipped: 0,
        skippedReasons: [],
    };

    const keyToType = new Map(opts.allowedTypes.map((t) => [t.key, t.type]));
    const list = Array.isArray(rawSections) ? rawSections : [];
    const stamp = Date.now();

    const sections: Section[] = list.map((rawSection: any, sIdx: number) => {
        const sectionId = `sec-ai-${stamp}-${sIdx}`;
        const rawQuestions = Array.isArray(rawSection?.questions) ? rawSection.questions : [];

        const questions: Question[] = [];
        rawQuestions.forEach((rawQuestion: any, qIdx: number) => {
            const typeKey = normalizeTypeKey(rawQuestion?.type);
            const resolvedType = keyToType.get(typeKey);
            if (!resolvedType) {
                stats.questionsSkipped += 1;
                stats.skippedReasons.push(
                    `"${rawQuestion?.title || rawQuestion?.type || 'Untitled'}" — type "${rawQuestion?.type ?? 'unknown'}" isn't available on your plan.`,
                );
                return;
            }

            const questionId = `q-ai-${stamp}-${sIdx}-${qIdx}`;
            questions.push(buildQuestionFromRaw(resolvedType, rawQuestion, questionId));
            stats.questionsImported += 1;
        });

        return {
            id: sectionId,
            title: String(rawSection?.title || `Imported Section ${sIdx + 1}`).slice(0, 200),
            questions,
        };
    });

    stats.sectionsImported = sections.length;
    return { sections, stats };
}
