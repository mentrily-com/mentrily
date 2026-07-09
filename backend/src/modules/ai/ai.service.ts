import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Ajv from 'ajv';
import { SupabaseService } from '../../services/supabase/supabase.service';

type AnySchema = Record<string, unknown>;

type AiTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type AiGenerationContext = {
  orgId?: string | null;
  userId?: string | null;
  operation?: string;
};

type AiProviderResponse = {
  content: unknown;
  tokenUsage: AiTokenUsage;
  model: string;
};

interface AiProviderStrategy {
  readonly name: 'groq' | 'openai' | 'anthropic';
  isEnabled(): boolean;
  generate(
    systemPrompt: string,
    userPrompt: string,
    schema: AnySchema,
  ): Promise<AiProviderResponse>;
}

type OpenAiLikeUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type OpenAiLikeResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: OpenAiLikeUsage;
};

const AI_REQUEST_TIMEOUT_MS = 45000;

/** HTTP failure from a provider — carries the status so the retry loop can
 *  tell permanent client errors (4xx) apart from transient ones (429/5xx). */
class AiProviderHttpError extends Error {
  constructor(
    provider: string,
    readonly status: number,
    body: string,
  ) {
    super(`${provider} error ${status}: ${body}`);
  }
}

/** The model answered but the JSON didn't match the schema. Carries the real
 *  token spend (the tokens were consumed even though the output was unusable)
 *  and the validation errors for corrective-feedback retries. */
class SchemaValidationError extends Error {
  constructor(
    readonly validationErrors: string,
    readonly tokenUsage: AiTokenUsage,
    readonly model: string,
  ) {
    super(`Schema validation failed: ${validationErrors}`);
  }
}

/** Shared JSON-mode system prompt. The schema is serialized compact — the
 *  full-course schema is ~9KB pretty-printed and every indent/newline is a
 *  billed prompt token on every single generation call. */
function buildJsonSystemPrompt(
  systemPrompt: string,
  schema: AnySchema,
): string {
  return `${systemPrompt}\n\nYou MUST return a valid JSON object matching this schema exactly. Do NOT wrap the JSON in markdown blocks (e.g. \`\`\`json). JUST return the raw parseable JSON object:\n${JSON.stringify(schema)}`;
}

class GroqProvider implements AiProviderStrategy {
  readonly name = 'groq' as const;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(private readonly apiKey: string) {}

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    schema: AnySchema,
  ): Promise<AiProviderResponse> {
    const payload = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: buildJsonSystemPrompt(systemPrompt, schema),
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    };

    const data = await this.callOpenAiLikeApi(
      this.apiUrl,
      this.apiKey,
      payload,
    );
    const contentStr = data.choices?.[0]?.message?.content;
    if (!contentStr) {
      throw new Error('Empty response from Groq');
    }

    return {
      content: JSON.parse(this.extractJsonString(contentStr)),
      tokenUsage: this.mapUsage(data.usage),
      model: payload.model,
    };
  }

  private async callOpenAiLikeApi(
    url: string,
    apiKey: string,
    body: Record<string, unknown>,
  ): Promise<OpenAiLikeResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AiProviderHttpError('groq', response.status, errorText);
    }

    return (await response.json()) as OpenAiLikeResponse;
  }

  private mapUsage(usage: OpenAiLikeUsage | undefined): AiTokenUsage {
    return {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    };
  }

  private extractJsonString(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      return trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    }
    return trimmed;
  }
}

class OpenAiProvider implements AiProviderStrategy {
  readonly name = 'openai' as const;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(private readonly apiKey: string) {}

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    schema: AnySchema,
  ): Promise<AiProviderResponse> {
    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: buildJsonSystemPrompt(systemPrompt, schema),
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AiProviderHttpError('openai', response.status, errorText);
    }

    const data = (await response.json()) as OpenAiLikeResponse;
    const contentStr = data.choices?.[0]?.message?.content;
    if (!contentStr) {
      throw new Error('Empty response from OpenAI');
    }

    const normalized = contentStr
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    return {
      content: JSON.parse(normalized),
      tokenUsage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: payload.model,
    };
  }
}

type AnthropicContentBlock = {
  type: string;
  text?: string;
};

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  usage?: AnthropicUsage;
};

class AnthropicProvider implements AiProviderStrategy {
  readonly name = 'anthropic' as const;
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';

