CREATE OR REPLACE FUNCTION public.sync_clerk_user(
  p_clerk_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_event TEXT DEFAULT 'user.updated',
  p_default_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT := lower(trim(coalesce(p_event, '')));
  v_email TEXT := lower(trim(coalesce(p_email, '')));
  v_user "User"%ROWTYPE;
BEGIN
  IF v_event NOT IN ('user.created', 'user.updated') THEN
    RAISE EXCEPTION 'Unsupported Clerk event: %', p_event;
  END IF;

  SELECT *
  INTO v_user
  FROM "User"
  WHERE "clerkId" = p_clerk_id
     OR (v_email <> '' AND lower(email) = v_email)
  ORDER BY CASE WHEN "clerkId" = p_clerk_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF FOUND THEN
    UPDATE "User"
    SET
      "clerkId" = p_clerk_id,
      name = COALESCE(NULLIF(trim(p_full_name), ''), name),
      email = CASE WHEN v_email <> '' THEN v_email ELSE email END,
      "updatedAt" = NOW()
    WHERE id = v_user.id;

    RETURN jsonb_build_object('userId', v_user.id, 'status', 'updated');
  END IF;

  INSERT INTO "User" (
    id,
    email,
    "clerkId",
    name,
    role,
    "needsRoleSelection",
    "isActive",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    v_email,
    p_clerk_id,
    NULLIF(trim(p_full_name), ''),
    'STUDENT'::"Role",
    TRUE,
    TRUE,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_user;

  RETURN jsonb_build_object('userId', v_user.id, 'status', 'created');
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_clerk_user(
  p_clerk_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_event TEXT DEFAULT 'user.updated',
  p_default_org_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.sync_clerk_user(
    p_clerk_id,
    p_email,
    p_full_name,
    p_event,
    NULLIF(trim(p_default_org_id), '')::UUID
  );
END;
$$;
