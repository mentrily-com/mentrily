import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import { Agent, setGlobalDispatcher } from 'undici';

// High-capacity undici dispatcher
setGlobalDispatcher(
  new Agent({
    connections: null,
    pipelining: 1,
    headersTimeout: 60000,
    bodyTimeout: 60000,
  }),
);

const prisma = new PrismaClient();
const baseUrl = process.env.API_URL || 'http://localhost:4000';
const totalStudentsInDb = 500;

export interface StepTier {
  concurrency: number;
  totalRequests: number;
}

export interface TierResult {
  concurrency: number;
  totalRequests: number;
  durationSec: number;
  rps: number;
  successful: number;
  serverErrors5xx: number;
  clientErrors4xx: number;
  networkErrors: number;
  latencies: {
    min: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
  };
  status: 'HEALTHY' | 'DEGRADED' | 'BROKEN';
  limitingFactor?: string;
}

export interface ServiceBreakpointReport {
  service: string;
  category: 'Cache-Shielded Read' | 'Stateful Write / Lock' | 'Session / Auth' | 'Queue / Worker';
  maxHealthyVUs: number;
  degradationVUs: number | null;
  breakingPointVUs: number;
  peakRps: number;
  p50AtPeak: number;
  p99AtPeak: number;
  primaryLimitingFactor: string;
  tierResults: TierResult[];
}

const finalReports: ServiceBreakpointReport[] = [];

async function warmupEndpoint(
  name: string,
  requestFn: (idx: number) => Promise<{ status: number; ok: boolean; error?: string }>,
) {
  process.stdout.write(`   🔥 Warming up connections for ${name}... `);
  const promises: Promise<any>[] = [];
  for (let i = 0; i < 30; i++) {
    promises.push(requestFn(i).catch(() => ({})));
  }
  await Promise.all(promises);
  await new Promise((r) => setTimeout(r, 600));
  console.log('Ready.');
}

