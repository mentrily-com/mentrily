import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const CREATOR_EMAIL = 'xisense001@gmail.com';
const LEARNER_EMAIL = 'sumanydv514@gmail.com';
const DEFAULT_PRIMARY_COLOR = '#008D98';

const now = new Date();

function daysAgo(days: number) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(10 + (days % 8), 15, 0, 0);
  return date;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function mcq(id: string, title: string, correct: string, options: string[]) {
  return {
    id,
    title,
    type: 'MCQ',
    marks: 5,
    question: title,
    description: `<p>${title}</p>`,
    problemStatement: `<p>${title}</p>`,
    options: options.map((text, index) => ({
      id: `${id}-opt-${index + 1}`,
      text,
      isCorrect: text === correct,
    })),
  };
}

function codingQuestion(id: string, title: string) {
  return {
    id,
    title,
    type: 'Coding',
    marks: 20,
    question: title,
    description: `<p>${title}</p>`,
    problemStatement: `<p>${title}</p>`,
    codingConfig: {
      languageId: 'javascript',
      allowedLanguages: ['javascript', 'python'],
      templates: {
        javascript: {
          head: '',
          body: 'function normalizeEmail(input) {\n  // return the normalized email\n}\n',
          tail: '\nmodule.exports = normalizeEmail;',
          solution:
            "function normalizeEmail(input) {\n  return String(input || '').trim().toLowerCase();\n}\nmodule.exports = normalizeEmail;",
        },
        python: {
          head: '',
          body: 'def normalize_email(value):\n    # return the normalized email\n    pass\n',
          tail: '',
          solution:
            "def normalize_email(value):\n    return str(value or '').strip().lower()\n",
        },
      },
      testCases: [
        { input: '  STUDENT@COLLEGE.EDU  ', output: 'student@college.edu', isPublic: true, points: 5 },
        { input: 'Admin@Campus.org', output: 'admin@campus.org', isPublic: true, points: 5 },
        { input: 'learner@example.com', output: 'learner@example.com', isPublic: false, points: 10 },
      ],
      showTestCases: true,
    },
  };
}

function normalizeUnitContent(unit: { type: string; title: string; content: any }) {
  if (unit.type !== 'Reading') return unit.content;
  const body =
    unit.content?.description ||
    unit.content?.readingConfig?.body ||
    unit.content?.readingConfig?.content ||
    `<p>${unit.title}</p>`;

  return {
    ...unit.content,
    description: body,
    problemStatement: body,
    readingContent: [{ id: `${slug(unit.title)}-body`, type: 'text', content: body }],
  };
}

