import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  APICallError,
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
} from 'ai';
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import { AiTier, AiUsageSnapshot, emptyUsage } from './ai-types';

export interface AiCallMeta {
  tier: AiTier;
  combo: string;
  provider: string;
  resolvedModel: string;
  costUsd: number | null;
  latencyMs: number;
  usage: AiUsageSnapshot;
}

export class AiOutputError extends Error {
  constructor(
    readonly issues: string,
    readonly meta: AiCallMeta,
    readonly rawText: string,
  ) {
    super(`AI output did not match the expected structure: ${issues}`);
  }
}

export class AiUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly meta: AiCallMeta,
  ) {
    super(message);
  }
}

type StructuredCall<T> = {
  tier: AiTier;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
};

type TextCall = Omit<StructuredCall<unknown>, 'schema' | 'schemaName'>;

const DEFAULT_TIMEOUT_MS = 150_000;

const schemaTextCache = new WeakMap<z.ZodType, string>();

/** Compact JSON Schema appended to the (static) system prompt. */
function jsonInstructions(schema: z.ZodType): string {
  let text = schemaTextCache.get(schema);
  if (!text) {
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, {
      io: 'input',
      unrepresentable: 'any',
    }) as Record<string, unknown>;
    text = JSON.stringify(jsonSchema);
    schemaTextCache.set(schema, text);
  }
  return `Respond with ONE JSON object only — no markdown fences, no commentary before or after. It must match this JSON Schema:\n${text}`;
}

/**
 * Adapts AI SDK requests to how OmniRoute routes combos:
 * - `stream: false` is made explicit — OmniRoute keys can default to
 *   streaming when a request omits it, and the AI SDK omits it.
 * - `system` messages are sent as `developer`: OmniRoute pins system-role
 *   requests away from some combo members (Antigravity/Gemini), while
 *   `developer` routes normally and is converted back to `system` for any
 *   upstream that doesn't support it.
 */
const omniRouteFetch: typeof fetch = (input, init) => {
  if (typeof init?.body === 'string' && init.body.startsWith('{')) {
    try {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (!('stream' in body)) body.stream = false;
      if (Array.isArray(body.messages)) {
        body.messages = (body.messages as { role?: string }[]).map((m) =>
          m?.role === 'system' ? { ...m, role: 'developer' } : m,
        );
      }
      return fetch(input, { ...init, body: JSON.stringify(body) });
    } catch {
      // Not JSON — send untouched.
    }
  }
  return fetch(input, init);
};

/**
 * Thin client for the OmniRoute gateway. Model selection, provider fallback
 * and retries all live in OmniRoute combos — this class only knows the three
 * combo names (one per tier) from env, so routing is debugged in one place:
 * the OmniRoute dashboard.
 */
@Injectable()
export class OmniRouteService {
  private readonly logger = new Logger(OmniRouteService.name);
  private readonly provider: ReturnType<typeof createOpenAICompatible>;
  private readonly combos: Record<AiTier, string>;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OMNIROUTE_API_KEY') || '';
    this.combos = {
      lite: config.get<string>('OMNIROUTE_COMBO_LITE') || 'mentrily-lite',
      standard:
        config.get<string>('OMNIROUTE_COMBO_STANDARD') || 'mentrily-standard',
      pro: config.get<string>('OMNIROUTE_COMBO_PRO') || 'mentrily-pro',
    };
    this.provider = createOpenAICompatible({
      name: 'omniroute',
      baseURL:
        config.get<string>('OMNIROUTE_BASE_URL') || 'http://localhost:20128/v1',
      apiKey: this.apiKey,
      includeUsage: true,
      supportsStructuredOutputs: true,
      // Tenant isolation: OmniRoute must never recall one org's content into
      // another org's request (memory) or serve it from a shared cache.
      // Compression engines rewrite prose, which is risky for teaching content.
      headers: {
        'x-omniroute-no-memory': 'true',
        'X-OmniRoute-No-Cache': 'true',
        'x-omniroute-compression': 'off',
      },
      fetch: omniRouteFetch,
    });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  comboFor(tier: AiTier): string {
    return this.combos[tier];
  }

  model(tier: AiTier): LanguageModel {
    this.assertConfigured();
    return this.provider.chatModel(this.combos[tier]);
  }

  signalFor(abortSignal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const timeout = AbortSignal.timeout(timeoutMs);
    return abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout;
  }

