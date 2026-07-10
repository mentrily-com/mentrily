-- Records the IANA timezone (e.g. "America/New_York") the creator scheduled an
-- exam's startTime/endTime in. Those columns remain absolute UTC instants; this
-- is purely for display/labeling so international exams show a consistent,
-- explicitly-labeled scheduled time instead of an implicit browser/Nepal zone.

ALTER TABLE "Exam" ADD COLUMN "timeZone" TEXT;
