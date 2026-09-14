import { runBenchmark } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const studentCount = 50;
  const baseUrl = process.env.API_URL || 'http://localhost:4000';
  const slug = 'stress-test-exam';

  console.log(`\n===============================================================`);
  console.log(`🔥 SCENARIO 2: EXAM ENTRY STORM ("9:00 AM RUSH") STRESS TEST`);
  console.log(`===============================================================`);

  // Reset any previous exam sessions for our test students so it's a true cold entry
  const deleted = await prisma.examSession.deleteMany({
    where: {
      exam: { slug },
      user: { email: { contains: 'stress-test.local' } },
    },
  });
  console.log(`🧹 Cleaned up ${deleted.count} previous test exam sessions.`);

  // Phase 1: 50 students hitting "Enter Exam" simultaneously at the exact same instant
  await runBenchmark({
    name: 'Exam Entry Storm - 50 Students Simultaneous Entry',
    totalRequests: 50,
    concurrency: 50,
    requestFn: async (idx) => {
      const studentNum = idx + 1;
      const token = `test-load-token-student_${studentNum}`;
      const deviceId = `device_student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/exam/${slug}/enter`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          deviceId,
          tabId: `tab_${studentNum}`,
          metadata: { browser: 'Chrome', platform: 'Linux' },
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // Phase 2: Session resume / status check storm (100 students, Concurrency 50)
  await runBenchmark({
    name: 'Exam Status Check Storm (100 reqs, Concurrency 50)',
    totalRequests: 100,
    concurrency: 50,
    requestFn: async (idx) => {
      const studentNum = (idx % studentCount) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/exam/${slug}/check?json=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return { status: res.status, ok: res.ok };
    },
  });

  await prisma.$disconnect();
}

if (require.main === module) {
  main().then(() => {
    console.log('✅ Scenario 2 Completed.');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Scenario 2 Failed:', err);
    process.exit(1);
  });
}