  /**
   * JSON output via the prompt rather than `response_format`: OmniRoute's
   * combo compatibility filter drops every member without a confirmed
   * structured-output capability when `response_format` is present, which
   * silently skips most combo members. Every reply is still parsed, repaired
   * and validated against the zod schema.
   */
  async generateStructured<T>(
    call: StructuredCall<T>,
  ): Promise<{ data: T; meta: AiCallMeta }> {
    this.assertConfigured();
    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({
        model: this.model(call.tier),
        system: `${call.system}\n\n${jsonInstructions(call.schema)}`,
        prompt: call.prompt,
        maxOutputTokens: call.maxOutputTokens,
        maxRetries: 0,
        abortSignal: this.signalFor(call.abortSignal, call.timeoutMs),
      });
    } catch (error) {
      throw this.toUpstreamError(error, call.tier, startedAt);
    }
    const meta = this.buildMeta(
      call.tier,
      result.usage,
      result.response?.headers,
      startedAt,
    );
    return {
      data: this.repairStructured(call.schema, result.text, meta),
      meta,
    };
  }

  async generatePlainText(
    call: TextCall,
  ): Promise<{ text: string; meta: AiCallMeta }> {
    this.assertConfigured();
    const startedAt = Date.now();
    try {
      const result = await generateText({
        model: this.model(call.tier),
        system: call.system,
        prompt: call.prompt,
        maxOutputTokens: call.maxOutputTokens,
        maxRetries: 0,
        abortSignal: this.signalFor(call.abortSignal, call.timeoutMs),
      });
      return {
        text: result.text.trim(),
        meta: this.buildMeta(
          call.tier,
          result.usage,
          result.response?.headers,
          startedAt,
        ),
      };
    } catch (error) {
      throw this.toUpstreamError(error, call.tier, startedAt);
    }
  }

  buildMeta(
    tier: AiTier,
    usage: LanguageModelUsage | undefined,
    headers: Record<string, string> | undefined,
    startedAt: number,
  ): AiCallMeta {
    const header = (name: string) =>
      headers?.[name] ?? headers?.[name.toLowerCase()] ?? '';
    const cost = Number(header('x-omniroute-response-cost'));
    const input = usage?.inputTokens ?? 0;
    const output = usage?.outputTokens ?? 0;
    return {
      tier,
      combo: this.combos[tier],
      provider: header('x-omniroute-provider') || 'omniroute',
      resolvedModel: header('x-omniroute-model') || this.combos[tier],
      costUsd:
        Number.isFinite(cost) && header('x-omniroute-response-cost')
          ? cost
          : null,
      latencyMs: Date.now() - startedAt,
      usage: usage
        ? {
            inputTokens: input,
            outputTokens: output,
            cachedTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
            totalTokens: usage.totalTokens ?? input + output,
          }
        : emptyUsage(),
    };
  }

  private repairStructured<T>(
    schema: z.ZodType<T>,
    rawText: string,
    meta: AiCallMeta,
  ): T {
    const text = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const candidate =
      start !== -1 && end > start ? text.slice(start, end + 1) : text;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonrepair(candidate));
    } catch {
      throw new AiOutputError('response was not valid JSON', meta, rawText);
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new AiOutputError(issues, meta, rawText);
    }
    return result.data;
  }

  private toUpstreamError(
    error: unknown,
    tier: AiTier,
    startedAt: number,
  ): Error {
    if (error instanceof AiOutputError || error instanceof AiUpstreamError) {
      return error;
    }
    const meta = this.buildMeta(tier, undefined, undefined, startedAt);
    if (APICallError.isInstance(error)) {
      this.logger.warn(
        `[omniroute:${this.combos[tier]}] ${error.statusCode ?? '-'} ${error.message.slice(0, 300)}`,
      );
      return new AiUpstreamError(
        'The AI service is temporarily unavailable. Please try again.',
        error.statusCode ?? null,
        meta,
      );
    }
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      return new AiUpstreamError(
        'The AI request took too long and was stopped.',
        null,
        meta,
      );
    }
    this.logger.warn(
      `[omniroute:${this.combos[tier]}] ${error instanceof Error ? error.message : String(error)}`,
    );
    return new AiUpstreamError(
      'The AI service returned an unexpected error.',
      null,
      meta,
    );
  }

  private assertConfigured() {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'AI is not configured. Set OMNIROUTE_BASE_URL and OMNIROUTE_API_KEY.',
      );
    }
  }
}
