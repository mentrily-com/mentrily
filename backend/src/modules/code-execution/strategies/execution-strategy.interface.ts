export interface ExecutionResult {
  stdout: string;
  stderr: string;
  output: string; // Combined or main output
  code: number; // Exit code
  signal: string;
}

export interface IExecutionStrategy {
  execute(
    language: string,
    code: string,
    stdin?: string,
  ): Promise<ExecutionResult>;
}
