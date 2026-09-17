import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedLoadTestData(studentCount = 50) {
  console.log('🌱 Checking / Seeding stress test data...');

  // 1. Get or create organization
  let org = await prisma.organization.findFirst({
    where: { slug: 'sudip-adhikari-s-school' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Sudip Adhikari's School",
        slug: 'sudip-adhikari-s-school',
        plan: 'FREE',
        planStatus: 'ACTIVE',
        maxUsers: 500,
        maxCourses: 50,
      },
    });
  }

  console.log(`✅ Using Organization: ${org.name} (${org.id})`);

  // 2. Upsert test students
  const studentIds: string[] = [];
  for (let i = 1; i <= studentCount; i++) {
    const clerkId = `load_test_student_${i}`;
    const email = `student_${i}@stress-test.local`;
    const name = `Stress Test Student ${i}`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        clerkId,
        name,
        role: 'STUDENT',
        orgId: org.id,
        isActive: true,
        hasCompletedOnboarding: true,
      },
      create: {
        clerkId,
        email,
        name,
        role: 'STUDENT',
        orgId: org.id,
        isActive: true,
        hasCompletedOnboarding: true,
      },
    });

    await prisma.orgMembership.upsert({
      where: {
        userId_orgId: {
          userId: user.id,
          orgId: org.id,
        },
      },
      update: { role: 'STUDENT', status: 'ACTIVE' },
      create: {
        userId: user.id,
        orgId: org.id,
        role: 'STUDENT',
        status: 'ACTIVE',
      },
    });

    studentIds.push(user.id);
  }
  console.log(`✅ ${studentCount} Test Students verified in database.`);

  // 2b. Upsert test teachers
  const teacherCount = 5;
  for (let i = 1; i <= teacherCount; i++) {
    const clerkId = `load_test_teacher_${i}`;
    const email = `teacher_${i}@stress-test.local`;
    const name = `Stress Test Teacher ${i}`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        clerkId,
        name,
        role: 'TEACHER',
        orgId: org.id,
        isActive: true,
        hasCompletedOnboarding: true,
      },
      create: {
        clerkId,
        email,
        name,
        role: 'TEACHER',
        orgId: org.id,
        isActive: true,
        hasCompletedOnboarding: true,
      },
    });

    await prisma.orgMembership.upsert({
      where: {
        userId_orgId: {
          userId: user.id,
          orgId: org.id,
        },
      },
      update: { role: 'TEACHER', status: 'ACTIVE' },
      create: {
        userId: user.id,
        orgId: org.id,
        role: 'TEACHER',
        status: 'ACTIVE',
      },
    });
  }
  console.log(`✅ ${teacherCount} Test Teachers verified in database.`);

  // 3. Upsert test exam
  const examSlug = 'stress-test-exam';
  const existingExam = await prisma.exam.findFirst({
    where: { slug: examSlug, orgId: org.id },
  });

  const sampleQuestions = [
    {
      id: 'q1',
      title: 'Sum of Two Numbers',
      type: 'coding',
      points: 10,
      description: 'Write a program that prints the sum of 5 and 7.',
      testCases: [{ input: '', expectedOutput: '12', isHidden: false }],
    },
    {
      id: 'q2',
      title: 'HTTP Status Code',
      type: 'multiple-choice',
      points: 5,
      question: 'Which status code represents Success?',
      options: ['200', '404', '500', '302'],
      correctAnswer: '200',
    },
    {
      id: 'q3',
      title: 'Database Normalization',
      type: 'short-answer',
      points: 5,
      question: 'What is 1NF?',
    },
  ];

  let exam: any;
  if (!existingExam) {
    exam = await prisma.exam.create({
      data: {
        title: 'Stress Test Exam',
        slug: examSlug,
        orgId: org.id,
        examMode: 'Browser',
        isActive: true,
        duration: 90,
        passingPercentage: 50,
        questions: sampleQuestions as any,
        testCodeType: 'STATIC',
      },
    });
    console.log(`✅ Created test exam: ${exam.title} (${exam.id})`);
  } else {
    exam = existingExam;
    console.log(`✅ Using existing test exam: ${exam.title} (${exam.id})`);
  }

  // 4. Ensure test course exists
  const courseSlug = 'stress-test-course';
  const existingCourse = await prisma.course.findFirst({
    where: { slug: courseSlug, orgId: org.id },
  });

  let course: any;
  if (!existingCourse) {
    course = await prisma.course.create({
      data: {
        title: 'Stress Test Course',
        slug: courseSlug,
        orgId: org.id,
        shortDescription: 'Automated load testing course',
        status: 'Published',
      },
    });
    console.log(`✅ Created test course: ${course.title} (${course.id})`);
  } else {
    course = existingCourse;
    console.log(`✅ Using existing test course: ${course.title} (${course.id})`);
  }

  await prisma.$disconnect();
  return { org, exam, course, studentCount };
}

if (require.main === module) {
  seedLoadTestData(50).then(() => {
    console.log('🎉 Seeding completed successfully.');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}
