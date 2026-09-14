import { runBenchmark, BenchmarkResult } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6379 });
const baseUrl = process.env.API_URL || 'http://localhost:4000';
const slug = 'stress-test-exam';
const totalStudentsInDb = 300;

interface StepTier {
  concurrency: number;
  totalRequests: number;
}

interface StepEvaluation {
  tier: StepTier;
  result: BenchmarkResult;
  status: 'HEALTHY' | 'DEGRADED' | 'BROKEN';
  reason?: string;
}

async function runStepUpTest(
  serviceName: string,
  tiers: StepTier[],
  requestGenerator: (concurrency: number) => (idx: number) => Promise<{ status: number; ok: boolean; body?: any; error?: string }>,
  preStepHook?: (concurrency: number) => Promise<void>,
): Promise<StepEvaluation[]> {
  console.log(`\n================================================================================`);
  console.log(`🔍 STEP-UP BREAKPOINT SEARCH: ${serviceName}`);
  console.log(`   Ramping concurrency until heavy latency degradation or errors are logged`);
  console.log(`================================================================================\n`);

  const history: StepEvaluation[] = [];

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    console.log(`\n▶️  TIER ${i + 1}/${tiers.length}: Concurrency = ${tier.concurrency} VUs (${tier.totalRequests} total requests)...`);

    if (preStepHook) {
      await preStepHook(tier.concurrency);
    }

    const result = await runBenchmark({
      name: `${serviceName} [Concurrency: ${tier.concurrency}]`,
      totalRequests: tier.totalRequests,
      concurrency: tier.concurrency,
      requestFn: requestGenerator(tier.concurrency),
    });

    // Evaluate breaking conditions
    let status: 'HEALTHY' | 'DEGRADED' | 'BROKEN' = 'HEALTHY';
    let reason = '';

    if (result.serverErrors5xx > 0 || result.networkErrors > 0) {
      status = 'BROKEN';
      reason = `Server crashes / network errors detected (${result.serverErrors5xx} 5xx errors, ${result.networkErrors} network errors).`;
    } else if (result.rateLimited429 > 0) {
      status = 'BROKEN';
      reason = `Rate-limiting triggered (${result.rateLimited429} 429 Too Many Requests).`;
    } else if (result.latencies.p99 >= 3000) {
      status = 'BROKEN';
      reason = `Critical latency collapse: P99 reached ${result.latencies.p99}ms (exceeds 3,000ms threshold).`;
    } else if (result.latencies.p99 >= 1500 || result.latencies.p50 >= 800) {
      status = 'DEGRADED';
      reason = `Heavy latency loss detected: P50=${result.latencies.p50}ms, P99=${result.latencies.p99}ms.`;
    }

    const evalRecord: StepEvaluation = { tier, result, status, reason };
    history.push(evalRecord);

    if (status === 'BROKEN') {
      console.log(`\n🚨 BREAKPOINT TRIGGERED AT CONCURRENCY ${tier.concurrency}!`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Stopping further scale-up for this service to avoid server crash.\n`);
      break;
    } else if (status === 'DEGRADED') {
      console.log(`\n⚠️  DEGRADATION WARNING AT CONCURRENCY ${tier.concurrency}`);
      console.log(`   ${reason}`);
      console.log(`   Continuing to next tier to probe maximum breaking point...\n`);
    } else {
      console.log(`\n🟢 TIER ${tier.concurrency} PASSED CLEANLY (P50: ${result.latencies.p50}ms, Error: 0%)`);
      console.log(`   Scaling up concurrency...\n`);
    }

    // Cooldown pause between tiers
    await new Promise((r) => setTimeout(r, 1000));
  }

  printSummaryTable(serviceName, history);
  return history;
}

function printSummaryTable(serviceName: string, history: StepEvaluation[]) {
  console.log(`\n================================================================================`);
  console.log(`📋 STEP-UP BREAKPOINT SUMMARY: ${serviceName}`);
  console.log(`================================================================================`);
  console.log(`Concurrency | Requests | RPS       | P50 Latency | P99 Latency | Error Rate | Verdict`);
  console.log(`------------|----------|-----------|-------------|-------------|------------|---------------------`);

  for (const h of history) {
    const r = h.result;
    const errRate = (((r.totalRequests - r.successful) / r.totalRequests) * 100).toFixed(1) + '%';
    const cStr = String(r.concurrency).padEnd(11);
    const qStr = String(r.totalRequests).padEnd(8);
    const rpsStr = (r.rps.toFixed(1) + ' req/s').padEnd(9);
    const p50Str = (r.latencies.p50.toFixed(0) + ' ms').padEnd(11);
    const p99Str = (r.latencies.p99.toFixed(0) + ' ms').padEnd(11);
    const errStr = errRate.padEnd(10);
    const verdict = h.status === 'HEALTHY' ? '✅ HOLDS' : h.status === 'DEGRADED' ? '⚠️ DEGRADED' : '❌ BROKE';
    console.log(`${cStr} | ${qStr} | ${rpsStr} | ${p50Str} | ${p99Str} | ${errStr} | ${verdict}`);
  }
  console.log(`================================================================================\n`);
}

async function main() {
  const exam = await prisma.exam.findFirst({ where: { slug } });
  if (!exam) throw new Error('Exam not found. Seed first.');

  // =========================================================================
  // 1. AUTH & SESSION RESOLUTION STEPPING (50 -> 100 -> 250 -> 500)
  // =========================================================================
  const authTiers: StepTier[] = [
    { concurrency: 50, totalRequests: 500 },
    { concurrency: 100, totalRequests: 1000 },
    { concurrency: 250, totalRequests: 2500 },
    { concurrency: 500, totalRequests: 4000 },
  ];

  await runStepUpTest(
    'Auth & Session Throughput (/api/auth/me)',
    authTiers,
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // =========================================================================
  // 2. EXAM ENTRY STORM STEPPING (25 -> 50 -> 100 -> 150 -> 200)
  // =========================================================================
  const examEntryTiers: StepTier[] = [
    { concurrency: 25, totalRequests: 25 },
    { concurrency: 50, totalRequests: 50 },
    { concurrency: 100, totalRequests: 100 },
    { concurrency: 150, totalRequests: 150 },
    { concurrency: 200, totalRequests: 200 },
  ];

  await runStepUpTest(
    'Exam Entry Storm (POST /api/exam/:slug/enter)',
    examEntryTiers,
    () => async (idx) => {
      const studentNum = idx + 1;
      const token = `test-load-token-student_${studentNum}`;
      const deviceId = `device_step_${studentNum}`;
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
    // Reset sessions before each tier so every tier tests true simultaneous creation
    async () => {
      await prisma.examSession.deleteMany({
        where: {
          examId: exam.id,
          user: { email: { contains: 'stress-test.local' } },
        },
      });
    },
  );

  // =========================================================================
  // 3. ANSWER AUTOSAVE RUSH STEPPING (50 -> 100 -> 200 -> 300)
  // =========================================================================
  // Ensure sessions exist
  const existingSessions = await prisma.examSession.findMany({
    where: { examId: exam.id, status: 'IN_PROGRESS' },
    select: { id: true, userId: true },
  });

  if (existingSessions.length < 200) {
    console.log('Seeding exam sessions for autosave test...');
    for (let i = 1; i <= 200; i++) {
      const user = await prisma.user.findFirst({ where: { email: `student_${i}@stress-test.local` } });
      if (!user) continue;
      await prisma.examSession.upsert({
        where: { id: `step-session-${i}` },
        update: { status: 'IN_PROGRESS' },
        create: {
          id: `step-session-${i}`,
          examId: exam.id,
          userId: user.id,
          status: 'IN_PROGRESS',
          startTime: new Date(),
        },
      });
    }
  }

  const autosaveSessions = await prisma.examSession.findMany({
    where: { examId: exam.id, status: 'IN_PROGRESS' },
    select: { id: true },
  });

  const autosaveTiers: StepTier[] = [
    { concurrency: 50, totalRequests: 500 },
    { concurrency: 100, totalRequests: 1000 },
    { concurrency: 200, totalRequests: 2000 },
    { concurrency: 300, totalRequests: 3000 },
  ];

  await runStepUpTest(
    'Answer Autosave (/api/submission/save-answer)',
    autosaveTiers,
    () => async (idx) => {
      const target = autosaveSessions[idx % autosaveSessions.length];
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
          answer: { [questionId]: `Answer text rev ${idx}` },
        }),
      });
      return { status: res.status, ok: res.ok };
    },
  );

  // =========================================================================
  // 4. CODE EXECUTION STEPPING (5 -> 15 -> 25 -> 40 -> 60)
  // =========================================================================
  const codeTiers: StepTier[] = [
    { concurrency: 5, totalRequests: 5 },
    { concurrency: 15, totalRequests: 15 },
    { concurrency: 25, totalRequests: 25 },
    { concurrency: 40, totalRequests: 40 },
    { concurrency: 60, totalRequests: 60 },
  ];

  await runStepUpTest(
    'Code Execution Queue (/api/code/run)',
    codeTiers,
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/code/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'python',
          code: `print("Step-up execution ${idx}")`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  );

  await prisma.$disconnect();
  redis.disconnect();
  console.log('\n🏁 ALL STEP-UP BREAKPOINT SEARCHES COMPLETE.');
}

main().catch((err) => {
  console.error('Fatal error in breakpoint finder:', err);
  process.exit(1);
});
