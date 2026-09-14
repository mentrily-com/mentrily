import { runBenchmark } from './benchmark-engine';

async function main() {
  const studentCount = 50;
  const baseUrl = process.env.API_URL || 'http://localhost:4000';

  console.log(`\n===============================================================`);
  console.log(`🔥 SCENARIO 1: AUTHENTICATION & HOT-PATH THROUGHPUT STRESS TEST`);
  console.log(`===============================================================`);

  // Phase 1: 50 concurrent virtual students (500 requests)
  await runBenchmark({
    name: 'Auth Throughput - 50 Concurrent Students (500 reqs)',
    totalRequests: 500,
    concurrency: 50,
    requestFn: async (idx) => {
      const studentNum = (idx % studentCount) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return { status: res.status, ok: res.ok };
    },
  });

  // Phase 2: 100 concurrent virtual students (1,000 requests)
  await runBenchmark({
    name: 'Auth Saturation - 100 Concurrent Students (1,000 reqs)',
    totalRequests: 1000,
    concurrency: 100,
    requestFn: async (idx) => {
      const studentNum = (idx % studentCount) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return { status: res.status, ok: res.ok };
    },
  });

  // Phase 3: Workspace memberships resolution (500 requests)
  await runBenchmark({
    name: 'Workspace Memberships Resolution (500 reqs, Concurrency 50)',
    totalRequests: 500,
    concurrency: 50,
    requestFn: async (idx) => {
      const studentNum = (idx % studentCount) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/auth/memberships`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return { status: res.status, ok: res.ok };
    },
  });
}

if (require.main === module) {
  main().then(() => {
    console.log('✅ Scenario 1 Completed.');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Scenario 1 Failed:', err);
    process.exit(1);
  });
}