async function runTierBenchmark(
  name: string,
  tier: StepTier,
  requestFn: (index: number) => Promise<{ status: number; ok: boolean; error?: string }>,
): Promise<TierResult> {
  const { concurrency, totalRequests } = tier;
  const latencies: number[] = [];
  let successful = 0;
  let serverErrors5xx = 0;
  let clientErrors4xx = 0;
  let networkErrors = 0;
  let requestIndex = 0;

  const startTime = performance.now();

  async function worker() {
    while (true) {
      const idx = requestIndex++;
      if (idx >= totalRequests) break;

      const reqStart = performance.now();
      try {
        const res = await requestFn(idx);
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);

        if (res.status >= 200 && res.status < 300) {
          successful++;
        } else if (res.status === 404 && name.includes('Negative 404')) {
          successful++;
        } else if (res.status >= 500) {
          serverErrors5xx++;
        } else if (res.status >= 400) {
          clientErrors4xx++;
        } else {
          clientErrors4xx++;
        }
      } catch (err: any) {
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        networkErrors++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker());
  await Promise.all(workers);

  const endTime = performance.now();
  const durationSec = Math.max(0.001, (endTime - startTime) / 1000);
  const rps = totalRequests / durationSec;

  latencies.sort((a, b) => a - b);
  const getPercentile = (p: number) => {
    if (latencies.length === 0) return 0;
    const idx = Math.min(Math.floor((p / 100) * latencies.length), latencies.length - 1);
    return latencies[idx];
  };

  const p50 = getPercentile(50);
  const p90 = getPercentile(90);
  const p95 = getPercentile(95);
  const p99 = getPercentile(99);

  let status: 'HEALTHY' | 'DEGRADED' | 'BROKEN' = 'HEALTHY';
  let limitingFactor = 'Within optimal bounds';

  if (serverErrors5xx > 0 || networkErrors > 0) {
    status = 'BROKEN';
    limitingFactor = `Server/Network errors (${serverErrors5xx} 5xx, ${networkErrors} net err)`;
  } else if (p99 >= 3500) {
    status = 'BROKEN';
    limitingFactor = `Tail Latency Collapse (P99: ${p99.toFixed(0)}ms >= 3500ms SLA)`;
  } else if (p99 >= 1800 || p50 >= 700) {
    status = 'DEGRADED';
    limitingFactor = `Event-loop queue buildup (P50: ${p50.toFixed(0)}ms, P99: ${p99.toFixed(0)}ms)`;
  }

  return {
    concurrency,
    totalRequests,
    durationSec: Number(durationSec.toFixed(2)),
    rps: Number(rps.toFixed(1)),
    successful,
    serverErrors5xx,
    clientErrors4xx,
    networkErrors,
    latencies: {
      min: Number((latencies[0] || 0).toFixed(1)),
      p50: Number(p50.toFixed(1)),
      p90: Number(p90.toFixed(1)),
      p95: Number(p95.toFixed(1)),
      p99: Number(p99.toFixed(1)),
      max: Number((latencies[latencies.length - 1] || 0).toFixed(1)),
    },
    status,
    limitingFactor,
  };
}

async function findBreakpoint(
  serviceName: string,
  category: 'Cache-Shielded Read' | 'Stateful Write / Lock' | 'Session / Auth' | 'Queue / Worker',
  tiers: StepTier[],
  requestFnGenerator: (concurrency: number) => (idx: number) => Promise<{ status: number; ok: boolean; error?: string }>,
  preStepHook?: (concurrency: number) => Promise<void>,
): Promise<ServiceBreakpointReport> {
  console.log(`\n================================================================================`);
  console.log(`🎯 PROBING BREAKPOINT: ${serviceName}`);
  console.log(`   Category: [${category}] | Stepping: ${tiers.map((t) => t.concurrency).join(' -> ')} VUs`);
  console.log(`================================================================================`);

  await warmupEndpoint(serviceName, requestFnGenerator(50));

  const tierResults: TierResult[] = [];
  let maxHealthyVUs = 0;
  let degradationVUs: number | null = null;
  let breakingPointVUs = tiers[tiers.length - 1].concurrency;
  let peakRps = 0;
  let p50AtPeak = 0;
  let p99AtPeak = 0;
  let primaryLimitingFactor = `Exceeded ${tiers[tiers.length - 1].concurrency} VUs without hard collapse`;

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    console.log(`\n  ▶️ [Tier ${i + 1}/${tiers.length}] Testing ${tier.concurrency} VUs (${tier.totalRequests} reqs)...`);

    if (preStepHook) {
      await preStepHook(tier.concurrency);
    }

    const res = await runTierBenchmark(serviceName, tier, requestFnGenerator(tier.concurrency));
    tierResults.push(res);

    console.log(
      `     RPS: ${res.rps.toFixed(1)} | P50: ${res.latencies.p50.toFixed(0)}ms | P99: ${res.latencies.p99.toFixed(0)}ms | Status: ${
        res.status === 'HEALTHY' ? '🟢 HEALTHY' : res.status === 'DEGRADED' ? '⚠️ DEGRADED' : '❌ BROKEN'
      }`,
    );

    if (res.status === 'HEALTHY') {
      maxHealthyVUs = tier.concurrency;
      if (res.rps > peakRps) {
        peakRps = res.rps;
        p50AtPeak = res.latencies.p50;
        p99AtPeak = res.latencies.p99;
      }
    } else if (res.status === 'DEGRADED') {
      if (degradationVUs === null) {
        degradationVUs = tier.concurrency;
      }
      if (res.rps > peakRps) {
        peakRps = res.rps;
        p50AtPeak = res.latencies.p50;
        p99AtPeak = res.latencies.p99;
      }
    }

    if (res.status === 'BROKEN') {
      breakingPointVUs = tier.concurrency;
      primaryLimitingFactor = res.limitingFactor || 'Tail latency collapse';
      console.log(`     🚨 BREAKPOINT REACHED at ${tier.concurrency} VUs! (${primaryLimitingFactor})`);
      break;
    }

    // Inter-tier pause
    await new Promise((r) => setTimeout(r, 1000));
  }

  const report: ServiceBreakpointReport = {
    service: serviceName,
    category,
    maxHealthyVUs,
    degradationVUs,
    breakingPointVUs,
    peakRps,
    p50AtPeak,
    p99AtPeak,
    primaryLimitingFactor,
    tierResults,
  };

  finalReports.push(report);

  // Inter-service cooldown pause to allow Node.js event loop & DB connection pool to settle
  await new Promise((r) => setTimeout(r, 2000));
  return report;
}