  constructor(private readonly apiKey: string) {}

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    schema: AnySchema,
  ): Promise<AiProviderResponse> {
    // claude-3-5-sonnet-20241022 was retired (Oct 2025) and now 404s.
    // Sonnet 5: non-default temperature is rejected (omit it), thinking is
    // on by default (disabled here — this is a JSON-emitter under a 45s
    // deadline), and 4096 max_tokens truncated full-course JSON mid-object.
    const payload = {
      model: 'claude-sonnet-5',
      max_tokens: 16000,
      system: buildJsonSystemPrompt(systemPrompt, schema),
      messages: [{ role: 'user', content: userPrompt }],
      thinking: { type: 'disabled' },
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AiProviderHttpError('anthropic', response.status, errorText);
    }

    const data = (await response.json()) as AnthropicResponse;
    const textBlock = data.content?.find(
      (block) => block.type === 'text' && typeof block.text === 'string',
    );
    const contentStr = textBlock?.text;

    if (!contentStr) {
      throw new Error('Empty response from Anthropic');
    }

    const normalized = contentStr
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(normalized);

    return {
      content: parsed,
      tokenUsage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens:
          (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      model: payload.model,
    };
  }
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ajv = new Ajv({ allErrors: true });
  private readonly providers: AiProviderStrategy[];

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    const groqApiKey =
      this.configService.get<string>('GROQ_API_KEY') ||
      this.configService.get<string>('GROK_API_KEY') ||
      '';
    const openAiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    const anthropicApiKey =
      this.configService.get<string>('ANTHROPIC_API_KEY') || '';

    this.providers = [
      new GroqProvider(groqApiKey),
      new OpenAiProvider(openAiApiKey),
      new AnthropicProvider(anthropicApiKey),
    ];
  }

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  async generateObject(
    systemPrompt: string,
    userPrompt: string,
    schema: AnySchema,
    context: AiGenerationContext = {},
  ): Promise<{
    result: unknown;
    tokenUsage: AiTokenUsage;
    provider: string;
    model: string;
  }> {
    const enabledProviders = this.providers.filter((provider) =>
      provider.isEnabled(),
    );
    if (!enabledProviders.length) {
      throw new HttpException(
        'No AI provider configured. Set GROQ_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const validate = this.ajv.compile(schema);
    const retryDelaysMs = [500, 1000, 2000];
    const operation = context.operation || 'generate-object';
    const providerErrors: string[] = [];

    for (const provider of enabledProviders) {
      // Reset per provider: feedback about one model's malformed JSON
      // shouldn't leak into a different model's first attempt.
      let attemptUserPrompt = userPrompt;

      for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
        try {
          const response = await this.withTimeout(
            provider.generate(systemPrompt, attemptUserPrompt, schema),
            AI_REQUEST_TIMEOUT_MS,
          );

          const isValid = validate(response.content);
          if (!isValid) {
            const validationError = this.ajv.errorsText(validate.errors, {
              separator: '; ',
            });
            throw new SchemaValidationError(
              validationError,
              response.tokenUsage,
              response.model,
            );
          }

          await this.recordUsage({
            orgId: context.orgId,
            userId: context.userId,
            provider: provider.name,
            model: response.model,
            operation,
            tokenUsage: response.tokenUsage,
            success: true,
          });

          return {
            result: response.content,
            tokenUsage: response.tokenUsage,
            provider: provider.name,
            model: response.model,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown AI error';
          this.logger.warn(
            `[${provider.name}] attempt ${attempt + 1}/3 failed: ${message}`,
          );

          // Failed validations still consumed real tokens — bill them.
          if (error instanceof SchemaValidationError) {
            await this.recordUsage({
              orgId: context.orgId,
              userId: context.userId,
              provider: provider.name,
              model: error.model,
              operation,
              tokenUsage: error.tokenUsage,
              success: false,
              errorMessage: message,
            });

            // Retry with the exact validation errors so the model can fix
            // the offending fields instead of re-rolling blind.
            attemptUserPrompt = `${userPrompt}\n\nYour previous JSON response failed schema validation: ${error.validationErrors}. Return a corrected JSON object that fixes exactly these issues.`;
          }

          // Client errors (bad key, malformed request, unknown model) fail
          // identically on every retry — skip straight to the next provider
          // instead of burning two more calls and 1.5s of backoff.
          const isPermanent =
            error instanceof AiProviderHttpError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429;

          if (!isPermanent && attempt < retryDelaysMs.length - 1) {
            await this.delay(retryDelaysMs[attempt]);
            continue;
          }

          providerErrors.push(`${provider.name}: ${message}`);

          if (!(error instanceof SchemaValidationError)) {
            await this.recordUsage({
              orgId: context.orgId,
              userId: context.userId,
              provider: provider.name,
              model: 'unknown',
              operation,
              tokenUsage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
              },
              success: false,
              errorMessage: message,
            });
          }

          break;
        }
      }
    }

    throw new HttpException(
      `Failed to generate content with all providers. ${providerErrors.join(' | ')}`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  async generateSection(
    title: string,
    description: string,
    section: {
      id: string;
      title: string;
      description?: string;
      questions?: unknown[];
    },
    context: AiGenerationContext = {},
  ): Promise<{
    result: unknown;
    tokenUsage: AiTokenUsage;
    provider: string;
    model: string;
  }> {
    const systemPrompt = `You are an expert software engineering instructor and content creator.
Generate full content for ONLY ONE course section.
Course Title: "${title}"
Course Description: "${description}"

Return strictly valid JSON matching the provided schema.`;

    const userPrompt = `Generate complete content for this section only:\n${JSON.stringify(section)}`;

    return this.generateObject(
      systemPrompt,
      userPrompt,
      this.getSingleSectionSchema(),
      {
        ...context,
        operation: context.operation || 'generate-course-section',
      },
    );
  }

  async generateCourseFullBySections(
    title: string,
    description: string,
    outline: {
      sections: Array<{
        id: string;
        title: string;
        description?: string;
        questions?: unknown[];
      }>;
    },
    onProgress?: (event: {
      index: number;
      total: number;
      message: string;
    }) => void,
    context: AiGenerationContext = {},
  ): Promise<{
    courseSummary: string;
    sections: unknown[];
    tokenUsage: AiTokenUsage;
  }> {
    const sections = Array.isArray(outline.sections) ? outline.sections : [];
    const generatedSections: unknown[] = [];
    const totalUsage: AiTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (let index = 0; index < sections.length; index++) {
      const section = sections[index];
      const progress = {
        index: index + 1,
        total: sections.length,
        message: `Generating section ${index + 1} of ${sections.length}`,
      };
      onProgress?.(progress);

      const sectionResult = await this.generateSection(
        title,
        description,
        section,
        {
          ...context,
          operation: 'generate-course-section',
        },
      );

      generatedSections.push(sectionResult.result);
      totalUsage.promptTokens += sectionResult.tokenUsage.promptTokens;
      totalUsage.completionTokens += sectionResult.tokenUsage.completionTokens;
      totalUsage.totalTokens += sectionResult.tokenUsage.totalTokens;
    }

    const summarySystemPrompt = `You are an expert curriculum designer.
Create a comprehensive course summary (cheat sheet) in HTML or Markdown.
Course Title: "${title}"
Course Description: "${description}"`;
    const summarySchema: AnySchema = {
      type: 'object',
      properties: {
        courseSummary: { type: 'string' },
      },
      required: ['courseSummary'],
      additionalProperties: false,
    };

    // The summary only needs the course's shape (what is taught), not the
    // full payload. Re-sending every problem statement, coding template, and
    // test case here made the summary call the most expensive one of the
    // whole run — often bigger than all section generations combined.
    const courseDigest = generatedSections.map((section) => {
      const s = section as {
        title?: string;
        questions?: Array<{
          title?: string;
          type?: string;
          difficulty?: string;
          tags?: string[];
        }>;
      };
      return {
        title: s?.title,
        questions: (s?.questions || []).map((q) => ({
          title: q?.title,
          type: q?.type,
          difficulty: q?.difficulty,
          tags: q?.tags,
        })),
      };
    });

    const summaryResult = await this.generateObject(
      summarySystemPrompt,
      `Generate a summary cheat sheet for a course with these sections and topics:\n${JSON.stringify(courseDigest)}`,
      summarySchema,
      {
        ...context,
        operation: 'generate-course-summary',
      },
    );

    totalUsage.promptTokens += summaryResult.tokenUsage.promptTokens;
    totalUsage.completionTokens += summaryResult.tokenUsage.completionTokens;
    totalUsage.totalTokens += summaryResult.tokenUsage.totalTokens;

    const summaryObject = summaryResult.result as { courseSummary: string };

    return {
      courseSummary: summaryObject.courseSummary,
      sections: generatedSections,
      tokenUsage: totalUsage,
    };
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`AI request timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async recordUsage(params: {
    orgId?: string | null;
    userId?: string | null;
    provider: string;
    model: string;
    operation: string;
    tokenUsage: AiTokenUsage;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    const {
      orgId,
      userId,
      provider,
      model,
      operation,
      tokenUsage,
      success,
      errorMessage,
    } = params;
    if (!orgId) return;

    try {
      const aiUsageDelegate = (
        this.prisma as unknown as {
          aiUsage?: { create: (args: unknown) => Promise<unknown> };
        }
      ).aiUsage;
      if (!aiUsageDelegate) return;

      await aiUsageDelegate.create({
        data: {
          orgId,
          userId: userId || null,
          provider,
          model,
          operation,
          promptTokens: tokenUsage.promptTokens,
          completionTokens: tokenUsage.completionTokens,
          totalTokens: tokenUsage.totalTokens,
          success,
          errorMessage: errorMessage || null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown usage persistence error';
      this.logger.warn(`Failed to persist AI usage: ${message}`);
    }
  }

  // Define schemas here to be used by the controller
  getCourseOutlineSchema() {
    return {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: {
                type: 'string',
                description: 'Name of the section/module',
              },
              description: {
                type: 'string',
                description: 'Brief description of the section',
              },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: {
                      type: 'string',
                      description: 'Question title or topic',
                    },
                    type: {
                      type: 'string',
                      enum: [
                        'MCQ',
                        'MultiSelect',
                        'Coding',
                        'Web',
                        'Reading',
                        'Notebook',
                      ],
                    },
                    intent: {
                      type: 'string',
                      description: 'What this question aims to teach/test',
                    },
                  },
                  required: ['id', 'title', 'type', 'intent'],
                  additionalProperties: false,
                },
              },
            },
            required: ['id', 'title', 'description', 'questions'],
            additionalProperties: false,
          },
        },
      },
      required: ['sections'],
      additionalProperties: false,
    };
  }

  getFullCourseSchema() {
    // This schema needs to exactly match the Question type required by CourseBuilder
    return {
      type: 'object',
      properties: {
        courseSummary: {
          type: 'string',
          description:
            'A comprehensive cheat sheet or syllabus summarizing the entire course content.',
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    type: {
                      type: 'string',
                      enum: [
                        'MCQ',
                        'MultiSelect',
                        'Coding',
                        'Web',
                        'Reading',
                        'Notebook',
                      ],
                    },
                    problemStatement: {
                      type: 'string',
                      description:
                        'HTML/Richtext content of the problem. Must be engaging and well-formatted with lists, bold text, and code snippets where appropriate.',
                    },
                    marks: { type: 'number' },
                    difficulty: {
                      type: 'string',
                      enum: ['Beginner', 'Medium', 'Advanced'],
                    },
                    tags: { type: 'array', items: { type: 'string' } },
                    options: {
                      type: ['array', 'null'],
                      description:
                        'MUST HAVE AT LEAST 4 OPTIONS for MCQ/MultiSelect questions. Do not provide less than 4.',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          text: { type: 'string' },
                          isCorrect: { type: 'boolean' },
                        },
                        required: ['id', 'text', 'isCorrect'],
                        additionalProperties: false,
                      },
                    },
                    codingConfig: {
                      type: ['object', 'null'],
                      description: 'Configuration for Coding type questions',
                      properties: {
                        templates: {
                          type: 'object',
                          description:
                            "Map of language slugs to templates (e.g. 'javascript', 'python')",
                          additionalProperties: {
                            type: 'object',
                            properties: {
                              head: {
                                type: 'string',
                                description:
                                  "Code before student's code (hidden)",
                              },
                              body: {
                                type: 'string',
                                description: 'Starter code',
                              },
                              tail: {
                                type: 'string',
                                description:
                                  "Code after student's code (hidden)",
                              },
                              solution: {
                                type: 'string',
                                description: 'Model solution',
                              },
                            },
                            required: ['head', 'body', 'tail', 'solution'],
                            additionalProperties: false,
                          },
                        },
                        testCases: {
                          type: 'array',
                          description:
                            "Exactly 3 to 6 test cases to validate student's code. You MUST provide at least 3 testcases. Never provide just 1.",
                          items: {
                            type: 'object',
                            properties: {
                              input: { type: 'string' },
                              output: { type: 'string' },
                              isPublic: {
                                type: 'boolean',
                                description:
                                  'True if test case is visible to student',
                              },
                              points: {
                                type: 'number',
                                description:
                                  'Points awarded for passing this test case',
                              },
                            },
                            required: ['input', 'output', 'isPublic', 'points'],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ['templates', 'testCases'],
                      additionalProperties: false,
                    },
                    webConfig: {
                      type: ['object', 'null'],
                      properties: {
                        html: { type: 'string' },
                        css: { type: 'string' },
                        js: { type: 'string' },
                        showFiles: {
                          type: 'object',
                          properties: {
                            html: { type: 'boolean' },
                            css: { type: 'boolean' },
                            js: { type: 'boolean' },
                          },
                          required: ['html', 'css', 'js'],
                          additionalProperties: false,
                        },
                        testCases: { type: 'array' },
                      },
                      required: ['html', 'css', 'js', 'showFiles'],
                      additionalProperties: false,
                    },
                    readingConfig: {
                      type: ['object', 'null'],
                      description: 'Configuration for Reading type questions',
                      properties: {
                        contentBlocks: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              type: {
                                type: 'string',
                                enum: ['text', 'code-runner'],
                              },
                              content: {
                                type: 'string',
                                description:
                                  'HTML for text blocks. Empty for code-runner.',
                              },
                              runnerConfig: {
                                type: ['object', 'null'],
                                description:
                                  "Required if type is 'code-runner'",
                                properties: {
                                  language: {
                                    type: 'string',
                                    enum: [
                                      'javascript',
                                      'python',
                                      'java',
                                      'cpp',
                                    ],
                                  },
                                  initialCode: { type: 'string' },
                                },
                                required: ['language', 'initialCode'],
                                additionalProperties: false,
                              },
                            },
                            required: ['id', 'type', 'content'],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ['contentBlocks'],
                      additionalProperties: false,
                    },
                    notebookConfig: {
                      type: ['object', 'null'],
                      description: 'Configuration for Notebook type questions',
                      properties: {
                        initialCode: { type: 'string' },
                        language: { type: 'string', enum: ['python'] },
                        maxExecutionTime: { type: 'number' },
                        allowedLibraries: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: ['initialCode', 'language'],
                      additionalProperties: false,
                    },
                  },
                  required: [
                    'id',
                    'title',
                    'type',
                    'problemStatement',
                    'marks',
                  ],
                  additionalProperties: true,
                },
              },
            },
            required: ['id', 'title', 'questions'],
            additionalProperties: false,
          },
        },
      },
      required: ['courseSummary', 'sections'],
      additionalProperties: false,
    };
  }

  getSingleSectionSchema() {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              type: {
                type: 'string',
                enum: [
                  'MCQ',
                  'MultiSelect',
                  'Coding',
                  'Web',
                  'Reading',
                  'Notebook',
                ],
              },
              problemStatement: { type: 'string' },
              marks: { type: 'number' },
              difficulty: {
                type: 'string',
                enum: ['Beginner', 'Medium', 'Advanced'],
              },
              tags: { type: 'array', items: { type: 'string' } },
              options: { type: ['array', 'null'] },
              codingConfig: { type: ['object', 'null'] },
              webConfig: { type: ['object', 'null'] },
              readingConfig: { type: ['object', 'null'] },
              notebookConfig: { type: ['object', 'null'] },
            },
            required: ['id', 'title', 'type', 'problemStatement', 'marks'],
            additionalProperties: true,
          },
        },
      },
      required: ['id', 'title', 'questions'],
      additionalProperties: false,
    };
  }

  getExamOutlineSchema() {
    return {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: {
                type: 'string',
                description: 'Name of the exam section',
              },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: {
                      type: 'string',
                      description: 'Question concept being tested',
                    },
                    type: {
                      type: 'string',
                      enum: ['MCQ', 'MultiSelect', 'Coding', 'Web', 'Notebook'],
                    },
                    intent: { type: 'string' },
                    marks: { type: 'number' },
                  },
                  required: ['id', 'title', 'type', 'intent', 'marks'],
                  additionalProperties: false,
                },
              },
            },
            required: ['id', 'title', 'questions'],
            additionalProperties: false,
          },
        },
      },
      required: ['sections'],
      additionalProperties: false,
    };
  }

  getFullExamSchema() {
    // Same structure as course questions but wrapped differently. No courseSummary needed for exam.
    const fullCourseSchema = this.getFullCourseSchema();
    // @ts-ignore
    const sections = fullCourseSchema.properties.sections;
    return {
      type: 'object',
      properties: {
        sections: sections,
      },
      required: ['sections'],
      additionalProperties: false,
    };
  }
}
