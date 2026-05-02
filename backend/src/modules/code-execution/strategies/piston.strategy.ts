import {
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
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class PistonStrategy implements IExecutionStrategy {
  private readonly pistonUrl: string;
  private readonly logger = new Logger(PistonStrategy.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.pistonUrl =
      this.configService.get<string>('PISTON_API_URL') ||
      'https://emkc.org/api/v2/piston';
  }

  private generateCacheKey(
    language: string,
    code: string,
    stdin: string,
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${language}:${code}:${stdin}`)
      .digest('hex');
    return `piston:exec:${hash}`;
  }

  async execute(
    language: string,
    code: string,
    stdin: string = '',
  ): Promise<ExecutionResult> {
    const cacheKey = this.generateCacheKey(language, code, stdin);

    try {
      // Check cache first (TTL 24 hours)
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${language} execution`);
        return JSON.parse(cached) as ExecutionResult;
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.pistonUrl}/execute`,
          {
            language,
            version: '*', // Use latest version available
            files: [
              {
                content: code,
              },
            ],
            stdin: stdin,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const run = response.data.run;
      const result: ExecutionResult = {
        stdout: run.stdout,
        stderr: run.stderr,
        output: run.output,
        code: run.code,
        signal: run.signal,
      };

      // Only cache successful executions that aren't errors (status 0 isn't guaranteed but result is valid)
      // Cache for 24 hours
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        60 * 60 * 24,
      );

      return result;
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      this.logger.error(
        `Piston Execution Error [${status}]:`,
        data || error.message,
      );

      if (status === 429) {
        throw new InternalServerErrorException(
          'Rate limit exceeded for code execution service. Please try again later.',
        );
      }

      throw new InternalServerErrorException(
        'Failed to execute code via Piston',
      );
    }
  }
}
