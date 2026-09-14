import { Injectable, Logger } from '@nestjs/common';
import { CodeExecutionService } from '../../code-execution/code-execution.service';
import type { BuilderQuestion } from './normalize';

export interface CodingVerification {
  status: 'verified' | 'failed' | 'unavailable';
  failures: string[];
}

const RUN_TIMEOUT_MS = 20_000;

/**
 * Runs each language's model solution against the generated test cases using
 * the same runner and comparison students are graded with (trimmed stdout,
 * no stderr). Execution outages downgrade to "unavailable" rather than
 * failing the question.
 */
@Injectable()
export class CodingVerifierService {
  private readonly logger = new Logger(CodingVerifierService.name);

  constructor(private readonly execution: CodeExecutionService) {}

  async verify(question: BuilderQuestion): Promise<CodingVerification> {
    const config = question.codingConfig;
    if (!config?.testCases.length) {
      return { status: 'failed', failures: ['no test cases'] };
    }

    const failures: string[] = [];
    let ran = 0;
    for (const [language, template] of Object.entries(config.templates)) {
      const program = template.solution.trim();
      if (!program) continue;
      for (const [index, test] of config.testCases.entries()) {
        let result: { stdout?: string; stderr?: string; code?: number | null };
        try {
          result = (await Promise.race([
            this.execution.runCode(language, program, test.input),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), RUN_TIMEOUT_MS),
            ),
          ])) as typeof result;
        } catch (error) {
          this.logger.warn(
            `Code verification unavailable: ${error instanceof Error ? error.message : String(error)}`,
          );
          return { status: 'unavailable', failures: [] };
        }
        ran += 1;
        const stdout = String(result?.stdout ?? '').trim();
        const stderr = String(result?.stderr ?? '').trim();
        if (stderr || (result?.code !== 0 && result?.code != null)) {
          failures.push(
            `${language} solution errored on test ${index + 1}: ${stderr.slice(0, 200) || 'non-zero exit'}`,
          );
        } else if (stdout !== test.output.trim()) {
          failures.push(
            `${language} solution printed "${stdout.slice(0, 80)}" but test ${index + 1} expects "${test.output.slice(0, 80)}"`,
          );
        }
      }
    }

    if (ran === 0)
      return { status: 'failed', failures: ['no solution to run'] };
    return failures.length
      ? { status: 'failed', failures: failures.slice(0, 6) }
      : { status: 'verified', failures: [] };
  }
}
