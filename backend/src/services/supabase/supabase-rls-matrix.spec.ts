import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '').trim();

const TOKENS = {
  SUPER_ADMIN: String(process.env.SUPABASE_TEST_JWT_SUPER_ADMIN || '').trim(),
  ADMIN: String(process.env.SUPABASE_TEST_JWT_ADMIN || '').trim(),
  TEACHER: String(process.env.SUPABASE_TEST_JWT_TEACHER || '').trim(),
  STUDENT: String(process.env.SUPABASE_TEST_JWT_STUDENT || '').trim(),
};

const hasRlsEnv =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) &&
  Object.values(TOKENS).every((token) => Boolean(token));

const describeIfRls = hasRlsEnv ? describe : describe.skip;

type Scenario = {
  name: string;
  role: keyof typeof TOKENS;
  table: string;
  expectAllowed: boolean;
};

const scenarios: Scenario[] = [
  {
    name: 'super-admin can read Organization',
    role: 'SUPER_ADMIN',
    table: 'Organization',
    expectAllowed: true,
  },
  {
    name: 'super-admin can read User',
    role: 'SUPER_ADMIN',
    table: 'User',
    expectAllowed: true,
  },
  {
    name: 'admin can read User',
    role: 'ADMIN',
    table: 'User',
    expectAllowed: true,
  },
  {
    name: 'admin cannot read SubscriptionEvent directly',
    role: 'ADMIN',
    table: 'SubscriptionEvent',
    expectAllowed: false,
  },
  {
    name: 'teacher can read Course',
    role: 'TEACHER',
    table: 'Course',
    expectAllowed: true,
  },
  {
    name: 'teacher can read Exam',
    role: 'TEACHER',
    table: 'Exam',
    expectAllowed: true,
  },
  {
    name: 'teacher cannot read Organization globally',
    role: 'TEACHER',
    table: 'Organization',
    expectAllowed: false,
  },
  {
    name: 'student can read Course enrollment scope',
    role: 'STUDENT',
    table: 'Course',
    expectAllowed: true,
  },
  {
    name: 'student can read ExamSession self scope',
    role: 'STUDENT',
    table: 'ExamSession',
    expectAllowed: true,
  },
  {
    name: 'student cannot read User globally',
    role: 'STUDENT',
    table: 'User',
    expectAllowed: false,
  },
  {
    name: 'student cannot read SubscriptionEvent',
    role: 'STUDENT',
    table: 'SubscriptionEvent',
    expectAllowed: false,
  },
];

describeIfRls('Supabase RLS role matrix (11 scenarios)', () => {
  const clientForRole = (role: keyof typeof TOKENS) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${TOKENS[role]}` } },
    });

  it.each(scenarios)('$name', async ({ role, table, expectAllowed }) => {
    const client = clientForRole(role);
    const { data, error } = await (client as any)
      .from(table)
      .select('id')
      .limit(1);

    if (expectAllowed) {
      expect(error).toBeNull();
      return;
    }

    const deniedByError = Boolean(error);
    const deniedByRlsFilter =
      !error && Array.isArray(data) && data.length === 0;
    expect(deniedByError || deniedByRlsFilter).toBe(true);
  });
});
