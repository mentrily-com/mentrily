import { runBenchmark } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = process.env.API_URL || 'http://localhost:4000';

async function testCharacterizedServices() {
  console.log('================================================================================');
  console.log('⚡ BENCHMARKING CHARACTERIZED OPTIMIZED SERVICES');
  console.log('================================================================================\n');

  // Ensure admin user and org exist for admin testing
  const org = await prisma.organization.findFirst({
    where: { slug: 'sudip-adhikari-s-school' },
  });
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

  const teacherToken = 'test-load-token-teacher_1';
  const studentToken = 'test-load-token-student_1';
  const adminToken = 'test-load-token-admin_1';

  // 1. Student Browse Courses (Decoupled Redis catalog + user enrollment)
  console.log('1️⃣ Benchmarking GET /api/student/courses/browse (50 Concurrency)...');
  await runBenchmark({
    name: 'GET /api/student/courses/browse [Catalog Redis Cache]',
    totalRequests: 100,
    concurrency: 50,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/student/courses/browse`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // 2. Teacher Stats (Parallelized Counts)
  console.log('\n2️⃣ Benchmarking GET /api/teacher/stats (50 Concurrency)...');
  await runBenchmark({
    name: 'GET /api/teacher/stats [Parallelized Counts + Redis]',
    totalRequests: 100,
    concurrency: 50,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/teacher/stats`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // 3. Admin Storage Leaderboard (Redis-cached asset groupBy)
  console.log('\n3️⃣ Benchmarking GET /api/admin/storage/users (50 Concurrency)...');
  await runBenchmark({
    name: 'GET /api/admin/storage/users [Cached Asset GroupBy]',
    totalRequests: 100,
    concurrency: 50,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/admin/storage/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // 4. Invalid Exam Slug Probe (Negative Cache Test)
  console.log('\n4️⃣ Benchmarking Invalid Exam Slug Lookups (100 Concurrency)...');
  await runBenchmark({
    name: 'GET /api/exam/non-existent-probe-slug/check (Negative Cache)',
    totalRequests: 200,
    concurrency: 100,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/exam/non-existent-probe-slug/check?json=1`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.status === 404, body: data };
    },
  });

  // 5. Deterministic Code Execution (SHA256 Hash Cache)
  console.log('\n5️⃣ Benchmarking Deterministic Code Execution (50 Concurrency)...');
  await runBenchmark({
    name: 'POST /api/code/run [Deterministic Hash Cache]',
    totalRequests: 100,
    concurrency: 50,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/code/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          language: 'python',
          code: 'print("optimal performance verified")',
          input: '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  console.log('\n================================================================================');
  console.log('✅ SERVICE BENCHMARK COMPLETE');
  console.log('================================================================================');
  await prisma.$disconnect();
}

testCharacterizedServices().catch((e) => {
  console.error(e);
  process.exit(1);
});
