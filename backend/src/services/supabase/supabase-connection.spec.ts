import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Smoke test for the Supabase project this backend is configured to point
 * at (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) -- not the RLS behaviour
 * itself, which supabase-rls-matrix.spec.ts already covers. This exists to
 * catch the class of failure a schema-shape check catches best: a fresh or
 * re-provisioned project that boots and accepts connections but is missing
 * a table, view, or RPC function the application actually calls at
 * runtime -- exactly what happened when the Asset model was added to
 * schema.prisma without ever generating its migration (see the sibling
 * 20260908060000_add_asset_model migration).
 *
 * Skips (not fails) when the env isn't configured, matching the pattern in
 * supabase-rls-matrix.spec.ts and supabase-rpc-verification.spec.ts -- CI
 * and most local runs won't have live project credentials, and that's not
 * this test's failure to report.
 */

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
).trim();

const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const describeIfSupabase = hasSupabaseEnv ? describe : describe.skip;

// Every table/view Prisma or supabase-js actually queries in this codebase
// (see grep for `.from(` / `prisma.<model>` across src/), independent of
// whether it currently holds rows -- a `select().limit(0)` fails the same
// way whether the table is empty or missing, which is exactly the check
// that would have caught the missing Asset table before it shipped.
const EXPECTED_TABLES = [
  'User',
  'Organization',
  'OrgMembership',
  'Exam',
  'ExamSession',
  'Violation',
  'Course',
  'CourseModule',
  'Unit',
  'CourseTest',
  'UnitSubmission',
  'CourseProgress',
  'CourseAssignment',
  'Bookmark',
  'QuestionAttempt',
  'StudentGroup',
  'Announcement',
  'AnnouncementRead',
  'BugReport',
  'AiUsage',
  'PendingInvite',
  'SubscriptionEvent',
  'UsageLedger',
  'WebhookEndpoint',
  'Certificate',
  'CertificateTemplate',
  'PublicCodingQuestion',
  'Asset',
  'Feedback',
  'AuditLog',
];

const EXPECTED_VIEWS = [
  'UserProfile',
  'CreatorCourseList',
  'CreatorExamList',
  'CreatorUserList',
  'LearnerEnrolledCourse',
  'LearnerExamResult',
  'ExamMonitorView',
];

// RPCs the backend actually calls (see SupabaseService / callers), checked
// with arguments that are valid-shaped but reference nothing real -- the
// point is confirming the function exists and accepts the call, not
// asserting particular business results (that's supabase-rpc-verification's
// job for the edge-case behaviours).
const EXPECTED_RPCS: Array<{ fn: string; args: Record<string, unknown> }> = [
  { fn: 'get_org_counts_by_plan', args: {} },
  {
    fn: 'get_student_activity_dates',
    args: { p_user_id: '00000000-0000-0000-0000-000000000000' },
  },
  {
    fn: 'find_course_tests_by_question_id',
    args: { p_question_id: '00000000-0000-0000-0000-000000000000' },
  },
  {
    fn: 'list_certificates',
    args: { p_user_id: '00000000-0000-0000-0000-000000000000' },
  },
];

describeIfSupabase('Supabase connection smoke test', () => {
  // Matches supabase-rpc-verification.spec.ts: the generated Database type
  // isn't wired into this client, so `any` avoids fighting the generic
  // `.rpc()`/`.from()` overloads for table/function names built from a
  // runtime list rather than known string literals.
  let client: any;

  beforeAll(() => {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it('connects and can round-trip a query', async () => {
    const { error } = await client.from('User').select('id').limit(1);
    expect(error).toBeNull();
  });

  it.each(EXPECTED_TABLES)(
    'table "%s" exists and is queryable',
    async (table) => {
      const { error } = await client
        .from(table)
        .select('*', { head: true, count: 'exact' });
      expect(error).toBeNull();
    },
  );

  it.each(EXPECTED_VIEWS)('view "%s" exists and is queryable', async (view) => {
    const { error } = await client
      .from(view)
      .select('*', { head: true, count: 'exact' });
    expect(error).toBeNull();
  });

  it.each(EXPECTED_RPCS)(
    'rpc "$fn" exists and is callable',
    async ({ fn, args }) => {
      const { error } = await client.rpc(fn, args);
      // A function that doesn't exist raises PGRST202 ("Could not find the
      // function"); any other error (including a deliberately-triggered
      // business-logic exception from the placeholder id above) means the
      // function was found and executed, which is all this test checks.
      expect(error?.code).not.toBe('PGRST202');
    },
  );

  it('migration history matches what this repo expects to have applied', async () => {
    const { data, error } = await client
      .from('_prisma_migrations')
      .select('migration_name')
      .order('migration_name', { ascending: true });

    expect(error).toBeNull();

    const applied = new Set(
      (data || []).map((row: any) => row.migration_name as string),
    );
    const migrationsDir = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'prisma',
      'migrations',
    );
    const onDisk = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const missing = onDisk.filter((name) => !applied.has(name));
    expect(missing).toEqual([]);
  });
});