async function runMasterBreakpointSuite() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        MENTRILY ULTIMATE SYSTEM BREAKPOINT & SATURATION BENCHMARK            ║');
  console.log('║        Probing maximum sustainable concurrency across all fixed paths        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const exam = await prisma.exam.findFirst({ where: { slug: 'stress-test-exam' } });
  if (!exam) throw new Error('Exam stress-test-exam not found.');

  const teacherToken = 'test-load-token-teacher_1';
  const adminToken = 'test-load-token-admin_1';

  // =========================================================================
  // 1. NEGATIVE 404 EXAM PROBE (Cache-Shielded Read)
  // Stepping: 250 -> 500 -> 750 -> 1000 -> 1500 -> 2000 -> 2500 VUs
  // =========================================================================
  await findBreakpoint(
    'Negative 404 Cache Exam Slug Check (/api/exam/:slug/check)',
    'Cache-Shielded Read',
    [
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 1500 },
      { concurrency: 750, totalRequests: 2250 },
      { concurrency: 1000, totalRequests: 3000 },
      { concurrency: 1500, totalRequests: 4500 },
      { concurrency: 2000, totalRequests: 6000 },
      { concurrency: 2500, totalRequests: 7500 },
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

  // =========================================================================
  // 2. STUDENT BOOKMARKS PIPELINE (Cache-Shielded Read)
  // Stepping: 500 -> 750 -> 1000 -> 1500 -> 2000 -> 2500 VUs
  // =========================================================================
  await findBreakpoint(
    'Student Bookmarks Pipeline (/api/student/bookmarks)',
    'Cache-Shielded Read',
    [
      { concurrency: 500, totalRequests: 1500 },
      { concurrency: 750, totalRequests: 2250 },
      { concurrency: 1000, totalRequests: 3000 },
      { concurrency: 1500, totalRequests: 4500 },
      { concurrency: 2000, totalRequests: 6000 },
      { concurrency: 2500, totalRequests: 7500 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/student/bookmarks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.status === 200 };
    },
  );

  // =========================================================================
  // 3. TEACHER COURSES LISTING (Cache-Shielded Read)
  // Stepping: 500 -> 750 -> 1000 -> 1500 -> 2000 VUs
  // =========================================================================
  await findBreakpoint(
    'Teacher Courses Listing (/api/teacher/courses)',
    'Cache-Shielded Read',
    [
      { concurrency: 500, totalRequests: 1500 },
      { concurrency: 750, totalRequests: 2250 },
      { concurrency: 1000, totalRequests: 3000 },
      { concurrency: 1500, totalRequests: 4500 },
      { concurrency: 2000, totalRequests: 6000 },
    ],
    () => async () => {
      const res = await fetch(`${baseUrl}/api/teacher/courses`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      return { status: res.status, ok: res.status === 200 };
    },
  );

  // =========================================================================
  // 4. STUDENT ANNOUNCEMENTS PIPELINE (Cache-Shielded Read)
  // Stepping: 500 -> 750 -> 1000 -> 1500 -> 2000 VUs
  // =========================================================================
  await findBreakpoint(
    'Student Announcements Unified Pipeline (/api/student/announcements)',
    'Cache-Shielded Read',
    [
      { concurrency: 500, totalRequests: 1500 },
      { concurrency: 750, totalRequests: 2250 },
      { concurrency: 1000, totalRequests: 3000 },
      { concurrency: 1500, totalRequests: 4500 },
      { concurrency: 2000, totalRequests: 6000 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/student/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.status === 200 };
    },
  );

  // =========================================================================
  // 5. COURSE CATALOG BROWSE (Cache-Shielded Read)
  // Stepping: 100 -> 250 -> 500 -> 750 -> 1000 VUs
  // =========================================================================
  await findBreakpoint(
    'Course Catalog Browse (/api/student/courses/browse)',
    'Cache-Shielded Read',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 1500 },
      { concurrency: 750, totalRequests: 2250 },
      { concurrency: 1000, totalRequests: 3000 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/student/courses/browse`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.status === 200 };
    },
  );

  // =========================================================================
  // 6. AUTH SESSION RESOLUTION (Session / Auth)
  // Stepping: 100 -> 200 -> 300 -> 400 -> 500 -> 600 VUs
  // =========================================================================
  await findBreakpoint(
    'Auth Session Resolution (/api/auth/me)',
    'Session / Auth',
    [
      { concurrency: 100, totalRequests: 500 },
      { concurrency: 200, totalRequests: 1000 },
      { concurrency: 300, totalRequests: 1500 },
      { concurrency: 400, totalRequests: 2000 },
      { concurrency: 500, totalRequests: 2500 },
      { concurrency: 600, totalRequests: 3000 },
    ],
    () => async (idx) => {
      const studentNum = (idx % totalStudentsInDb) + 1;
      const token = `test-load-token-student_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.status === 200 };
    },
  );

  // =========================================================================
  // 7. EXAM ENTRY SIMULTANEOUS STORM (Stateful Write / Lock)
  // Stepping: 100 -> 150 -> 200 -> 250 -> 300 VUs
  // =========================================================================
  await findBreakpoint(
    'Exam Entry Simultaneous Storm (POST /api/exam/:slug/enter)',
    'Stateful Write / Lock',
    [
      { concurrency: 100, totalRequests: 100 },
      { concurrency: 150, totalRequests: 150 },
      { concurrency: 200, totalRequests: 200 },
      { concurrency: 250, totalRequests: 250 },
      { concurrency: 300, totalRequests: 300 },
    ],
    () => async (idx) => {
      const studentNum = idx + 1;
      const token = `test-load-token-student_${studentNum}`;
      const deviceId = `device_breakpoint_${studentNum}`;
      const res = await fetch(`${baseUrl}/api/exam/stress-test-exam/enter`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          deviceId,
          tabId: `tab_breakpoint_${studentNum}`,
          metadata: { browser: 'Chrome', platform: 'Linux' },
        }),
      });
      return { status: res.status, ok: res.status === 200 || res.status === 201 };
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

  // =========================================================================
  // 8. ANSWER AUTOSAVE QUEUE (Queue / Worker)
  // Stepping: 250 -> 500 -> 750 -> 1000 -> 1500 VUs
  // =========================================================================
  const autosaveSessions = await prisma.examSession.findMany({
    where: { examId: exam.id, status: 'IN_PROGRESS' },
    select: { id: true },
  });

  if (autosaveSessions.length > 0) {
    await findBreakpoint(
      'Answer Autosave Coalesced Queue (/api/submission/save-answer)',
      'Queue / Worker',
      [
        { concurrency: 250, totalRequests: 1000 },
        { concurrency: 500, totalRequests: 2000 },
        { concurrency: 750, totalRequests: 3000 },
        { concurrency: 1000, totalRequests: 4000 },
        { concurrency: 1500, totalRequests: 5000 },
      ],
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
            answer: { [questionId]: `Breakpoint answer payload text rev ${idx}` },
          }),
        });
        return { status: res.status, ok: res.status === 200 || res.status === 201 };
      },
    );
  }

  // =========================================================================
  // 9. TEACHER DASHBOARD STATS (SQL Aggregation)
  // Stepping: 250 -> 500 -> 750 -> 1000 -> 1500 VUs
  // =========================================================================
  await findBreakpoint(
    'Teacher Dashboard Stats (/api/teacher/stats)',
    'Cache-Shielded Read',
    [
      { concurrency: 250, totalRequests: 1000 },
      { concurrency: 500, totalRequests: 2000 },
      { concurrency: 750, totalRequests: 3000 },
      { concurrency: 1000, totalRequests: 4000 },
      { concurrency: 1500, totalRequests: 5000 },
    ],
    () => async () => {
      const res = await fetch(`${baseUrl}/api/teacher/stats`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      return { status: res.status, ok: res.status === 200 };
    },
  );

  // =========================================================================
  // 10. TEACHER EXAM PROCTORING MONITOR
  // Stepping: 200 -> 400 -> 600 -> 800 -> 1000 VUs
  // =========================================================================
  await findBreakpoint(
    'Teacher Exam Proctoring Monitor (/api/teacher/exams/:id/monitored)',
    'Cache-Shielded Read',
    [
      { concurrency: 200, totalRequests: 600 },
      { concurrency: 400, totalRequests: 1200 },
      { concurrency: 600, totalRequests: 1800 },
      { concurrency: 800, totalRequests: 2400 },
      { concurrency: 1000, totalRequests: 3000 },
    ],
    () => async () => {
      const res = await fetch(`${baseUrl}/api/teacher/exams/${exam.id}/monitored`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      return { status: res.status, ok: res.status === 200 };
    },
  );

  // =========================================================================
  // PRINT MASTER BREAKPOINT SCORECARD
  // =========================================================================
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                      ULTIMATE BREAKPOINT & SATURATION SCORECARD                                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Service                             │ Category      │ Max Healthy │ Degradation │ Breaking Pt │ Peak RPS    │ Limiting Factor     ║');
  console.log('╟─────────────────────────────────────┼───────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────────────╢');

  for (const r of finalReports) {
    const sName = (r.service.length > 35 ? r.service.substring(0, 32) + '...' : r.service).padEnd(35);
    const cat = r.category.substring(0, 13).padEnd(13);
    const healthy = `${r.maxHealthyVUs} VUs`.padEnd(11);
    const deg = (r.degradationVUs ? `${r.degradationVUs} VUs` : 'None').padEnd(11);
    const broke = `${r.breakingPointVUs} VUs`.padEnd(11);
    const rps = `${r.peakRps.toFixed(1)} rps`.padEnd(11);
    const limit = (r.primaryLimitingFactor.length > 40 ? r.primaryLimitingFactor.substring(0, 37) + '...' : r.primaryLimitingFactor);
    console.log(`║ ${sName} │ ${cat} │ ${healthy} │ ${deg} │ ${broke} │ ${rps} │ ${limit}`);
  }

  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n');

  await prisma.$disconnect();
}

runMasterBreakpointSuite().catch((err) => {
  console.error('Fatal error in breakpoint runner:', err);
  process.exit(1);
});
