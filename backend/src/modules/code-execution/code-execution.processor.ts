import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { IExecutionStrategy } from './strategies/execution-strategy.interface';

@Processor('code-execution', {
  limiter: {
    max: 3, // Reduced to 3/sec to stay safely under the strict 5/sec API limit
    duration: 1000,
  },
  concurrency: 1, // Force sequential processing to prevent burst rate-limiting
  // Optimize for serverless Redis (reduce command usage)
  stalledInterval: 300000,
  maxStalledCount: 3,
  lockDuration: 60000,
})
export class CodeExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(CodeExecutionProcessor.name);

  constructor(
    @Inject('IExecutionStrategy')
    private readonly executionStrategy: IExecutionStrategy,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { language, code, stdin } = job.data;
    this.logger.debug(
      `Processing code execution job ${job.id} for language: ${language}`,
    );

    try {
      const result = await this.executionStrategy.execute(
        language,
        code,
        stdin,
      );
      return result;
    } catch (error: any) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}
