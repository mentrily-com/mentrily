import { runBenchmark } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379 });

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:4000';
  const slug = 'stress-test-exam';
  const studentCount = 200;

  console.log(`\n======================================================================`);
  console.log(`🚀 STARTING HIGH-CONCURRENCY STRESS TEST (UP TO 400 CONCURRENT USERS)`);
  console.log(`======================================================================\n`);

  const exam = await prisma.exam.findFirst({ where: { slug } });
  if (!exam) {
    throw new Error('Test exam not found. Seed first.');
  }

  // -------------------------------------------------------------------------
  // TEST 1: AUTH SATURATION AT 200 & 400 CONCURRENCY
  // -------------------------------------------------------------------------
  console.log(`>>> SECTION 1: AUTHENTICATION & SESSION RESOLUTION UNDER MASSIVE LOAD`);

  await runBenchmark({
    name: 'Auth Saturation - 200 Concurrent Users (2,000 Requests)',
    totalRequests: 2000,
    concurrency: 200,
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

  await runBenchmark({
    name: 'Auth Peak Saturation - 400 Concurrent Users (4,000 Requests)',
    totalRequests: 4000,
    concurrency: 400,
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

  // -------------------------------------------------------------------------
  // TEST 2: EXAM ENTRY STORM AT 100 & 200 CONCURRENT STUDENTS
  // -------------------------------------------------------------------------
  console.log(`>>> SECTION 2: EXAM ENTRY STORM ("UNIVERSITY EXAM HALL RUSH")`);

  // Clean previous sessions
  await prisma.examSession.deleteMany({
    where: {
      examId: exam.id,
      user: { email: { contains: 'stress-test.local' } },
    },
  });
  console.log(`🧹 Cleaned up old test sessions for clean entry.`);

  // 100 students simultaneous entry
  await runBenchmark({
    name: 'Exam Entry Storm - 100 Simultaneous Students Entering Exam',
    totalRequests: 100,
    concurrency: 100,
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

  // Clean again for 200 students
  await prisma.examSession.deleteMany({
    where: {
      examId: exam.id,
      user: { email: { contains: 'stress-test.local' } },
    },
  });

  // 200 students simultaneous entry
  await runBenchmark({
    name: 'Exam Entry Storm - 200 Simultaneous Students Entering Exam',
    totalRequests: 200,
    concurrency: 200,
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

  // -------------------------------------------------------------------------
  // TEST 3: ANSWER AUTOSAVE RUSH AT 200 CONCURRENCY (2,000 SAVES)
  // -------------------------------------------------------------------------
  console.log(`>>> SECTION 3: ANSWER AUTOSAVE RUSH (2,000 SAVES ACROSS 200 STUDENTS)`);

  const activeSessions = await prisma.examSession.findMany({
    where: { examId: exam.id, status: 'IN_PROGRESS' },
    select: { id: true, userId: true },
  });

  console.log(`✅ Found ${activeSessions.length} active sessions ready for high-volume autosave.`);

  if (activeSessions.length > 0) {
    await runBenchmark({
      name: 'High-Scale Answer Autosave - 2,000 Saves (Concurrency 200)',
      totalRequests: 2000,
      concurrency: 200,
      requestFn: async (idx) => {
        const target = activeSessions[idx % activeSessions.length];
        const studentNum = (idx % studentCount) + 1;
        const token = `test-load-token-student_${studentNum}`;
        const questionId = `q${(idx % 3) + 1}`;
        const answerValue = `Student answer rev ${idx} for ${questionId}`;

        const res = await fetch(`${baseUrl}/api/submission/save-answer`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: target.id,
            answer: { [questionId]: answerValue },
          }),
        });

        return { status: res.status, ok: res.ok };
      },
    });
  }

  // -------------------------------------------------------------------------
  // TEST 4: CODE EXECUTION SATURATION (35 CONCURRENT SUBMISSIONS)
  // -------------------------------------------------------------------------
  console.log(`>>> SECTION 4: CODE EXECUTION QUEUE SATURATION`);

  await runBenchmark({
    name: 'Code Execution Saturation - 35 Concurrent Submissions',
    totalRequests: 35,
    concurrency: 35,
    requestFn: async (idx) => {
      const studentNum = (idx % studentCount) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/code/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'python',
          code: `print("High load job ${idx}")`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // -------------------------------------------------------------------------
  // TEST 5: FINAL EXAM SUBMISSION RUSH (100 CONCURRENT SUBMITS)
  // -------------------------------------------------------------------------
  console.log(`>>> SECTION 5: FINAL EXAM SUBMISSION RUSH (100 CONCURRENT SUBMITS)`);

  const sessionsToSubmit = activeSessions.slice(0, 100);
  for (const s of sessionsToSubmit) {
    await redis.set(`session:lastseen:${s.id}`, Date.now().toString(), 'EX', 300);
  }

  await runBenchmark({
    name: 'Final Submission Storm - 100 Simultaneous Exam Submissions',
    totalRequests: sessionsToSubmit.length,
    concurrency: sessionsToSubmit.length,
    requestFn: async (idx) => {
      const target = sessionsToSubmit[idx];
      const studentNum = idx + 1;
      const token = `test-load-token-student_${studentNum}`;

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

  await prisma.$disconnect();
  redis.disconnect();
  console.log(`\n🏁 HIGH-CONCURRENCY STRESS TEST SUITE FINISHED SUCCESSFULLY.`);
}

main().catch((err) => {
  console.error('Fatal failure in high-concurrency suite:', err);
  process.exit(1);
});
