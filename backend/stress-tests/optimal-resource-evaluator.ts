import { runBenchmark, BenchmarkResult } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379 });
const baseUrl = process.env.API_URL || 'http://localhost:4000';
const examSlug = 'stress-test-exam';
const courseSlug = 'stress-test-course';
const totalStudentsInDb = 300;

interface TestReport {
  category: string;
  concurrency: number;
  requests: number;
  durationSec: number;
  rps: number;
  p50Ms: number;
  p99Ms: number;
  errorRate: string;
  verdict: 'OPTIMAL' | 'ACCEPTABLE' | 'DEGRADED' | 'FAILED';
}

const summaryReports: TestReport[] = [];

function recordReport(
  category: string,
  res: BenchmarkResult,
  targetP99: number = 2000,
) {
  const errCount = res.serverErrors5xx + res.networkErrors + res.clientErrors4xx;
  const errRate = ((errCount / res.totalRequests) * 100).toFixed(1) + '%';
  let verdict: 'OPTIMAL' | 'ACCEPTABLE' | 'DEGRADED' | 'FAILED' = 'OPTIMAL';

  if (res.serverErrors5xx > 0 || res.networkErrors > 0) {
    verdict = 'FAILED';
  } else if (errCount > 0) {
    verdict = 'FAILED';
  } else if (res.latencies.p99 > targetP99 * 1.5) {
    verdict = 'DEGRADED';
  } else if (res.latencies.p99 > targetP99) {
    verdict = 'ACCEPTABLE';
  }

  summaryReports.push({
    category,
    concurrency: res.concurrency,
    requests: res.totalRequests,
    durationSec: Number(res.durationSec.toFixed(2)),
    rps: Number(res.rps.toFixed(1)),
    p50Ms: Math.round(res.latencies.p50),
    p99Ms: Math.round(res.latencies.p99),
    errorRate: errRate,
    verdict,
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runEvaluator() {
  console.log('================================================================================');
  console.log('⚡ MENTRILY OPTIMAL RESOURCE CONSTRAINT EVALUATOR');
  console.log('   Iterative multi-tier stress benchmarks across all critical production paths');
  console.log('================================================================================\n');

  const exam = await prisma.exam.findFirst({ where: { slug: examSlug } });
  if (!exam) throw new Error('Test exam not found. Run seed script first.');

  const course = await prisma.course.findFirst({ where: { slug: courseSlug } });

  // ---------------------------------------------------------------------------
  // 1. AUTH & SESSION RESOLUTION (100 VUs & 250 VUs)
  // ---------------------------------------------------------------------------
  console.log('▶️  TEST 1/6: Authentication & Hot-Path Session Throughput');
  const auth100 = await runBenchmark({
    name: 'Auth Throughput [100 VUs]',
    totalRequests: 1000,
    concurrency: 100,
    requestFn: async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    },
  });
  recordReport('Auth (/api/auth/me)', auth100, 2500);
  await sleep(1500);

  const auth250 = await runBenchmark({
    name: 'Auth Throughput [250 VUs]',
    totalRequests: 2500,
    concurrency: 250,
    requestFn: async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    },
  });
  recordReport('Auth (/api/auth/me)', auth250, 4500);
  await sleep(1500);

  // ---------------------------------------------------------------------------
  // 2. EXAM ENTRY STORM (100 VUs & 200 VUs)
  // ---------------------------------------------------------------------------
  console.log('\n▶️  TEST 2/6: Exam Entry Storm ("9:00 AM Simultaneous Rush")');
  const cleanExamSessions = async () => {
    await prisma.examSession.deleteMany({
      where: {
        examId: exam.id,
        user: { email: { contains: 'stress-test.local' } },
      },
    });
  };

  await cleanExamSessions();
  await sleep(1000);

  const entry100 = await runBenchmark({
    name: 'Exam Entry [100 VUs]',
    totalRequests: 100,
    concurrency: 100,
    requestFn: async (idx) => {
      const studentNum = idx + 1;
      const token = `test-load-token-student_${studentNum}`;
      const deviceId = `device_opt_100_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/exam/${examSlug}/enter`, {
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
  recordReport('Exam Entry (/enter)', entry100, 2000);
  await sleep(1500);

  await cleanExamSessions();
  await sleep(1000);

  const entry200 = await runBenchmark({
    name: 'Exam Entry [200 VUs]',
    totalRequests: 200,
    concurrency: 200,
    requestFn: async (idx) => {
      const studentNum = idx + 1;
      const token = `test-load-token-student_${studentNum}`;
      const deviceId = `device_opt_200_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/exam/${examSlug}/enter`, {
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
  recordReport('Exam Entry (/enter)', entry200, 2500);
  await sleep(1500);

  // ---------------------------------------------------------------------------
  // 3. HIGH-FREQUENCY ANSWER AUTOSAVE (100 VUs & 250 VUs)
  // ---------------------------------------------------------------------------
  console.log('\n▶️  TEST 3/6: High-Frequency Answer Autosaving');
  // Query the genuine active sessions created in Test 2
  const activeSessions = await prisma.examSession.findMany({
    where: { examId: exam.id, status: 'IN_PROGRESS' },
    select: { id: true, userId: true },
  });

  // Map each session to its student number
  const users = await prisma.user.findMany({
    where: { email: { contains: 'stress-test.local' } },
    select: { id: true, email: true },
  });
  const userIdToStudentNum: Record<string, number> = {};
  for (const u of users) {
    const match = u.email.match(/student_(\d+)@/);
    if (match) {
      userIdToStudentNum[u.id] = parseInt(match[1], 10);
    }
  }

  const validSessions: Array<{ id: string; studentNum: number }> = [];
  for (const s of activeSessions) {
    const sNum = userIdToStudentNum[s.userId];
    if (sNum) {
      validSessions.push({ id: s.id, studentNum: sNum });
    }
  }

  console.log(`   Discovered ${validSessions.length} active student sessions for autosave test.`);

  const autosave100 = await runBenchmark({
    name: 'Answer Autosave [100 VUs]',
    totalRequests: 1000,
    concurrency: 100,
    requestFn: async (idx) => {
      const target = validSessions[idx % Math.min(100, validSessions.length)];
      const token = `test-load-token-student_${target.studentNum}`;
      const res = await fetch(`${baseUrl}/api/submission/save-answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: target.id,
          answer: { [`q_${idx % 3}`]: `Answer payload from student ${target.studentNum} rev ${idx}` },
        }),
      });
      return { status: res.status, ok: res.ok };
    },
  });
  recordReport('Autosave (/save-answer)', autosave100, 500);
  await sleep(1500);

  const autosave250 = await runBenchmark({
    name: 'Answer Autosave [250 VUs]',
    totalRequests: 2500,
    concurrency: 200,
    requestFn: async (idx) => {
      const target = validSessions[idx % validSessions.length];
      const token = `test-load-token-student_${target.studentNum}`;
      const res = await fetch(`${baseUrl}/api/submission/save-answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: target.id,
          answer: { [`q_${idx % 3}`]: `Answer payload from student ${target.studentNum} rev ${idx}` },
        }),
      });
      return { status: res.status, ok: res.ok };
    },
  });
  recordReport('Autosave (/save-answer)', autosave250, 1000);
  await sleep(1500);

  // ---------------------------------------------------------------------------
  // 4. CONCURRENT CODE EXECUTION (15 VUs & 25 VUs)
  // ---------------------------------------------------------------------------
  console.log('\n▶️  TEST 4/6: Parallel Sandbox Code Execution');
  try {
    await fetch(`${baseUrl}/api/code/run`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-load-token-student_1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', code: 'print("warmup")' }),
    });
  } catch {}
  await sleep(500);

  const code15 = await runBenchmark({
    name: 'Code Execution [15 VUs]',
    totalRequests: 15,
    concurrency: 15,
    requestFn: async (idx) => {
      const studentNum = (idx % 15) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/code/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'python',
          code: `print(f"Eval output {${idx} * 100}")`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });
  recordReport('Code Exec (/code/run)', code15, 3000);
  await sleep(1500);

  const code25 = await runBenchmark({
    name: 'Code Execution [25 VUs]',
    totalRequests: 25,
    concurrency: 25,
    requestFn: async (idx) => {
      const studentNum = (idx % 25) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/code/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'python',
          code: `print(f"Eval output {${idx} * 200}")`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });
  recordReport('Code Exec (/code/run)', code25, 4000);
  await sleep(1500);

  // ---------------------------------------------------------------------------
  // 5. CONCURRENT COURSE UPDATE (15 VUs)
  // ---------------------------------------------------------------------------
  if (course) {
    console.log('\n▶️  TEST 5/6: Concurrent Course Saves & Transaction Isolation');
    const course15 = await runBenchmark({
      name: 'Course Save [15 VUs]',
      totalRequests: 15,
      concurrency: 15,
      requestFn: async (idx) => {
        const token = 'test-load-token-teacher_1';
        const res = await fetch(`${baseUrl}/api/teacher/courses/${course.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `Optimized Course - Save ${idx}`,
            sections: [
              {
                title: `Module Alpha - Worker ${idx}`,
                questions: [
                  {
                    title: `Unit Item - ${idx}`,
                    type: 'LESSON',
                    content: { text: `Content item ${idx}` },
                  },
                ],
              },
            ],
          }),
        });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, ok: res.ok, body: data };
      },
    });
    recordReport('Course Save (/courses/:id)', course15, 1000);
    await sleep(1500);
  }

  // ---------------------------------------------------------------------------
  // 6. FINAL DEADLINE SUBMISSION (50 VUs)
  // ---------------------------------------------------------------------------
  console.log('\n▶️  TEST 6/6: Final Exam Submission Rush (50 Simultaneous Submissions)');
  for (let i = 0; i < Math.min(50, validSessions.length); i++) {
    await redis.set(`session:lastseen:${validSessions[i].id}`, Date.now().toString(), 'EX', 300);
  }

  const submit50 = await runBenchmark({
    name: 'Final Submission [50 VUs]',
    totalRequests: 50,
    concurrency: 50,
    requestFn: async (idx) => {
      const target = validSessions[idx % Math.min(50, validSessions.length)];
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
  recordReport('Final Submit (/submit)', submit50, 1000);

  // ---------------------------------------------------------------------------
  // SUMMARY SCORECARD
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('🏆 OPTIMAL RESOURCE CONSTRAINT SCORECARD');
  console.log('================================================================================');
  console.log(
    'Service / Target                     | VUs | Reqs | Duration | Throughput  | P50 Latency | P99 Latency | Errors | Verdict',
  );
  console.log(
    '-------------------------------------|-----|------|----------|-------------|-------------|-------------|--------|----------',
  );

  for (const s of summaryReports) {
    const cat = s.category.padEnd(36);
    const vu = String(s.concurrency).padStart(3);
    const req = String(s.requests).padStart(4);
    const dur = (s.durationSec.toFixed(1) + 's').padStart(8);
    const rps = (s.rps.toFixed(1) + ' rps').padStart(11);
    const p50 = (s.p50Ms + ' ms').padStart(11);
    const p99 = (s.p99Ms + ' ms').padStart(11);
    const err = s.errorRate.padStart(6);
    const v = s.verdict === 'OPTIMAL' ? '✅ OPTIMAL' : s.verdict === 'ACCEPTABLE' ? '🟢 ACCEPTABLE' : s.verdict === 'DEGRADED' ? '⚠️ DEGRADED' : '❌ FAILED';
    console.log(`${cat} | ${vu} | ${req} | ${dur} | ${rps} | ${p50} | ${p99} | ${err} | ${v}`);
  }
  console.log('================================================================================\n');

  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

runEvaluator().catch((err) => {
  console.error('Fatal error in evaluator:', err);
  process.exit(1);
});