const courseDefinitions = [
  {
    title: 'Cloud Computing Foundations',
    difficulty: 'Beginner',
    tags: ['Cloud', 'DevOps', 'Infrastructure'],
    percent: 33,
    modules: [
      {
        title: 'Cloud Fundamentals',
        units: [
          {
            title: 'What is Cloud Computing?',
            type: 'Reading',
            content: {
              readingConfig: {
                body: '<h2>Cloud Computing</h2><p>Learn IaaS, PaaS, SaaS, regions, availability zones, and shared responsibility.</p>',
              },
            },
          },
          {
            title: 'Cloud Service Models Quiz',
            type: 'MCQ',
            content: mcq('cloud-u2', 'Which cloud model gives the most infrastructure control?', 'IaaS', [
              'SaaS',
              'PaaS',
              'IaaS',
              'BaaS',
            ]),
          },
          {
            title: 'Deploy a Static Page',
            type: 'Web',
            content: {
              webConfig: {
                html: '<main><h1>Campus Cloud Portal</h1></main>',
                css: 'main { font-family: sans-serif; padding: 2rem; }',
                js: "console.log('cloud ready')",
                showFiles: { html: true, css: true, js: true },
                testCases: [],
              },
            },
          },
        ],
      },
      {
        title: 'Cloud Operations',
        units: [
          {
            title: 'Monitoring Basics',
            type: 'Reading',
            content: {
              readingConfig: {
                body: '<p>Monitoring combines metrics, logs, traces, alert policies, and incident response.</p>',
              },
            },
          },
          {
            title: 'SLA and Availability',
            type: 'MCQ',
            content: mcq('cloud-u5', 'What does an SLA usually define?', 'Expected service availability', [
              'Programming language syntax',
              'Expected service availability',
              'Student attendance',
              'Database table names',
            ]),
          },
          {
            title: 'Normalize Cloud Account Email',
            type: 'Coding',
            content: codingQuestion('cloud-u6', 'Write a helper that normalizes cloud account email input.'),
          },
        ],
      },
    ],
  },
  {
    title: 'Data Structures with JavaScript',
    difficulty: 'Intermediate',
    tags: ['JavaScript', 'Algorithms', 'Data Structures'],
    percent: 67,
    modules: [
      {
        title: 'Core Structures',
        units: [
          {
            title: 'Arrays and Hash Maps',
            type: 'Reading',
            content: {
              readingConfig: {
                body: '<p>Arrays are ordered collections. Hash maps optimize key-based lookup.</p>',
              },
            },
          },
          {
            title: 'Time Complexity Check',
            type: 'MCQ',
            content: mcq('ds-u2', 'Average lookup time in a hash map is usually:', 'O(1)', [
              'O(n)',
              'O(log n)',
              'O(1)',
              'O(n log n)',
            ]),
          },
          {
            title: 'Implement a Stack',
            type: 'Coding',
            content: {
              ...codingQuestion('ds-u3', 'Implement push, pop, and peek for a stack.'),
              codingConfig: {
                ...codingQuestion('ds-u3', 'Implement push, pop, and peek for a stack.').codingConfig,
                templates: {
                  javascript: {
                    head: '',
                    body: 'class Stack {\n  constructor() {\n    this.items = [];\n  }\n  push(value) {}\n  pop() {}\n  peek() {}\n}\nmodule.exports = Stack;',
                    tail: '',
                    solution:
                      'class Stack {\n  constructor() { this.items = []; }\n  push(value) { this.items.push(value); }\n  pop() { return this.items.pop(); }\n  peek() { return this.items[this.items.length - 1]; }\n}\nmodule.exports = Stack;',
                  },
                },
              },
            },
          },
        ],
      },
      {
        title: 'Trees and Traversal',
        units: [
          {
            title: 'Binary Tree Concepts',
            type: 'Reading',
            content: {
              readingConfig: {
                body: '<p>Tree traversal strategies include preorder, inorder, postorder, and breadth-first search.</p>',
              },
            },
          },
          {
            title: 'Traversal Quiz',
            type: 'MCQ',
            content: mcq('ds-u5', 'Which traversal visits nodes level by level?', 'Breadth-first search', [
              'Inorder traversal',
              'Postorder traversal',
              'Breadth-first search',
              'Depth-only scan',
            ]),
          },
          {
            title: 'Queue Simulation',
            type: 'Coding',
            content: codingQuestion('ds-u6', 'Normalize input before queue insertion.'),
          },
        ],
      },
    ],
  },
  {
    title: 'Cybersecurity Essentials',
    difficulty: 'Beginner',
    tags: ['Security', 'Networks', 'Awareness'],
    percent: 50,
    modules: [
      {
        title: 'Security Mindset',
        units: [
          {
            title: 'CIA Triad',
            type: 'Reading',
            content: {
              readingConfig: {
                body: '<p>Confidentiality, integrity, and availability guide cybersecurity decisions.</p>',
              },
            },
          },
          {
            title: 'Phishing Awareness',
            type: 'MCQ',
            content: mcq('sec-u2', 'A suspicious login email should be:', 'Verified through an official channel', [
              'Forwarded to classmates',
              'Clicked immediately',
              'Verified through an official channel',
              'Ignored forever',
            ]),
          },
          {
            title: 'Password Policy Helper',
            type: 'Coding',
            content: codingQuestion('sec-u3', 'Normalize an email before checking account policy.'),
          },
        ],
      },
      {
        title: 'Network Defense',
        units: [
          {
            title: 'Firewalls and IDS',
            type: 'Reading',
            content: {
              readingConfig: {
                body: '<p>Firewalls filter traffic while IDS tools detect suspicious patterns.</p>',
              },
            },
          },
          {
            title: 'Encryption Basics',
            type: 'MCQ',
            content: mcq('sec-u5', 'TLS primarily protects:', 'Data in transit', [
              'Class schedules',
              'Data in transit',
              'CPU temperature',
              'CSS selectors',
            ]),
          },
          {
            title: 'Security Log Parser',
            type: 'Coding',
            content: codingQuestion('sec-u6', 'Normalize usernames before log aggregation.'),
          },
        ],
      },
    ],
  },
  {
    title: 'Applied AI for Campus Projects',
    difficulty: 'Intermediate',
    tags: ['AI', 'Machine Learning', 'Projects'],
    percent: 83,
    modules: [
      {
        title: 'AI Foundations',
        units: [
          {
            title: 'Model Inputs and Outputs',
            type: 'Reading',
            content: {
              readingConfig: {
                body: '<p>AI systems depend on carefully scoped input data, evaluation criteria, and human review.</p>',
              },
            },
          },
          {
            title: 'Prompt Design Basics',
            type: 'MCQ',
            content: mcq('ai-u2', 'A good prompt should include:', 'Clear task and constraints', [
              'Only emojis',
              'Clear task and constraints',
              'No examples ever',
              'Random unrelated facts',
            ]),
          },
          {
            title: 'Clean Dataset Emails',
            type: 'Coding',
            content: codingQuestion('ai-u3', 'Normalize email fields before training data validation.'),
          },
        ],
      },
      {
        title: 'Campus AI Project',
        units: [
          {
            title: 'Evaluation Metrics',
            type: 'Reading',
            content: {
              readingConfig: {
                body: '<p>Accuracy, precision, recall, latency, and fairness help judge AI project quality.</p>',
              },
            },
          },
          {
            title: 'Responsible AI Quiz',
            type: 'MCQ',
            content: mcq('ai-u5', 'Human review is important because AI systems can:', 'Make confident mistakes', [
              'Never fail',
              'Make confident mistakes',
              'Replace all policies',
              'Remove all data needs',
            ]),
          },
          {
            title: 'Input Sanitizer',
            type: 'Coding',
            content: codingQuestion('ai-u6', 'Sanitize student email input for an AI assistant.'),
          },
        ],
      },
    ],
  },
];

