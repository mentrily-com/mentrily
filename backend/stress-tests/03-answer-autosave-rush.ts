import { runBenchmark } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:4000';
  const slug = 'stress-test-exam';

  console.log(`\n===============================================================`);
  console.log(`🔥 SCENARIO 3: HIGH-FREQUENCY ANSWER AUTOSAVE & REDIS COALESCING`);
  console.log(`===============================================================`);

  // Ensure active sessions exist for test students
  const exam = await prisma.exam.findFirst({ where: { slug } });
  if (!exam) {
    throw new Error('Test exam not found. Run seed-load-data.ts first.');
  }

  const sessions: Array<{ id: string; studentNum: number }> = [];
  for (let i = 1; i <= 50; i++) {
    const user = await prisma.user.findFirst({
      where: { email: `student_${i}@stress-test.local` },
    });
    if (!user) continue;

    let session = await prisma.examSession.findFirst({
      where: { examId: exam.id, userId: user.id, status: 'IN_PROGRESS' },
    });

    if (!session) {
      session = await prisma.examSession.create({
        data: {
          examId: exam.id,
          userId: user.id,
          status: 'IN_PROGRESS',
          startTime: new Date(),
        },
      });
    }
    sessions.push({ id: session.id, studentNum: i });
  }

  console.log(`✅ Loaded ${sessions.length} active exam sessions for autosave test.`);

  // Phase 1: 500 rapid answer saves (concurrency 50)
  await runBenchmark({
    name: 'Answer Autosave Rush - 500 Saves Across 50 Students (Concurrency 50)',
    totalRequests: 500,
    concurrency: 50,
    requestFn: async (idx) => {
      const target = sessions[idx % sessions.length];
      const token = `test-load-token-student_${target.studentNum}`;
      const questionId = `q${(idx % 3) + 1}`;
      const answerValue = `Student ${target.studentNum} answer for ${questionId} rev ${idx}`;

      const res = await fetch(`${baseUrl}/api/submission/save-answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: target.id,
          answer: {
            [questionId]: answerValue,
          },
        }),
      });

      return { status: res.status, ok: res.ok };
    },
  });

  // Phase 2: Section submission storm (100 requests across 50 students)
  await runBenchmark({
    name: 'Section Submission Storm - 100 Section Submits (Concurrency 25)',
    totalRequests: 100,
    concurrency: 25,
    requestFn: async (idx) => {
      const target = sessions[idx % sessions.length];
      const token = `test-load-token-student_${target.studentNum}`;

      const res = await fetch(`${baseUrl}/api/submission/section`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: target.id,
          sectionId: 'section-1',
          answers: {
            q1: 'print(5 + 7)',
            q2: '200',
          },
        }),
      });

      return { status: res.status, ok: res.ok };
    },
  });

  await prisma.$disconnect();
}

if (require.main === module) {
  main().then(() => {
    console.log('✅ Scenario 3 Completed.');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Scenario 3 Failed:', err);
    process.exit(1);
  });
}
