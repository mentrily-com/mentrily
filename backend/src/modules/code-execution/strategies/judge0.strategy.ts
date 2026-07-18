import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  IExecutionStrategy,
  ExecutionResult,
} from './execution-strategy.interface';

@Injectable()
export class Judge0Strategy implements IExecutionStrategy {
  private readonly judge0Url: string;
  private readonly judge0AuthToken: string | undefined;
  private readonly logger = new Logger(Judge0Strategy.name);

  // Mappings from frontend language strings to this deployment's Judge0 CE IDs.
  // Keep these aligned with GET /languages on the configured Judge0 instance.
  private readonly languageMap: Record<string, number> = {
    assembly: 45, // Assembly (NASM 2.14.02)
    bash: 46, // Bash (5.0.0)
    basic: 47, // Basic (FBC 1.07.1)
    c: 50, // C (GCC 9.2.0)
    clang: 75, // C (Clang 7.0.1)
    cpp: 54, // C++ (GCC 9.2.0)
    'c++': 54,
    cpp_clang: 76, // C++ (Clang 7.0.1)
    csharp: 51, // C# (Mono 6.6.0.161)
    'c#': 51,
    clojure: 86, // Clojure (1.10.1)
    cobol: 77, // COBOL (GnuCOBOL 2.2)
    commonlisp: 55, // Common Lisp (SBCL 2.0.0)
    lisp: 55,
    d: 56, // D (DMD 2.089.1)
    elixir: 57, // Elixir (1.9.4)
    erlang: 58, // Erlang (OTP 22.2)
    fsharp: 87, // F# (.NET Core SDK 3.1.202)
    'f#': 87,
    fortran: 59, // Fortran (GFortran 9.2.0)
    go: 60, // Go (1.13.5)
    golang: 60,
    groovy: 88, // Groovy (3.0.3)
    haskell: 61, // Haskell (GHC 8.8.1)
    java: 62, // Java (OpenJDK 13.0.1)
    javascript: 63, // JavaScript (Node.js 12.14.0)
    js: 63,
    kotlin: 78, // Kotlin (1.3.70)
    lua: 64, // Lua (5.3.5)
    objectivec: 79, // Objective-C (Clang 7.0.1)
    ocaml: 65, // OCaml (4.09.0)
    octave: 66, // Octave (5.1.0)
    pascal: 67, // Pascal (FPC 3.0.4)
    perl: 85, // Perl (5.28.1)
    php: 68, // PHP 7.4.1
    prolog: 69, // Prolog (GNU Prolog 1.4.5)
    python: 71, // Python (3.8.1)
    python2: 70, // Python (2.7.17)
    python3: 71,
    py: 71,
    r: 80, // R (4.0.0)
    ruby: 72, // Ruby 2.7.0
    rust: 73, // Rust (1.40.0)
    scala: 81, // Scala (2.13.2)
    sql: 82, // SQL (SQLite 3.27.2)
    sqlite: 82,
    sqlite3: 82,
    swift: 83, // Swift 5.2.3
    typescript: 74, // TypeScript (3.7.4)
    ts: 74,
    vbnet: 84, // Visual Basic.Net (vbnc 0.0.0.5943)
    visualbasic: 84,
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.judge0Url =
      this.configService.get<string>('JUDGE0_API_URL') ||
      'http://127.0.0.1:2358';
    this.judge0AuthToken = this.configService.get<string>('JUDGE0_AUTH_TOKEN');
  }

  async execute(
    language: string,
    code: string,
    stdin: string = '',
  ): Promise<ExecutionResult> {
    const normalizedLanguage = String(language || '').trim().toLowerCase();
    const languageId = this.languageMap[normalizedLanguage];

    if (!languageId) {
      this.logger.warn(`Language not supported by execution engine mapping: ${language}`);
      throw new BadRequestException(
        `Language '${language}' is not supported by the execution engine.`,
      );
    }

    try {
      // POST /submissions?base64_encoded=false&wait=true
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.judge0Url}/submissions?base64_encoded=false&wait=true`,
          {
            source_code: code,
            language_id: languageId,
            stdin: stdin,
            cpu_time_limit: 5,
            wall_time_limit: 20,
            memory_limit: 256000,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(this.judge0AuthToken
                ? { 'X-Auth-Token': this.judge0AuthToken }
                : {}),
            },
          },
        ),
      );

      const judge0Result = response.data;

      // Judge0 usually returns stdout, stderr, compile_output, status
      // We map this to our ExecutionResult
      // Map status id to exit code for our legacy system
      // 3 = Accepted (exit code 0), anything else is an error code
      const exitCode = judge0Result.status?.id === 3 ? 0 : 1;

      // Format an output string that resembles Piston's combined output
      let combinedOutput = '';

      if (judge0Result.compile_output) {
        combinedOutput += judge0Result.compile_output + '\n';
      }
      if (judge0Result.stdout) {
        combinedOutput += judge0Result.stdout;
      }
      if (judge0Result.stderr) {
        combinedOutput += judge0Result.stderr;
      }

      const result: ExecutionResult = {
        stdout: judge0Result.stdout || '',
        stderr:
          (judge0Result.compile_output || '') +
          (judge0Result.stderr ? '\n' + judge0Result.stderr : ''),
        output: combinedOutput.trim(),
        code: exitCode,
        signal: judge0Result.status?.description || judge0Result.error || '',
      };

      return result;
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      this.logger.error(
        `Execution Error [${status}]:`,
        data || error.message,
      );

      if (status === 429) {
        throw new InternalServerErrorException(
          'Rate limit exceeded for code execution service. Please try again later.',
        );
      }

      throw new InternalServerErrorException(
        'Failed to execute code',
      );
    }
  }
}
