import { runBenchmark } from './benchmark-engine';

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:4000';

  console.log(`\n===============================================================`);
  console.log(`🔥 SCENARIO 4: CODE EXECUTION QUEUE & JUDGE0 SATURATION TEST`);
  console.log(`===============================================================`);

  // Phase 1: 10 concurrent code executions
  await runBenchmark({
    name: 'Code Execution Queue - 10 Concurrent Submissions (10 reqs)',
    totalRequests: 10,
    concurrency: 10,
    requestFn: async (idx) => {
      const studentNum = (idx % 50) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/code/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'python',
          code: `print("Result from worker ${idx}:", ${idx} * 2)`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // Phase 2: 25 concurrent code executions
  await runBenchmark({
    name: 'Code Execution Saturation - 25 Concurrent Submissions (25 reqs)',
    totalRequests: 25,
    concurrency: 25,
    requestFn: async (idx) => {
      const studentNum = (idx % 50) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/code/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'python',
          code: `print("Stress test job ${idx}")`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });
}

if (require.main === module) {
  main().then(() => {
    console.log('✅ Scenario 4 Completed.');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Scenario 4 Failed:', err);
    process.exit(1);
  });
}