const examSections = [
  {
    id: 'sec-foundations',
    title: 'Technical Foundations',
    status: 'active',
    questions: [
      mcq('exam-q1', 'Which protocol secures web traffic?', 'HTTPS', ['FTP', 'HTTP', 'HTTPS', 'SMTP']),
      mcq('exam-q2', 'Which data structure uses FIFO ordering?', 'Queue', ['Stack', 'Queue', 'Tree', 'Graph']),
    ],
  },
  {
    id: 'sec-campus-systems',
    title: 'Campus Systems',
    status: 'locked',
    questions: [
      mcq('exam-q3', 'A cloud region is best described as:', 'A geographic area containing data centers', [
        'A browser tab',
        'A CSS rule',
        'A geographic area containing data centers',
        'A student group',
      ]),
      mcq('exam-q4', 'A secure password reset flow should:', 'Verify identity before allowing reset', [
        'Email plaintext passwords',
        'Skip verification',
        'Verify identity before allowing reset',
        'Use one shared token forever',
      ]),
    ],
  },
  {
    id: 'sec-coding',
    title: 'Coding Challenge',
    status: 'locked',
    questions: [
      codingQuestion('exam-q5', 'Write a function that normalizes and validates a college email address.'),
    ],
  },
];

async function deleteCreatorCourses(creatorId: string) {
  const courses = await prisma.course.findMany({
    where: { creatorId },
    select: { id: true, title: true },
  });

  if (courses.length === 0) return [];

  await prisma.course.deleteMany({
    where: { id: { in: courses.map((course) => course.id) } },
  });

  return courses.map((course) => course.title);
}

async function clearDemoRows(teacherId: string, orgId: string | null) {
  await prisma.announcement.deleteMany({
    where: {
      teacherId,
      title: {
        in: [
          'College Tech Fest Lab Schedule',
          'Library Database Orientation',
          'Internal Hackathon Registration',
        ],
      },
    },
  });

  await prisma.studentGroup.deleteMany({
    where: { teacherId, name: 'Demo College Learners' },
  });

  await prisma.exam.deleteMany({
    where: {
      creatorId: teacherId,
      slug: 'campus-technology-readiness-exam',
      ...(orgId ? { orgId } : { orgId: null }),
    },
  });
}

