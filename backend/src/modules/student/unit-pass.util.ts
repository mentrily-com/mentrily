// Server-side record that a learner's code passed every test case of a course
// Coding unit. Written by the code-execution submit path, read by submitUnit.
export const UNIT_PASS_TTL_SEC = 60 * 60;

export function unitPassKey(userId: string, unitId: string): string {
  return `unit-pass:${userId}:${unitId}`;
}
