DROP POLICY IF EXISTS "org_read_own" ON "Organization";
CREATE POLICY "org_read_own" ON "Organization"
  FOR SELECT
  TO authenticated
  USING (
    id = requesting_org_id()
    AND requesting_user_role() IN ('ADMIN', 'SUPER_ADMIN')
  );

DROP POLICY IF EXISTS "user_admin_read_org" ON "User";
CREATE POLICY "user_admin_read_org" ON "User"
  FOR SELECT
  TO authenticated
  USING (
    "orgId" = requesting_org_id()
    AND requesting_user_role() IN ('ADMIN', 'SUPER_ADMIN')
  );

REVOKE SELECT ON TABLE "User" FROM anon;
GRANT SELECT ON TABLE "User" TO authenticated;
