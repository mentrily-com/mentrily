CREATE OR REPLACE FUNCTION public.jwt_claims()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.jwt_claim_text(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.jwt_claims() ->> p_key, '');
$$;

CREATE OR REPLACE FUNCTION public.jwt_app_metadata_text(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.jwt_claims() -> 'app_metadata' ->> p_key, '');
$$;

CREATE OR REPLACE FUNCTION public.try_parse_uuid(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parsed UUID;
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    parsed := p_value::UUID;
    RETURN parsed::TEXT;
  EXCEPTION
    WHEN others THEN
      RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  from_app_user TEXT;
  from_sub_uuid TEXT;
  from_sub_clerk TEXT;
BEGIN
  from_app_user := public.try_parse_uuid(public.jwt_claim_text('app_user_id'));
  IF from_app_user IS NOT NULL THEN
    RETURN from_app_user;
  END IF;

  from_app_user := public.try_parse_uuid(public.jwt_app_metadata_text('app_user_id'));
  IF from_app_user IS NOT NULL THEN
    RETURN from_app_user;
  END IF;

  from_sub_uuid := public.try_parse_uuid(public.jwt_claim_text('sub'));
  IF from_sub_uuid IS NOT NULL THEN
    RETURN from_sub_uuid;
  END IF;

  SELECT u."id"
  INTO from_sub_clerk
  FROM "User" u
  WHERE u."clerkId" = public.jwt_claim_text('sub')
  LIMIT 1;

  RETURN from_sub_clerk;
END;
$$;

CREATE OR REPLACE FUNCTION public.requesting_org_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  from_claim TEXT;
  from_user TEXT;
BEGIN
  from_claim := public.try_parse_uuid(public.jwt_claim_text('org_id'));
  IF from_claim IS NOT NULL THEN
    RETURN from_claim;
  END IF;

  from_claim := public.try_parse_uuid(public.jwt_app_metadata_text('org_id'));
  IF from_claim IS NOT NULL THEN
    RETURN from_claim;
  END IF;

  SELECT u."orgId"
  INTO from_user
  FROM "User" u
  WHERE u."id" = public.requesting_user_id()
  LIMIT 1;

  RETURN from_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.requesting_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  from_claim TEXT;
  from_claim_app TEXT;
  from_token_role TEXT;
  from_user TEXT;
BEGIN
  from_claim := public.jwt_claim_text('app_role');
  IF from_claim IS NOT NULL THEN
    RETURN from_claim;
  END IF;

  from_claim_app := public.jwt_app_metadata_text('app_role');
  IF from_claim_app IS NOT NULL THEN
    RETURN from_claim_app;
  END IF;

  from_token_role := public.jwt_claim_text('role');
  IF from_token_role IN ('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN') THEN
    RETURN from_token_role;
  END IF;

  SELECT u."role"::TEXT
  INTO from_user
  FROM "User" u
  WHERE u."id" = public.requesting_user_id()
  LIMIT 1;

  RETURN COALESCE(from_user, 'STUDENT');
END;
$$;