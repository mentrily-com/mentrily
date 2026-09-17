import { runBenchmark } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = process.env.API_URL || 'http://localhost:4000';

async function testAuditedEndpoints() {
  console.log('================================================================================');
  console.log('⚡ BENCHMARKING AUDITED API ENDPOINTS (WITH NEW PRISMA INDEXES & OPTIMIZATIONS)');
  console.log('================================================================================\n');

  const teacherToken = 'test-load-token-teacher_1';
  const studentToken = 'test-load-token-student_1';

  // 1. Teacher Exams (Indexed by creatorId, updatedAt)
  console.log('1️⃣ Benchmarking GET /api/teacher/exams (50 concurrent requests)...');
  await runBenchmark({
    name: 'GET /api/teacher/exams [50 Concurrency]',
    totalRequests: 100,
    concurrency: 50,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/teacher/exams`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // 2. Teacher Courses (Indexed by creatorId, updatedAt)
  console.log('\n2️⃣ Benchmarking GET /api/teacher/courses (50 concurrent requests)...');
  await runBenchmark({
    name: 'GET /api/teacher/courses [50 Concurrency]',
    totalRequests: 100,
    concurrency: 50,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/teacher/courses`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // 3. Teacher Students Analytics (Bounded findMany + indexed UnitSubmissions)
  console.log('\n3️⃣ Benchmarking GET /api/teacher/students (30 concurrent requests)...');
  await runBenchmark({
    name: 'GET /api/teacher/students [30 Concurrency]',
    totalRequests: 60,
    concurrency: 30,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/teacher/students`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // 4. Student Announcements (Unified pipeline query)
  console.log('\n4️⃣ Benchmarking GET /api/student/announcements (100 concurrent requests)...');
  await runBenchmark({
    name: 'GET /api/student/announcements [100 Concurrency]',
    totalRequests: 200,
    concurrency: 100,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/student/announcements`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // 5. Student Bookmarks (Shared cache query)
  console.log('\n5️⃣ Benchmarking GET /api/student/bookmarks (100 concurrent requests)...');
  await runBenchmark({
    name: 'GET /api/student/bookmarks [100 Concurrency]',
    totalRequests: 200,
    concurrency: 100,
    requestFn: async () => {
      const res = await fetch(`${baseUrl}/api/student/bookmarks`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  console.log('\n================================================================================');
  console.log('✅ AUDITED ENDPOINTS BENCHMARK COMPLETE');
  console.log('================================================================================');
  await prisma.$disconnect();
}

testAuditedEndpoints().catch((e) => {
  console.error(e);
  process.exit(1);
});
