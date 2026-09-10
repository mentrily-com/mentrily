-- Every RPC function below is SECURITY DEFINER (runs with the owning
-- role's privileges, bypassing the caller's own RLS restrictions) and
-- performs NO internal authorization check of its own -- each trusts its
-- arguments completely. That's fine as an implementation detail of
-- trusted backend code: every call site in this repo goes through
-- SupabaseService's client, which authenticates as service_role and is
-- never exposed to end users.
--
-- But nothing in version control was actually enforcing that a
-- differently-privileged caller can't reach these directly through
-- PostgREST's /rest/v1/rpc/<function> endpoint -- no migration here ever
-- issued a GRANT or REVOKE EXECUTE on them, so whether `anon` or
-- `authenticated` can call them depended entirely on the Supabase
-- project's default privilege configuration, which lives outside this
-- repo and isn't something a migration file can verify. If that default
-- is (or ever becomes, e.g. after a project migration or a well-meaning
-- `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated` run
-- by hand) more permissive than assumed, several of these are severe on
-- their own:
--   - delete_organization(text): deletes an entire org, its users, and
--     their audit logs/bookmarks, given nothing but an org id.
--   - select_role_creator(text, text, text): promotes an arbitrary
--     p_user_id to ADMIN of a brand-new org -- callable for *any* user
--     id, not just the caller's own.
--   - sync_clerk_user(...): re-points an existing User row's clerkId to
--     whatever the caller passes, matched by email if no clerkId match
--     is found -- an account-takeover primitive if p_email can be
--     supplied by anyone other than a verified Clerk webhook payload.
--   - adjust_org_counter(text, text, float): arbitrary delta to any
--     org's billing-relevant counters (seat/storage/course counts).
--   - list_certificates(text): returns another user's full certificate
--     history given only their id.
--
-- Rather than rely on an assumption about database configuration this
-- repo can't see or enforce, make the intended access model explicit and
-- self-verifying: revoke EXECUTE from PUBLIC (which anon and
-- authenticated otherwise inherit) and grant it only to service_role.
-- This changes nothing for the app itself -- every real call site already
-- authenticates as service_role -- and closes the gap regardless of
-- whatever the project's actual current defaults turn out to be.

REVOKE ALL ON FUNCTION public.sync_clerk_user(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_clerk_user(TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.sync_clerk_user(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_clerk_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.select_role_creator(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_role_creator(TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.delete_organization(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_organization(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_student_activity_dates(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_activity_dates(TEXT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.find_course_tests_by_question_id(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_course_tests_by_question_id(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_certificate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, FLOAT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_certificate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, FLOAT, INT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.list_certificates(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_certificates(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.adjust_org_counter(TEXT, TEXT, FLOAT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_org_counter(TEXT, TEXT, FLOAT) TO service_role;

REVOKE ALL ON FUNCTION public.get_org_counts_by_plan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_counts_by_plan() TO service_role;

-- The four public.jwt_*/requesting_*/try_parse_uuid helpers used inside
-- RLS policy definitions are deliberately left untouched: RLS itself
-- invokes them as the querying role, so authenticated/anon need EXECUTE
-- on those specifically for any RLS-gated SELECT to work at all.
