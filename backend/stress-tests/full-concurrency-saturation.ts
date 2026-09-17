import { runBenchmark, BenchmarkResult } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = process.env.API_URL || 'http://localhost:4000';
const totalStudentsInDb = 300;

interface StepTier {
  concurrency: number;
  totalRequests: number;
}

interface ServiceSummary {
  service: string;
  maxHealthyConcurrency: number;
  peakRps: number;
  p50AtPeak: number;
  p99AtPeak: number;
  verdict: string;
}

const summaryTable: ServiceSummary[] = [];

async function stepService(
  serviceName: string,
  tiers: StepTier[],
  requestFnGenerator: (concurrency: number) => (idx: number) => Promise<{ status: number; ok: boolean; body?: any; error?: string }>,
  preStepHook?: (concurrency: number) => Promise<void>,
) {
  console.log(`\n================================================================================`);
  console.log(`🔥 HIGH-CONCURRENCY SATURATION SEARCH: ${serviceName}`);
  console.log(`================================================================================`);

  let maxHealthy = 0;
  let peakRps = 0;
  let p50Peak = 0;
  let p99Peak = 0;
  let overallVerdict = '✅ HOLDS';

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    console.log(`\n▶️  STEP ${i + 1}/${tiers.length}: Concurrency = ${tier.concurrency} VUs (${tier.totalRequests} reqs)...`);

    if (preStepHook) {
      await preStepHook(tier.concurrency);
    }

    const result = await runBenchmark({
      name: `${serviceName} [${tier.concurrency} VUs]`,
      totalRequests: tier.totalRequests,
      concurrency: tier.concurrency,
      requestFn: requestFnGenerator(tier.concurrency),
    });

    const isBroken = result.serverErrors5xx > 0 || result.networkErrors > 0 || result.rateLimited429 > 0 || result.latencies.p99 >= 3000;
    const isDegraded = result.latencies.p99 >= 1500 || result.latencies.p50 >= 800;

    if (!isBroken) {
      maxHealthy = tier.concurrency;
      if (result.rps > peakRps) {
        peakRps = result.rps;
        p50Peak = result.latencies.p50;
        p99Peak = result.latencies.p99;
      }
    }

    if (isBroken) {
      overallVerdict = `❌ BROKE at ${tier.concurrency} VUs`;
      console.log(`\n🚨 BREAKPOINT HIT at ${tier.concurrency} Concurrency! (P99: ${result.latencies.p99.toFixed(0)}ms, 5xx: ${result.serverErrors5xx})`);
      break;
    } else if (isDegraded) {
      overallVerdict = `⚠️ DEGRADED at ${tier.concurrency} VUs`;
      console.log(`\n⚠️  DEGRADATION WARNING at ${tier.concurrency} Concurrency (P50: ${result.latencies.p50.toFixed(0)}ms, P99: ${result.latencies.p99.toFixed(0)}ms)`);
    } else {
      console.log(`\n🟢 ${tier.concurrency} CONCURRENCY PASSED CLEANLY (RPS: ${result.rps.toFixed(1)}, P50: ${result.latencies.p50.toFixed(0)}ms)`);
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  summaryTable.push({
    service: serviceName,
    maxHealthyConcurrency: maxHealthy,
    peakRps,
    p50AtPeak: p50Peak,
    p99AtPeak: p99Peak,
    verdict: overallVerdict,
  });
}

async function runAllSaturationTests() {
  console.log('================================================================================');
  console.log('🚀 COMPREHENSIVE HIGH-CONCURRENCY SATURATION BENCHMARK SUITE');
  console.log('================================================================================\n');

  // Verify / upsert admin test user
  const org = await prisma.organization.findFirst({ where: { slug: 'sudip-adhikari-s-school' } });
  if (org) {
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin_1@stress-test.local' },
      update: { role: 'ADMIN', orgId: org.id, isActive: true },
      create: {
        clerkId: 'load_test_admin_1',
        email: 'admin_1@stress-test.local',
        name: 'Stress Test Admin 1',
        role: 'ADMIN',
        orgId: org.id,
        isActive: true,
      },
    });
    await prisma.orgMembership.upsert({
      where: { userId_orgId: { userId: adminUser.id, orgId: org.id } },
      update: { role: 'ADMIN', status: 'ACTIVE' },
      create: { userId: adminUser.id, orgId: org.id, role: 'ADMIN', status: 'ACTIVE' },
    });
  }

  const exam = await prisma.exam.findFirst({ where: { slug: 'stress-test-exam' } });
  if (!exam) throw new Error('Exam stress-test-exam not found.');

  const teacherToken = 'test-load-token-teacher_1';
  const adminToken = 'test-load-token-admin_1';

  // 1. Auth & Session Resolution (/api/auth/me)
  await stepService(
    'Auth Session Resolution (/api/auth/me)',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 2000 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 2. Course Catalog Browse (/api/student/courses/browse)
  await stepService(
    'Course Catalog Browse (/api/student/courses/browse)',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 2000 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/student/courses/browse`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 3. Teacher Stats (/api/teacher/stats)
  await stepService(
    'Teacher Dashboard Stats (/api/teacher/stats)',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 1500 },
    ],
    () => async () => {
      const res = await fetch(`${baseUrl}/api/teacher/stats`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 4. Live Exam Proctoring Monitor (/api/teacher/exams/:id/monitored)
  await stepService(
    'Teacher Exam Proctoring Monitor (/api/teacher/exams/:id/monitored)',
    [
      { concurrency: 50, totalRequests: 200 },
      { concurrency: 100, totalRequests: 400 },
      { concurrency: 200, totalRequests: 600 },
    ],
    () => async () => {
      const res = await fetch(`${baseUrl}/api/teacher/exams/${exam.id}/monitored`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 5. Teacher Courses Listing (/api/teacher/courses)
  await stepService(
    'Teacher Courses Listing (/api/teacher/courses)',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 1500 },
    ],
    () => async () => {
      const res = await fetch(`${baseUrl}/api/teacher/courses`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 6. Student Announcements Unified Pipeline (/api/student/announcements)
  await stepService(
    'Student Announcements Pipeline (/api/student/announcements)',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 2000 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/student/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 7. Student Bookmarks Unified Pipeline (/api/student/bookmarks)
  await stepService(
    'Student Bookmarks Pipeline (/api/student/bookmarks)',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 2000 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/student/bookmarks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 8. Negative Exam Slug Probe (/api/exam/:slug/check)
  await stepService(
    'Negative 404 Cache Exam Slug (/api/exam/:slug/check)',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 2000 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/exam/probe-non-existent-exam-slug/check?json=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.status === 404 };
    },
  );

  // 9. Admin Storage Leaderboard (/api/admin/storage/users)
  await stepService(
    'Admin Storage Leaderboard (/api/admin/storage/users)',
    [
      { concurrency: 50, totalRequests: 200 },
      { concurrency: 100, totalRequests: 400 },
      { concurrency: 250, totalRequests: 750 },
    ],
    () => async () => {
      const res = await fetch(`${baseUrl}/api/admin/storage/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 10. Deterministic Code Execution (/api/code/run)
  await stepService(
    'Deterministic Code Execution (/api/code/run)',
    [
      { concurrency: 25, totalRequests: 50 },
      { concurrency: 50, totalRequests: 100 },
      { concurrency: 100, totalRequests: 200 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/code/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language: 'python',
          code: 'print("high concurrency test")',
          input: '',
        }),
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // 11. Answer Autosave Rush (/api/submission/save-answer)
  const existingSessions = await prisma.examSession.findMany({
    where: { examId: exam.id, status: 'IN_PROGRESS' },
    select: { id: true },
  });

  if (existingSessions.length > 0) {
    await stepService(
      'Answer Autosave Coalesced Queue (/api/submission/save-answer)',
      [
        { concurrency: 100, totalRequests: 500 },
        { concurrency: 250, totalRequests: 1000 },
        { concurrency: 500, totalRequests: 2000 },
      ],
      () => async (idx) => {
        const target = existingSessions[idx % existingSessions.length];
        const studentNum = (idx % totalStudentsInDb) + 1;
        const token = `test-load-token-student_${studentNum}`;
        const questionId = `q${(idx % 3) + 1}`;

        const res = await fetch(`${baseUrl}/api/submission/save-answer`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: target.id,
            answer: { [questionId]: `Concurrency answer text ${idx}` },
          }),
        });
        return { status: res.status, ok: res.ok };
      },
    );
  }

  // 12. Exam Entry Simultaneous Storm (POST /api/exam/:slug/enter)
  await stepService(
    'Exam Entry Simultaneous Storm (POST /api/exam/:slug/enter)',
    [
      { concurrency: 50, totalRequests: 50 },
      { concurrency: 100, totalRequests: 100 },
      { concurrency: 200, totalRequests: 200 },
      { concurrency: 300, totalRequests: 300 },
    ],
    () => async (idx) => {
      const studentNum = idx + 1;
      const token = `test-load-token-student_${studentNum}`;
      const deviceId = `device_storm_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/exam/stress-test-exam/enter`, {
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
      return { status: res.status, ok: res.ok };
    },
    async () => {
      await prisma.examSession.deleteMany({
        where: {
          examId: exam.id,
          user: { email: { contains: 'stress-test.local' } },
        },
      });
    },
  );

  // Print final scorecard
  console.log(`\n====================================================================================================`);
  console.log(`🏆 MAXIMUM CONCURRENCY & CAPACITY SCORECARD ACROSS ALL FIXED SERVICES`);
  console.log(`====================================================================================================`);
  console.log(`Service Name                                                | Max Concurrency | Peak RPS    | P50 Latency | P99 Latency | Verdict`);
  console.log(`------------------------------------------------------------|-----------------|-------------|-------------|-------------|---------------------`);

  for (const row of summaryTable) {
    const sStr = row.service.padEnd(59);
    const cStr = `${row.maxHealthyConcurrency} VUs`.padEnd(15);
    const rpsStr = `${row.peakRps.toFixed(1)} req/s`.padEnd(11);
    const p50Str = `${row.p50AtPeak.toFixed(0)} ms`.padEnd(11);
    const p99Str = `${row.p99AtPeak.toFixed(0)} ms`.padEnd(11);
    console.log(`${sStr} | ${cStr} | ${rpsStr} | ${p50Str} | ${p99Str} | ${row.verdict}`);
  }
  console.log(`====================================================================================================\n`);

  await prisma.$disconnect();
}

runAllSaturationTests().catch((e) => {
  console.error('Fatal error in saturation suite:', e);
  process.exit(1);
});
