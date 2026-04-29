CREATE OR REPLACE VIEW public."UserProfile" AS
SELECT
  "id",
  "name",
  "email",
  "profilePicture",
  "rollNumber",
  "department",
  "role",
  "dailyStreak",
  "totalXP",
  "orgId",
  "createdAt"
FROM "User"
WHERE "isActive" = TRUE;

GRANT SELECT ON TABLE public."UserProfile" TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'graphql'
      AND p.proname = 'rebuild_schema'
  ) THEN
    PERFORM graphql.rebuild_schema();
  END IF;
END
$$;