CREATE OR REPLACE FUNCTION public.sync_clerk_user(
  p_clerk_id TEXT,
  p_email TEXT,
  p_full_name TEXT,
  p_event TEXT,
  p_default_org_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email TEXT := NULLIF(lower(trim(p_email)), '');
  normalized_name TEXT := NULLIF(trim(p_full_name), '');
  existing_by_clerk_id RECORD;
  existing_by_email RECORD;
  pending_invite RECORD;
  synced_user_id TEXT;
  should_require_role_selection BOOLEAN;
BEGIN
  SELECT *
  INTO existing_by_clerk_id
  FROM "User"
  WHERE "clerkId" = p_clerk_id
  LIMIT 1;

  IF existing_by_clerk_id IS NULL AND normalized_email IS NOT NULL THEN
    SELECT *
    INTO existing_by_email
    FROM "User"
    WHERE "email" = normalized_email
    LIMIT 1;
  END IF;

  IF p_event = 'user.created' AND normalized_email IS NOT NULL THEN
    SELECT *
    INTO pending_invite
    FROM "PendingInvite"
    WHERE "email" = normalized_email
    LIMIT 1;
  END IF;

  should_require_role_selection := p_event = 'user.created' AND pending_invite IS NULL;

  IF existing_by_clerk_id IS NOT NULL THEN
    UPDATE "User"
    SET
      "clerkId" = p_clerk_id,
      "email" = COALESCE(normalized_email, existing_by_clerk_id."email"),
      "name" = normalized_name
    WHERE "id" = existing_by_clerk_id."id"
    RETURNING "id" INTO synced_user_id;
  ELSIF existing_by_email IS NOT NULL THEN
    UPDATE "User"
    SET
      "clerkId" = p_clerk_id,
      "email" = normalized_email,
      "name" = normalized_name,
      "needsRoleSelection" = CASE
        WHEN should_require_role_selection THEN TRUE
        ELSE COALESCE(existing_by_email."needsRoleSelection", FALSE)
      END
    WHERE "id" = existing_by_email."id"
    RETURNING "id" INTO synced_user_id;
  ELSE
    IF p_event <> 'user.created' THEN
      RETURN jsonb_build_object(
        'skipped', TRUE,
        'reason', 'user_not_found_for_update',
        'userId', NULL
      );
    END IF;

    IF normalized_email IS NULL THEN
      RETURN jsonb_build_object(
        'skipped', TRUE,
        'reason', 'missing_primary_email',
        'userId', NULL
      );
    END IF;

    IF pending_invite IS NULL AND p_default_org_id IS NULL THEN
      RAISE EXCEPTION 'DEFAULT_ORG_ID is not configured for self-signup users';
    END IF;

    INSERT INTO "User" (
      "id",
      "clerkId",
      "email",
      "name",
      "orgId",
      "needsRoleSelection"
    )
    VALUES (
      extensions.gen_random_uuid()::text,
      p_clerk_id,
      normalized_email,
      normalized_name,
      CASE WHEN pending_invite IS NOT NULL THEN pending_invite."orgId" ELSE p_default_org_id END,
      CASE WHEN pending_invite IS NOT NULL THEN FALSE ELSE TRUE END
    )
    RETURNING "id" INTO synced_user_id;
  END IF;

  IF pending_invite IS NOT NULL THEN
    UPDATE "User"
    SET
      "role" = pending_invite."role",
      "orgId" = pending_invite."orgId",
      "needsRoleSelection" = FALSE
    WHERE "id" = synced_user_id;

    DELETE FROM "PendingInvite"
    WHERE "id" = pending_invite."id";
  END IF;

  RETURN jsonb_build_object(
    'skipped', FALSE,
    'reason', NULL,
    'userId', synced_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.select_role_creator(
  p_user_id TEXT,
  p_org_name TEXT,
  p_org_slug TEXT
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
    p_org_name,
    p_org_slug,
    'FREE',
    'Active',
    0
  )
  RETURNING "id" INTO new_org_id;

  UPDATE "User"
  SET
    "role" = 'ADMIN',
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

CREATE OR REPLACE FUNCTION public.delete_organization(
  p_org_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_ids TEXT[];
BEGIN
  SELECT COALESCE(array_agg("id"), ARRAY[]::TEXT[])
  INTO user_ids
  FROM "User"
  WHERE "orgId" = p_org_id;

  DELETE FROM "AuditLog"
  WHERE "userId" = ANY(user_ids);

  DELETE FROM "Bookmark"
  WHERE "userId" = ANY(user_ids);

  DELETE FROM "User"
  WHERE "orgId" = p_org_id;

  DELETE FROM "Organization"
  WHERE "id" = p_org_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_activity_dates(
  p_user_id TEXT,
  p_limit INT DEFAULT 365
)
RETURNS TABLE(day_string DATE)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT DATE("createdAt") AS day_string
  FROM (
    SELECT "createdAt" FROM "ExamSession" WHERE "userId" = p_user_id AND "status" = 'COMPLETED'
    UNION ALL
    SELECT "createdAt" FROM "UnitSubmission" WHERE "userId" = p_user_id
  ) AS activity
  ORDER BY day_string DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.find_course_tests_by_question_id(
  p_question_id TEXT
)
RETURNS TABLE(id TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "id"
  FROM "CourseTest"
  WHERE "questions"::TEXT LIKE '%' || p_question_id || '%'
  LIMIT 5;
$$;

CREATE OR REPLACE FUNCTION public.upsert_certificate(
  p_id TEXT,
  p_user_id TEXT,
  p_org_id TEXT,
  p_type TEXT,
  p_resource_id TEXT,
  p_title TEXT,
  p_score FLOAT DEFAULT NULL,
  p_completion_pct INT DEFAULT NULL,
  p_file_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_row RECORD;
  inserted_row RECORD;
BEGIN
  IF p_id IS NULL OR trim(p_id) = '' THEN
    RAISE EXCEPTION 'Certificate id is required';
  END IF;

  IF p_file_url IS NULL OR trim(p_file_url) = '' THEN
    RAISE EXCEPTION 'Certificate fileUrl is required';
  END IF;

  SELECT *
  INTO existing_row
  FROM "Certificate"
  WHERE "userId" = p_user_id
    AND "type" = p_type
    AND "resourceId" = p_resource_id
  LIMIT 1;

  IF existing_row IS NOT NULL THEN
    RETURN to_jsonb(existing_row);
  END IF;

  INSERT INTO "Certificate" (
    "id",
    "userId",
    "orgId",
    "type",
    "resourceId",
    "title",
    "score",
    "completionPercent",
    "fileUrl",
    "issuedAt",
    "createdAt"
  )
  VALUES (
    p_id,
    p_user_id,
    p_org_id,
    p_type,
    p_resource_id,
    p_title,
    p_score,
    p_completion_pct,
    p_file_url,
    now(),
    now()
  )
  ON CONFLICT ("userId", "type", "resourceId") DO NOTHING
  RETURNING * INTO inserted_row;

  IF inserted_row IS NOT NULL THEN
    RETURN to_jsonb(inserted_row);
  END IF;

  SELECT *
  INTO existing_row
  FROM "Certificate"
  WHERE "userId" = p_user_id
    AND "type" = p_type
    AND "resourceId" = p_resource_id
  LIMIT 1;

  RETURN to_jsonb(existing_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_certificates(
  p_user_id TEXT
)
RETURNS TABLE(
  id TEXT,
  type TEXT,
  "resourceId" TEXT,
  title TEXT,
  score FLOAT,
  "completionPercent" INT,
  "fileUrl" TEXT,
  "issuedAt" TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    "id",
    "type",
    "resourceId",
    "title",
    "score",
    "completionPercent",
    "fileUrl",
    "issuedAt"
  FROM "Certificate"
  WHERE "userId" = p_user_id
  ORDER BY "issuedAt" DESC;
$$;

CREATE OR REPLACE FUNCTION public.adjust_org_counter(
  p_org_id TEXT,
  p_field TEXT,
  p_delta FLOAT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field NOT IN ('studentCount', 'courseCount', 'storageUsedMb', 'teacherSeatCount') THEN
    RAISE EXCEPTION 'Invalid counter field: %', p_field;
  END IF;

  EXECUTE format(
    'UPDATE "Organization" SET %I = GREATEST(0, COALESCE(%I, 0) + $1) WHERE id = $2',
    p_field,
    p_field
  ) USING p_delta, p_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_org_counts_by_plan()
RETURNS TABLE(plan "Plan", count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "plan"::"Plan", COUNT(*) AS count
  FROM "Organization"
  GROUP BY "plan";
$$;