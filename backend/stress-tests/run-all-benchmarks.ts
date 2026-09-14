import { runBenchmark, BenchmarkResult } from './benchmark-engine';
import { seedLoadTestData } from './seed-load-data';
import { spawn } from 'child_process';

function runScenario(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['ts-node', scriptPath], {
      cwd: __dirname + '/..',
      stdio: 'inherit',
      env: process.env,
    });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Scenario ${scriptPath} exited with code ${code}`));
    });
  });
}

async function main() {
  console.log(`\n===============================================================`);
  console.log(`🚀 STARTING MENTRILY FULL-SYSTEM STRESS TEST SUITE`);
  console.log(`===============================================================`);

  // Step 1: Seed / verify test environment
  await seedLoadTestData(50);

  // Step 2: Run all scenarios
  const scenarios = [
    'stress-tests/01-auth-throughput.ts',
    'stress-tests/02-exam-entry-storm.ts',
    'stress-tests/03-answer-autosave-rush.ts',
    'stress-tests/04-code-exec-saturation.ts',
    'stress-tests/05-course-creation-waterfall.ts',
    'stress-tests/06-final-submission.ts',
  ];

  for (const sc of scenarios) {
    try {
      await runScenario(sc);
    } catch (err: any) {
      console.error(`⚠️ ${sc} encountered an error:`, err.message);
    }
  }

  console.log(`\n===============================================================`);
  console.log(`🏁 FULL STRESS TEST SUITE RUN COMPLETED`);
  console.log(`===============================================================\n`);
}

main().catch((err) => {
  console.error('Fatal stress test suite failure:', err);
  process.exit(1);
});
