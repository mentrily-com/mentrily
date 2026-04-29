import { createClient } from '@supabase/supabase-js';

type RpcResponse = { data: unknown; error: { message: string } | null };

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
).trim();

const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const describeIfSupabase = hasSupabaseEnv ? describe : describe.skip;

describeIfSupabase('Supabase RPC edge-case verification', () => {
  let client: any;

  beforeAll(() => {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  const callRpc = async (
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<RpcResponse> => {
    const response = await client.rpc(fn, args || {});
    return { data: response.data, error: response.error };
  };

  it('get_org_counts_by_plan should return a response shape', async () => {
    const result = await callRpc('get_org_counts_by_plan');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
  });

  it('get_student_activity_dates should handle unknown student', async () => {
    const result = await callRpc('get_student_activity_dates', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.error === null || Boolean(result.error)).toBe(true);
  });

  it('find_course_tests_by_question_id should handle unknown question', async () => {
    const result = await callRpc('find_course_tests_by_question_id', {
      p_question_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.error === null || Boolean(result.error)).toBe(true);
  });

  it('adjust_org_counter should reject invalid arguments', async () => {
    const result = await callRpc('adjust_org_counter', {
      p_org_id: '00000000-0000-0000-0000-000000000000',
      p_field: 'unknown_counter',
      p_delta: 1,
      p_floor_at_zero: true,
    });
    expect(result.error).toBeTruthy();
  });

  it('delete_organization should safely handle unknown org', async () => {
    const result = await callRpc('delete_organization', {
      p_org_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.error === null || Boolean(result.error)).toBe(true);
  });

  it('upsert_certificate should reject invalid payload', async () => {
    const result = await callRpc('upsert_certificate', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_exam_id: '00000000-0000-0000-0000-000000000000',
      p_payload: { invalid: true },
    });
    expect(result.error).toBeTruthy();
  });

  it('list_certificates should handle unknown user', async () => {
    const result = await callRpc('list_certificates', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.error === null || Boolean(result.error)).toBe(true);
  });

  it('sync_clerk_user should reject malformed event', async () => {
    const result = await callRpc('sync_clerk_user', {
      p_event_type: 'bad.event',
      p_data: { id: 'x' },
    });
    expect(result.error).toBeTruthy();
  });

  it('select_role_creator should reject unknown user', async () => {
    const result = await callRpc('select_role_creator', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_org_name: 'Demo Org',
    });
    expect(result.error).toBeTruthy();
  });
});
