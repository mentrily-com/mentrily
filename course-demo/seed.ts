/**
 * Mentrily Showcase Courses seeder.
 *
 * Seeds the org-less, platform-wide demo courses defined in course-demo/data/*.json,
 * each with a linked final exam. Idempotent: re-runs update course/exam fields and
 * rebuild modules/units (slug + orgId:null matching — the @@unique([slug, orgId])
 * constraint does not dedupe NULL orgIds, so we match manually with findFirst).
 *
 * Run from the backend directory so backend/.env and backend/node_modules resolve:
 *   cd backend && npm run seed:showcase
 * Optional: DEMO_CREATOR_EMAIL=<creator email> (defaults to xisense001@gmail.com)
 */
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const backendDir = path.resolve(__dirname, '../backend');
const requireFromBackend = createRequire(path.join(backendDir, 'package.json'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = requireFromBackend('@prisma/client');

// Prisma Client loads .env itself when CWD is backend, but be explicit so the
// seeder also works when invoked from elsewhere.
if (!process.env.DATABASE_URL) {
  const envPath = path.join(backendDir, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

const prisma = new PrismaClient();

const CREATOR_EMAIL = process.env.DEMO_CREATOR_EMAIL || 'xisense001@gmail.com';
const DATA_DIR = path.join(__dirname, 'data');

interface CourseFile {
  course: {
    title: string;
    slug: string;
    shortDescription: string;
    longDescription: string;
    difficulty: string;
    tags: string[];
    thumbnail: string | null;
    courseSummary?: string;
    examUnlockThreshold?: number;
  };
  modules: Array<{
    title: string;
    units: Array<{ title: string; type: string; content: unknown }>;
  }>;
  exam: {
    title: string;
    slug: string;
    shortDescription?: string;
    longDescription?: string;
    difficulty?: string;
    tags?: string[];
    duration: number;
    totalMarks?: number;
    passingPercentage: number;
    maxAttempts: number;
    attemptBufferMins?: number;
    questions: unknown;
  };
}

async function seedCourse(file: string, creatorId: string) {
  const definition: CourseFile = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, file), 'utf8'),
  );
  const { course: meta, modules, exam } = definition;

  const courseData = {
    title: meta.title,
    shortDescription: meta.shortDescription,
    longDescription: meta.longDescription,
    difficulty: meta.difficulty,
    tags: meta.tags,
    thumbnail: meta.thumbnail,
    courseSummary: meta.courseSummary ?? null,
    isVisible: true,
    status: 'Published',
    completionThreshold: 100,
    examPassThreshold: exam.passingPercentage,
    examUnlockThreshold: meta.examUnlockThreshold ?? 80,
    creatorId,
  };

  const modulesCreate = {
    create: modules.map((module, moduleIndex) => ({
      title: module.title,
      order: moduleIndex + 1,
      units: {
        create: module.units.map((unit, unitIndex) => ({
          title: unit.title,
          type: unit.type,
          order: unitIndex + 1,
          content: unit.content as object,
        })),
      },
    })),
  };

  let course = await prisma.course.findFirst({
    where: { slug: meta.slug, orgId: null },
  });
  let courseAction: string;

  if (course) {
    // Rebuild structure: delete modules (cascades to units and their submissions).
    await prisma.courseModule.deleteMany({ where: { courseId: course.id } });
    course = await prisma.course.update({
      where: { id: course.id },
      data: { ...courseData, modules: modulesCreate },
    });
    courseAction = 'updated';
  } else {
    course = await prisma.course.create({
      data: { ...courseData, slug: meta.slug, orgId: null, modules: modulesCreate },
    });
    courseAction = 'created';
  }

  // Prune progress rows that reference deleted unit IDs and refresh their counts.
  const unitRows = await prisma.unit.findMany({
    where: { module: { courseId: course.id } },
    select: { id: true },
  });
  const validUnitIds = new Set(unitRows.map((u: { id: string }) => u.id));
  const totalUnits = validUnitIds.size;
  const progressRows = await prisma.courseProgress.findMany({
    where: { courseId: course.id },
  });
  for (const row of progressRows) {
    const completedUnits = (row.completedUnits || []).filter((id: string) =>
      validUnitIds.has(id),
    );
    const completedCount = completedUnits.length;
    const percent = totalUnits ? Math.round((completedCount / totalUnits) * 100) : 0;
    await prisma.courseProgress.update({
      where: { id: row.id },
      data: {
        completedUnits,
        completedCount,
        totalUnits,
        percent,
        status: completedCount === 0 ? 'Not Started' : percent >= 100 ? 'Completed' : 'In Progress',
      },
    });
  }

  const examData = {
    title: exam.title,
    shortDescription: exam.shortDescription ?? null,
    longDescription: exam.longDescription ?? null,
    difficulty: exam.difficulty ?? meta.difficulty,
    tags: exam.tags ?? meta.tags,
    duration: exam.duration,
    totalMarks: exam.totalMarks ?? null,
    passingPercentage: exam.passingPercentage,
    maxAttempts: exam.maxAttempts,
    attemptBufferMins: exam.attemptBufferMins ?? 30,
    examMode: 'Browser',
    aiProctoring: false,
    strictness: 'medium',
    questions: exam.questions as object,
    isActive: true,
    resultsPublished: false,
    creatorId,
  };

  let examRow = await prisma.exam.findFirst({
    where: { slug: exam.slug, orgId: null },
  });
  let examAction: string;
  if (examRow) {
    examRow = await prisma.exam.update({ where: { id: examRow.id }, data: examData });
    examAction = 'updated';
  } else {
    examRow = await prisma.exam.create({
      data: { ...examData, slug: exam.slug, orgId: null },
    });
    examAction = 'created';
  }

  // Link course <-> exam bidirectionally (mirrors teacher.service linking).
  await prisma.$transaction([
    prisma.course.update({
      where: { id: course.id },
      data: { linkedExamId: examRow.id },
    }),
    prisma.exam.update({
      where: { id: examRow.id },
      data: { linkedCourseId: course.id },
    }),
  ]);

  return {
    file,
    slug: meta.slug,
    courseId: course.id,
    courseAction,
    units: totalUnits,
    examId: examRow.id,
    examAction,
  };
}

async function main() {
  const creator = await prisma.user.findFirst({
    where: { email: CREATOR_EMAIL },
  });
  if (!creator) {
    throw new Error(
      `Creator account not found for email "${CREATOR_EMAIL}". ` +
        'Set DEMO_CREATOR_EMAIL to an existing user.',
    );
  }
  console.log(`Seeding showcase courses as creator ${creator.email} (${creator.id})`);

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length === 0) throw new Error(`No course JSON files found in ${DATA_DIR}`);

  const results = [];
  for (const file of files) {
    results.push(await seedCourse(file, creator.id));
  }

  console.log('\nShowcase course seed summary:');
  console.table(
    results.map((r) => ({
      course: r.slug,
      action: r.courseAction,
      units: r.units,
      exam: r.examAction,
      courseId: r.courseId,
      examId: r.examId,
    })),
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
