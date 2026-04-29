CREATE OR REPLACE FUNCTION public.select_role_creator(
  p_user_id TEXT,
  p_org_name TEXT DEFAULT NULL,
  p_org_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user RECORD;
  new_org_id TEXT;
  updated_user RECORD;
  resolved_org_name TEXT;
BEGIN
  SELECT *
  INTO existing_user
  FROM "User"
  WHERE "id" = p_user_id
  LIMIT 1;

  IF existing_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF COALESCE(existing_user."needsRoleSelection", FALSE) = FALSE THEN
    RAISE EXCEPTION 'Role has already been selected';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_org_slug, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Organization slug is required';
  END IF;

  resolved_org_name := COALESCE(
    NULLIF(BTRIM(p_org_name), ''),
    CASE
      WHEN NULLIF(BTRIM(existing_user."name"), '') IS NOT NULL THEN NULLIF(BTRIM(existing_user."name"), '') || '''s Workspace'
      ELSE NULL
    END,
    'Creator Workspace'
  );

  INSERT INTO "Organization" (
    "id",
    "name",
    "slug",
    "plan",
    "status",
    "teacherSeatCount"
  )
  VALUES (
    extensions.gen_random_uuid()::text,
    resolved_org_name,
    p_org_slug,
    'FREE',
    'Active',
    0
  )
  RETURNING "id" INTO new_org_id;

  UPDATE "User"
  SET
    "role" = 'TEACHER',
    "orgId" = new_org_id,
    "needsRoleSelection" = FALSE
  WHERE "id" = p_user_id
  RETURNING * INTO updated_user;

  RETURN jsonb_build_object(
    'orgId', new_org_id,
    'user', to_jsonb(updated_user)
  );
END;
$$;