async function createCourseWithProgress(params: {
  definition: (typeof courseDefinitions)[number];
  creatorId: string;
  learnerId: string;
  orgId: string | null;
  index: number;
}) {
  const { definition, creatorId, learnerId, orgId, index } = params;
  const createdAt = daysAgo(20 - index * 3);

  const course = await prisma.course.create({
    data: {
      title: definition.title,
      slug: `${slug(definition.title)}-demo`,
      shortDescription: `Hands-on ${definition.title.toLowerCase()} course for college technology learners.`,
      longDescription:
        'A seeded demo course with reading, quiz, web, and coding activities for learner progress testing.',
      difficulty: definition.difficulty,
      tags: definition.tags,
      thumbnail: null,
      courseSummary: `${definition.title} covers core concepts, practical labs, and short assessments.`,
      isVisible: true,
      status: 'Published',
      completionThreshold: 100,
      examPassThreshold: 70,
      examUnlockThreshold: 80,
      creatorId,
      orgId,
      students: { connect: [{ id: learnerId }] },
      createdAt,
      updatedAt: createdAt,
      modules: {
        create: definition.modules.map((module, moduleIndex) => ({
          title: module.title,
          order: moduleIndex + 1,
          createdAt,
          updatedAt: createdAt,
          units: {
            create: module.units.map((unit, unitIndex) => ({
              title: unit.title,
              type: unit.type,
              order: unitIndex + 1,
              content: normalizeUnitContent(unit),
              createdAt,
              updatedAt: createdAt,
            })),
          },
        })),
      },
      tests: {
        create: [
          {
            title: `${definition.title} Knowledge Check`,
            slug: `${slug(definition.title)}-knowledge-check-demo`,
            orgId,
            questions: {
              sections: [
                {
                  id: `${slug(definition.title)}-quiz`,
                  title: 'Core Concepts',
                  questions: [
                    mcq(`${slug(definition.title)}-test-1`, 'What is the main goal of this course?', 'Build practical technical skill', [
                      'Avoid all labs',
                      'Build practical technical skill',
                      'Memorize only dates',
                      'Skip assessments',
                    ]),
                    mcq(`${slug(definition.title)}-test-2`, 'Which habit improves technical learning?', 'Frequent practice and review', [
                      'Frequent practice and review',
                      'Never testing code',
                      'Ignoring feedback',
                      'Deleting notes',
                    ]),
                  ],
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      modules: { include: { units: true } },
    },
  });

  const units = course.modules.flatMap((module) =>
    module.units.sort((a, b) => a.order - b.order),
  );
  const totalUnits = units.length;
  const completedCount = Math.max(
    1,
    Math.min(totalUnits, Math.round((definition.percent / 100) * totalUnits)),
  );
  const completedUnits = units.slice(0, completedCount);
  const seededPercent = Math.round((completedCount / totalUnits) * 100);

  await prisma.courseProgress.upsert({
    where: { userId_courseId: { userId: learnerId, courseId: course.id } },
    update: {
      completedUnits: completedUnits.map((unit) => unit.id),
      totalUnits,
      completedCount,
      percent: seededPercent,
      status: completedCount === totalUnits ? 'Completed' : 'In Progress',
    },
    create: {
      userId: learnerId,
      courseId: course.id,
      completedUnits: completedUnits.map((unit) => unit.id),
      totalUnits,
      completedCount,
      percent: seededPercent,
      status: completedCount === totalUnits ? 'Completed' : 'In Progress',
    },
  });

  for (const [completedIndex, unit] of completedUnits.entries()) {
    const activityDate = daysAgo((index * 6 + completedIndex) % 32);
    await prisma.unitSubmission.create({
      data: {
        userId: learnerId,
        unitId: unit.id,
        status: 'COMPLETED',
        content: {
          seeded: true,
          note: `Completed seeded unit: ${unit.title}`,
        },
        score: 75 + ((index + completedIndex) % 5) * 5,
        startedAt: activityDate,
        timeTakenSec: 900 + completedIndex * 120,
        createdAt: activityDate,
        updatedAt: activityDate,
      },
    });

    await prisma.questionAttempt.create({
      data: {
        userId: learnerId,
        itemId: unit.id,
        type: 'UNIT',
        content: { seeded: true, unitTitle: unit.title },
        isCorrect: true,
        score: 80 + ((index + completedIndex) % 4) * 5,
        createdAt: activityDate,
      },
    });
  }

  return {
    id: course.id,
    title: course.title,
    progress: seededPercent,
    completedCount,
    totalUnits,
  };
}

async function seedThirtyTwoDayStreak(learnerId: string, unitIds: string[]) {
  if (unitIds.length === 0) return;

  for (let day = 0; day < 32; day += 1) {
    const unitId = unitIds[day % unitIds.length];
    const activityDate = daysAgo(day);

    await prisma.unitSubmission.create({
      data: {
        userId: learnerId,
        unitId,
        status: 'COMPLETED',
        content: { seeded: true, streakDay: 32 - day },
        score: 90,
        startedAt: activityDate,
        timeTakenSec: 600,
        createdAt: activityDate,
        updatedAt: activityDate,
      },
    });
  }
}

async function main() {
  const [creator, learner] = await Promise.all([
    prisma.user.findUnique({ where: { email: CREATOR_EMAIL } }),
    prisma.user.findUnique({ where: { email: LEARNER_EMAIL } }),
  ]);

  if (!creator) {
    throw new Error(`Creator user not found: ${CREATOR_EMAIL}`);
  }
  if (!learner) {
    throw new Error(`Learner user not found: ${LEARNER_EMAIL}`);
  }

  const orgId = creator.orgId || learner.orgId || null;

  if (orgId) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { primaryColor: DEFAULT_PRIMARY_COLOR },
    });
  }

  await prisma.user.update({
    where: { id: learner.id },
    data: {
      role: Role.STUDENT,
      orgId,
      isActive: true,
      dailyStreak: 32,
      lastActivityDate: daysAgo(0),
      totalXP: 4200,
    },
  });

  const deletedCourses = await deleteCreatorCourses(creator.id);
  await clearDemoRows(creator.id, orgId);

  const seededCourses = [];
  for (const [index, definition] of courseDefinitions.entries()) {
    seededCourses.push(
      await createCourseWithProgress({
        definition,
        creatorId: creator.id,
        learnerId: learner.id,
        orgId,
        index,
      }),
    );
  }

  const allSeededUnits = await prisma.unit.findMany({
    where: {
      module: {
        course: {
          id: { in: seededCourses.map((course) => course.id) },
        },
      },
    },
    select: { id: true },
  });
  await seedThirtyTwoDayStreak(
    learner.id,
    allSeededUnits.map((unit) => unit.id),
  );

  const group = await prisma.studentGroup.create({
    data: {
      name: 'Demo College Learners',
      teacherId: creator.id,
      orgId,
      students: { connect: [{ id: learner.id }] },
    },
  });

  const announcements = await Promise.all([
    prisma.announcement.create({
      data: {
        title: 'College Tech Fest Lab Schedule',
        content:
          '<p>The computer science department will keep Lab 3 open until 7 PM this week for Tech Fest prototype preparation.</p>',
        attachments: [],
        teacherId: creator.id,
        orgId,
        groups: { connect: [{ id: group.id }] },
        createdAt: daysAgo(2),
      },
    }),
    prisma.announcement.create({
      data: {
        title: 'Library Database Orientation',
        content:
          '<p>All learners are invited to a short orientation on using IEEE, ACM, and Springer resources for project research.</p>',
        attachments: [],
        teacherId: creator.id,
        orgId,
        groups: { connect: [{ id: group.id }] },
        createdAt: daysAgo(1),
      },
    }),
    prisma.announcement.create({
      data: {
        title: 'Internal Hackathon Registration',
        content:
          '<p>Registration for the 24-hour campus hackathon is open. Teams should submit their ideas by Friday afternoon.</p>',
        attachments: [],
        teacherId: creator.id,
        orgId,
        groups: { connect: [{ id: group.id }] },
        createdAt: daysAgo(0),
      },
    }),
  ]);

  const exam = await prisma.exam.create({
    data: {
      title: 'Campus Technology Readiness Exam',
      slug: 'campus-technology-readiness-exam',
      shortDescription:
        'A seeded demo exam covering cloud, security, data structures, and one coding challenge.',
      longDescription:
        'This exam is seeded for testing sectioned exam rendering and coding-question submission flows.',
      difficulty: 'Intermediate',
      tags: ['College', 'Technology', 'Coding'],
      duration: 90,
      totalMarks: 60,
      passingPercentage: 70,
      maxAttempts: 2,
      attemptBufferMins: 30,
      testCode: 'CAMPUS32',
      testCodeType: 'Permanent',
      examMode: 'Browser',
      aiProctoring: false,
      strictness: 'medium',
      questions: { sections: examSections },
      isActive: true,
      resultsPublished: false,
      creatorId: creator.id,
      orgId,
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
  });

  const courseCount = await prisma.course.count({ where: { orgId } });
  const studentCount = await prisma.user.count({
    where: { role: Role.STUDENT, OR: [{ orgId }, { courses: { some: { orgId } } }] },
  });
  const teacherSeatCount = await prisma.user.count({
    where: { orgId, role: { in: [Role.ADMIN, Role.TEACHER] } },
  });
  if (orgId) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { courseCount, studentCount, teacherSeatCount },
    });
  }

  console.log('[college-demo-seed] complete');
  console.log({
    creator: creator.email,
    learner: learner.email,
    orgId,
    deletedCourses,
    seededCourses,
    announcements: announcements.map((announcement) => announcement.title),
    group: group.name,
    dailyStreak: 32,
    exam: { id: exam.id, title: exam.title, slug: exam.slug },
  });
}

main()
  .catch((error) => {
    console.error('[college-demo-seed] failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
