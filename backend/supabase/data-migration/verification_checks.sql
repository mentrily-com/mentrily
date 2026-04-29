-- FK integrity checks (expect 0)
SELECT 'ExamSession.userId_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "ExamSession" es
LEFT JOIN "User" u ON u.id = es."userId"
WHERE u.id IS NULL;

SELECT 'ExamSession.examId_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "ExamSession" es
LEFT JOIN "Exam" e ON e.id = es."examId"
WHERE e.id IS NULL;

SELECT 'UnitSubmission.userId_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "UnitSubmission" us
LEFT JOIN "User" u ON u.id = us."userId"
WHERE u.id IS NULL;

SELECT 'UnitSubmission.unitId_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "UnitSubmission" us
LEFT JOIN "Unit" u ON u.id = us."unitId"
WHERE u.id IS NULL;

SELECT 'CourseModule.courseId_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "CourseModule" cm
LEFT JOIN "Course" c ON c.id = cm."courseId"
WHERE c.id IS NULL;

SELECT 'Unit.moduleId_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "Unit" u
LEFT JOIN "CourseModule" cm ON cm.id = u."moduleId"
WHERE cm.id IS NULL;

SELECT 'AnnouncementRead.userId_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "AnnouncementRead" ar
LEFT JOIN "User" u ON u.id = ar."userId"
WHERE u.id IS NULL;

SELECT 'AnnouncementRead.announcementId_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "AnnouncementRead" ar
LEFT JOIN "Announcement" a ON a.id = ar."announcementId"
WHERE a.id IS NULL;

SELECT '_CourseStudents.A_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "_CourseStudents" cs
LEFT JOIN "Course" c ON c.id = cs."A"
WHERE c.id IS NULL;

SELECT '_CourseStudents.B_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "_CourseStudents" cs
LEFT JOIN "User" u ON u.id = cs."B"
WHERE u.id IS NULL;

SELECT '_GroupStudents.A_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "_GroupStudents" gs
LEFT JOIN "StudentGroup" sg ON sg.id = gs."A"
WHERE sg.id IS NULL;

SELECT '_GroupStudents.B_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "_GroupStudents" gs
LEFT JOIN "User" u ON u.id = gs."B"
WHERE u.id IS NULL;

SELECT '_AnnouncementGroups.A_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "_AnnouncementGroups" ag
LEFT JOIN "Announcement" a ON a.id = ag."A"
WHERE a.id IS NULL;

SELECT '_AnnouncementGroups.B_orphans' AS check_name, COUNT(*) AS invalid_count
FROM "_AnnouncementGroups" ag
LEFT JOIN "StudentGroup" sg ON sg.id = ag."B"
WHERE sg.id IS NULL;

-- Unique duplicate checks (expect 0)
SELECT 'User.email_duplicate_groups' AS check_name,
       COUNT(*) AS invalid_count
FROM (
  SELECT "email"
  FROM "User"
  GROUP BY "email"
  HAVING COUNT(*) > 1
) dup;

SELECT 'User.clerkId_duplicate_groups' AS check_name,
       COUNT(*) AS invalid_count
FROM (
  SELECT "clerkId"
  FROM "User"
  WHERE "clerkId" IS NOT NULL
  GROUP BY "clerkId"
  HAVING COUNT(*) > 1
) dup;

SELECT 'Exam.slug_org_duplicate_groups' AS check_name,
       COUNT(*) AS invalid_count
FROM (
  SELECT "slug", "orgId"
  FROM "Exam"
  GROUP BY "slug", "orgId"
  HAVING COUNT(*) > 1
) dup;

SELECT 'Course.slug_org_duplicate_groups' AS check_name,
       COUNT(*) AS invalid_count
FROM (
  SELECT "slug", "orgId"
  FROM "Course"
  GROUP BY "slug", "orgId"
  HAVING COUNT(*) > 1
) dup;

SELECT 'CourseTest.slug_org_duplicate_groups' AS check_name,
       COUNT(*) AS invalid_count
FROM (
  SELECT "slug", "orgId"
  FROM "CourseTest"
  GROUP BY "slug", "orgId"
  HAVING COUNT(*) > 1
) dup;

SELECT 'Feedback.user_exam_duplicate_groups' AS check_name,
       COUNT(*) AS invalid_count
FROM (
  SELECT "userId", "examId"
  FROM "Feedback"
  GROUP BY "userId", "examId"
  HAVING COUNT(*) > 1
) dup;

SELECT 'Bookmark.user_custom_duplicate_groups' AS check_name,
       COUNT(*) AS invalid_count
FROM (
  SELECT "userId", "customId"
  FROM "Bookmark"
  GROUP BY "userId", "customId"
  HAVING COUNT(*) > 1
) dup;

SELECT 'Certificate.user_type_resource_duplicate_groups' AS check_name,
       COUNT(*) AS invalid_count
FROM (
  SELECT "userId", "type", "resourceId"
  FROM "Certificate"
  GROUP BY "userId", "type", "resourceId"
  HAVING COUNT(*) > 1
) dup;

-- JSONB integrity spot checks (expect 0 invalid_count)
SELECT 'Exam.questions_not_object_or_array' AS check_name,
       COUNT(*) AS invalid_count
FROM "Exam"
WHERE jsonb_typeof("questions") NOT IN ('object', 'array');

SELECT 'CourseTest.questions_not_object_or_array' AS check_name,
       COUNT(*) AS invalid_count
FROM "CourseTest"
WHERE jsonb_typeof("questions") NOT IN ('object', 'array');

SELECT 'Unit.content_not_object_or_array' AS check_name,
       COUNT(*) AS invalid_count
FROM "Unit"
WHERE jsonb_typeof("content") NOT IN ('object', 'array');

SELECT 'Organization.features_not_object' AS check_name,
       COUNT(*) AS invalid_count
FROM "Organization"
WHERE "features" IS NOT NULL
  AND jsonb_typeof("features") <> 'object';

SELECT 'Organization.contact_not_object' AS check_name,
       COUNT(*) AS invalid_count
FROM "Organization"
WHERE "contact" IS NOT NULL
  AND jsonb_typeof("contact") <> 'object';

SELECT 'Announcement.attachments_not_array' AS check_name,
       COUNT(*) AS invalid_count
FROM "Announcement"
WHERE jsonb_typeof("attachments") <> 'array';

SELECT 'BugReport.attachments_not_array' AS check_name,
       COUNT(*) AS invalid_count
FROM "BugReport"
WHERE jsonb_typeof("attachments") <> 'array';

-- Enum validity checks (expect 0)
SELECT 'User.role_invalid' AS check_name, COUNT(*) AS invalid_count
FROM "User"
WHERE "role"::text NOT IN ('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN');

SELECT 'Organization.plan_invalid' AS check_name, COUNT(*) AS invalid_count
FROM "Organization"
WHERE "plan"::text NOT IN ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

SELECT 'Organization.planStatus_invalid' AS check_name, COUNT(*) AS invalid_count
FROM "Organization"
WHERE "planStatus"::text NOT IN ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

SELECT 'BugReport.status_invalid' AS check_name, COUNT(*) AS invalid_count
FROM "BugReport"
WHERE "status"::text NOT IN ('OPEN', 'FIXED');