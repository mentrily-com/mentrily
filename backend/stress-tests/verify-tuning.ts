import { runBenchmark } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = process.env.API_URL || 'http://localhost:4000';
const slug = 'stress-test-exam';

async function verify() {
  console.log('================================================================================');
  console.log('🚀 POST-TUNING VERIFICATION BENCHMARK');
  console.log('================================================================================\n');

  const exam = await prisma.exam.findFirst({ where: { slug } });
  if (!exam) throw new Error('Exam not found.');

  // Clean exam sessions
  await prisma.examSession.deleteMany({
    where: {
      examId: exam.id,
      user: { email: { contains: 'stress-test.local' } },
    },
  });

  // 1. Exam Entry Storm with 200 Concurrent Students
  console.log('1️⃣ Testing Exam Entry Storm with 200 Concurrent Students (Connection Pool: 35)...');
  await runBenchmark({
    name: 'Tuned Exam Entry [200 Concurrent VUs]',
    totalRequests: 200,
    concurrency: 200,
    requestFn: async (idx) => {
      const studentNum = idx + 1;
      const token = `test-load-token-student_${studentNum}`;
      const deviceId = `device_tuned_${studentNum}`;
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

  // 2. Code Execution with 15 Concurrent Students
  console.log('\n2️⃣ Testing Code Execution with 15 Concurrent Students (Worker Concurrency: 15)...');
  await runBenchmark({
    name: 'Tuned Code Execution [15 Concurrent VUs]',
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
          code: `print(f"Post-tuning verification {${idx} * 42}")`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  // 3. Concurrent Course Update with 10 Concurrent Teacher Requests
  console.log('\n3️⃣ Testing Concurrent Course Save (10 Concurrent Requests, Transactional Isolation)...');
  const course = await prisma.course.findFirst({ where: { slug: 'stress-test-course' } });
  if (course) {
    await runBenchmark({
      name: 'Tuned Concurrent Course Update [10 Concurrent Requests]',
      totalRequests: 10,
      concurrency: 10,
      requestFn: async (idx) => {
        const token = 'test-load-token-teacher_1';
        const res = await fetch(`${baseUrl}/api/teacher/courses/${course.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `Stress Test Course - Rev ${idx}`,
            sections: [
              {
                title: `Module Alpha - Worker ${idx}`,
                questions: [
                  {
                    title: `Unit A - ${idx}`,
                    type: 'LESSON',
                    content: { text: `Lesson payload ${idx}` },
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
  }

  console.log('\n================================================================================');
  console.log('✅ POST-TUNING VERIFICATION COMPLETE');
  console.log('================================================================================');
  process.exit(0);
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
