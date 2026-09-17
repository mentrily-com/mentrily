import { runBenchmark } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379 });

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:4000';
  const slug = 'stress-test-exam';

  console.log(`\n===============================================================`);
  console.log(`🔥 SCENARIO 6: FINAL EXAM SUBMISSION & CONCURRENT SCORING TEST`);
  console.log(`===============================================================`);

  const exam = await prisma.exam.findFirst({ where: { slug } });
  if (!exam) {
    throw new Error('Test exam not found. Run seed-load-data.ts first.');
  }

  // Create or reset 25 IN_PROGRESS sessions with answers
  const sessions: Array<{ id: string; studentNum: number }> = [];
  for (let i = 1; i <= 25; i++) {
    const user = await prisma.user.findFirst({
      where: { email: `student_${i}@stress-test.local` },
    });
    if (!user) continue;

    // Reset or create
    await prisma.examSession.deleteMany({
      where: { examId: exam.id, userId: user.id },
    });

    const session = await prisma.examSession.create({
      data: {
        examId: exam.id,
        userId: user.id,
        status: 'IN_PROGRESS',
        startTime: new Date(Date.now() - 3600 * 1000), // 1 hour ago
        answers: {
          q1: 'print(12)',
          q2: '200',
          q3: 'First Normal Form: atomic values',
        },
      },
    });

    // Record presence in Redis so assertLiveMonitoring passes
    await redis.set(`session:lastseen:${session.id}`, Date.now().toString(), 'EX', 300);

    sessions.push({ id: session.id, studentNum: i });
  }

  console.log(`✅ Prepared ${sessions.length} active exam sessions ready for submission.`);

  // Phase 1: 25 students submitting at the exact same instant (Concurrency 25)
  await runBenchmark({
    name: 'Final Submission Storm - 25 Concurrent Exam Submits',
    totalRequests: 25,
    concurrency: 25,
    requestFn: async (idx) => {
      const target = sessions[idx];
      const token = `test-load-token-student_${target.studentNum}`;

      // Refresh presence before submitting
      await redis.set(`session:lastseen:${target.id}`, Date.now().toString(), 'EX', 300);

      const res = await fetch(`${baseUrl}/api/submission/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: target.id,
          answers: {
            q1: 'print(12)',
            q2: '200',
            q3: 'First Normal Form',
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // Phase 2: Duplicate submission race test (testing idempotency under concurrent double-submit)
  await runBenchmark({
    name: 'Idempotency Double-Submit Test - 25 Duplicate Submissions',
    totalRequests: 25,
    concurrency: 25,
    requestFn: async (idx) => {
      const target = sessions[idx];
      const token = `test-load-token-student_${target.studentNum}`;

      const res = await fetch(`${baseUrl}/api/submission/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: target.id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  await prisma.$disconnect();
  redis.disconnect();
}

if (require.main === module) {
  main().then(() => {
    console.log('✅ Scenario 6 Completed.');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Scenario 6 Failed:', err);
    process.exit(1);
  });
}
