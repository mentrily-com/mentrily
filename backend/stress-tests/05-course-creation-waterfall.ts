import { runBenchmark } from './benchmark-engine';
import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';

const prisma = new PrismaClient();

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:4000';

  console.log(`\n===============================================================`);
  console.log(`🔥 SCENARIO 5: COURSE SAVE & DATABASE UPSERT WATERFALL TEST`);
  console.log(`===============================================================`);

  // Fetch or create a test teacher with org permissions
  const teacherUser = await prisma.user.findFirst({
    where: { role: 'TEACHER' },
  });

  if (!teacherUser || !teacherUser.clerkId) {
    throw new Error('No TEACHER user with clerkId found in database. Run seed-load-data.ts first.');
  }

  const token = 'test-load-token-teacher_1';

  const course = await prisma.course.findFirst({
    where: { slug: 'stress-test-course' },
  });

  if (!course) {
    throw new Error('Test course not found. Run seed-load-data.ts first.');
  }

  console.log(`✅ Testing Course Updates on Course: ${course.title} (${course.id})`);

  // Build a realistic payload: 2 modules, each with 4 units
  const generateSectionsPayload = (iteration: number) => [
    {
      title: `Module 1 - Core Fundamentals (Rev ${iteration})`,
      questions: [
        { title: `Unit 1.1: Syntax Basics`, type: 'reading', text: 'Overview of syntax' },
        { title: `Unit 1.2: Variables and Types`, type: 'coding', code: 'x = 10' },
        { title: `Unit 1.3: Control Flow`, type: 'quiz', question: 'What is an if statement?' },
        { title: `Unit 1.4: Loops and Iterations`, type: 'coding', code: 'for i in range(10): pass' },
      ],
    },
    {
      title: `Module 2 - Data Structures (Rev ${iteration})`,
      questions: [
        { title: `Unit 2.1: Lists and Arrays`, type: 'reading', text: 'Linear data structures' },
        { title: `Unit 2.2: Hash Maps & Dictionaries`, type: 'coding', code: 'd = {}' },
        { title: `Unit 2.3: Trees & Graphs`, type: 'reading', text: 'Hierarchical data structures' },
        { title: `Unit 2.4: Algorithms & Complexity`, type: 'coding', code: 'O(N)' },
      ],
    },
  ];

  // 10 concurrent course updates (simulating 10 teachers saving multi-unit courses simultaneously)
  await runBenchmark({
    name: 'Course Save Waterfall - 10 Concurrent Multi-Unit Course Saves',
    totalRequests: 10,
    concurrency: 5,
    requestFn: async (idx) => {
      const payload = {
        title: `Stress Test Course - Saved Rev ${idx}`,
        shortDescription: `Benchmark iteration ${idx}`,
        status: 'Published',
        sections: generateSectionsPayload(idx),
      };

      const res = await fetch(`${baseUrl}/api/teacher/courses/${course.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, body: data };
    },
  });

  await prisma.$disconnect();
}

if (require.main === module) {
  main().then(() => {
    console.log('✅ Scenario 5 Completed.');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Scenario 5 Failed:', err);
    process.exit(1);
  });
}
