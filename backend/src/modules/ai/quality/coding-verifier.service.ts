import { Injectable, Logger } from '@nestjs/common';
import { CodeExecutionService } from '../../code-execution/code-execution.service';
import { assembleProgram } from './coding-format';
import type { BuilderQuestion } from './normalize';

export interface CodingVerification {
  status: 'verified' | 'failed' | 'unavailable';
  failures: string[];
}

const RUN_TIMEOUT_MS = 20_000;

type RunResult = { stdout?: string; stderr?: string; code?: number | null };

class RunnerUnavailable extends Error {}

const COMPILE_ERROR = /\b(SyntaxError|IndentationError|TabError)\b/;

/**
 * Runs header + solution + footer, assembled exactly the way learner
 * submissions are, against every test case with the comparison students are
 * graded with (trimmed stdout, no stderr). The starter is run once too, to
 * catch stubs that don't compile or already print the answer. Execution
 * outages downgrade to "unavailable" rather than failing the question.
 */
@Injectable()
export class CodingVerifierService {
  private readonly logger = new Logger(CodingVerifierService.name);

  constructor(private readonly execution: CodeExecutionService) {}

  private async run(
    language: string,
    program: string,
    input: string,
  ): Promise<RunResult> {
    try {
      return (await Promise.race([
        this.execution.runCode(language, program, input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), RUN_TIMEOUT_MS),
        ),
      ])) as RunResult;
    } catch (error) {
      throw new RunnerUnavailable(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async verify(question: BuilderQuestion): Promise<CodingVerification> {
    const config = question.codingConfig;
    if (!config?.testCases.length) {
      return { status: 'failed', failures: ['no test cases'] };
    }

    const failures: string[] = [];
    let ran = 0;
    try {
      for (const [language, template] of Object.entries(config.templates)) {
        if (!template.solution.trim()) continue;
        const program = assembleProgram(template, template.solution);
        for (const [index, test] of config.testCases.entries()) {
          const result = await this.run(language, program, test.input);
          ran += 1;
          const stdout = String(result?.stdout ?? '').trim();
          const stderr = String(result?.stderr ?? '').trim();
          if (stderr || (result?.code !== 0 && result?.code != null)) {
            failures.push(
              `${language} header + solution + footer errored on test ${index + 1}: ${stderr.slice(0, 200) || 'non-zero exit'}`,
            );
          } else if (stdout !== test.output.trim()) {
            failures.push(
              `${language} header + solution + footer printed "${stdout.slice(0, 80)}" but test ${index + 1} expects "${test.output.slice(0, 80)}"`,
            );
          }
        }

        // The learner's starting point: it must compile and must not
        // already pass (e.g. a starter that contains the solution).
        if (template.tail.trim()) {
          const first = config.testCases[0];
          const result = await this.run(
            language,
            assembleProgram(template, template.body),
            first.input,
          );
          const stderr = String(result?.stderr ?? '');
          if (COMPILE_ERROR.test(stderr)) {
            failures.push(
              `the ${language} starter does not compile with the header and footer: ${stderr.trim().slice(0, 160)}`,
            );
          } else if (
            String(result?.stdout ?? '').trim() === first.output.trim()
          ) {
            failures.push(
              `the ${language} starter already prints the expected output; leave a placeholder body for the learner`,
            );
          }
        }
      }
    } catch (error) {
      if (!(error instanceof RunnerUnavailable)) throw error;
      this.logger.warn(`Code verification unavailable: ${error.message}`);
      return { status: 'unavailable', failures: [] };
    }

    if (ran === 0)
      return { status: 'failed', failures: ['no solution to run'] };
    return failures.length
      ? { status: 'failed', failures: failures.slice(0, 6) }
      : { status: 'verified', failures: [] };
  }
}
