-- Migrations 00408, 00418, 00506, and 0709 (in Prisma-migration terms:
-- add_certificate_templates_and_course_exam_links, tier_org_model_alignment,
-- public_coding_questions, org_membership) added CertificateTemplate,
-- CourseAssignment, PublicCodingQuestion, and OrgMembership after 00004_rls_policies.sql
-- had already run -- so they never got the same RLS treatment as every other
-- application table. Asset (this session's migration) has the same gap from
-- day one. None of these are ever queried via PostgREST with the anon or
-- authenticated key -- every access in this codebase goes through Prisma on
-- a direct connection, which RLS does not gate -- so enabling RLS with no
-- policies here changes nothing for the app itself. It only closes the same
-- PostgREST/anon exposure gap that 00004 already closed for AiUsage,
-- AuditLog, BugReport, Violation, StudentGroup, CourseTest, PendingInvite,
-- SubscriptionEvent, UsageLedger, and WebhookEndpoint -- tables that also
-- have RLS enabled with zero policies, by the same design.
ALTER TABLE "CertificateTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PublicCodingQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;

-- The two migration-bookkeeping tables are internal to the deploy process
-- (Prisma's own tracker and this repo's raw-SQL tracker) and were never
-- meant to be reachable via the Data API at all.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._schema_migrations ENABLE ROW LEVEL SECURITY;
