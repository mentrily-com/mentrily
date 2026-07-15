# Mentrily Showcase Courses

Five platform-wide demo courses that showcase every Mentrily capability: YouTube segment
video lessons inside Reading units, MCQ quizzes, Judge0-graded coding challenges (C++ and
Python), live Web labs, and linked final exams.

## Contents

```
course-demo/
├── README.md                  ← you are here
├── generation-prompt.md       ← the LLM prompt used to author course JSON from a video
├── data/
│   ├── 01-modern-html-css.json
│   ├── 02-cpp-foundations.json
│   ├── 03-applied-ai.json
│   ├── 04-personal-finance-fintech.json
│   └── 05-graphic-design-visual-theory.json
└── seed.ts                    ← idempotent seeder
```

## The courses

| # | Course | Source video(s) | Showcases |
|---|--------|-----------------|-----------|
| 1 | Modern HTML & CSS (Beginner) | freeCodeCamp `mU6anWqZJcc` (11.5 h, 11 segments) | Web labs, Web exam challenge |
| 2 | C++ Programming Foundations (Intermediate) | freeCodeCamp `vLnPwxZdW4Y` (4 h, 6 segments) | Judge0 C++ with hidden test cases |
| 3 | Applied Artificial Intelligence (Intermediate) | freeCodeCamp `i_LwzRVP7bg` (3.9 h, 7 segments) | Python metric challenges (accuracy, MSE) |
| 4 | Personal Finance & FinTech (Beginner) | freeCodeCamp `EJHPltmAULA` (1.6 h, 7 segments) | Python compound-interest challenges |
| 5 | Graphic Design & Visual Theory (Beginner) | GCF `YqQx75OPRa0` `_2LLXnUdUIc` `sByzHoiYFX0` `a5KYlHNKQB8` | Whole-video lessons, CSS design lab |

All videos verified embeddable via YouTube oEmbed; all segment boundaries come from the
videos' real chapter timestamps. Thumbnails use `https://i.ytimg.com/vi/{id}/hqdefault.jpg`
(no hosting cost).

Every course has a linked final exam: **maxAttempts 2, passingPercentage 75**, 10 MCQs plus
one coding/web challenge where applicable, unlocked at 80% course completion.

## Data format

Each JSON file has three top-level keys:

- `course` — Course row fields (`title`, `slug`, `shortDescription`, `longDescription`,
  `difficulty`, `tags`, `thumbnail`, `courseSummary`, `examUnlockThreshold`).
- `modules[]` — each with `title` and `units[]`. A unit is `{ title, type, content }` where
  `type` ∈ `Reading | MCQ | Coding | Web` and `content` is stored verbatim in `Unit.content`
  (matching the shapes the learner player normalizes in
  `frontend/services/api/CourseService.ts`).
- `exam` — Exam row fields plus `questions.sections[]` (same question shapes as units).

### YouTube segment blocks

Video lessons live inside Reading units as content blocks (same mechanism as manually
uploaded videos in the course builder):

```json
{
    "id": "unique-block-id",
    "type": "video",
    "videoSource": "youtube",
    "youtube": {
        "videoId": "mU6anWqZJcc",
        "startTimeSeconds": 2424,
        "endTimeSeconds": 6370
    }
}
```

Omit `endTimeSeconds` to play through to the end. The player
(`frontend/app/components/Reading/YouTubeSegmentPlayer.tsx`) renders a
`youtube-nocookie.com` embed with `start`/`end` params, so only the given range plays.

### Coding questions

`codingConfig.templates.{lang}` uses `head` / `body` / `tail`; the runner concatenates all
three and compares stdout against `testCases[].output`, so author them as full
stdin→stdout programs (harness in head/tail, student work in body). `languageId` values
map to Judge0 in `backend/src/modules/code-execution/strategies/judge0.strategy.ts`
(`cpp` → 54, `python` → 71).

## Seeding

Courses are created **org-less and platform-wide** (`orgId: null`, `isVisible: true`,
`status: 'Published'`), so every learner sees them in the Browse tab
(`/dashboard/learner/browse`) and can self-enroll.

```bash
cd backend
DEMO_CREATOR_EMAIL=xisense001@gmail.com npm run seed:showcase
```

- `DEMO_CREATOR_EMAIL` (optional) picks the creator account; defaults to
  `xisense001@gmail.com`.
- The seeder is **idempotent**: it matches existing courses/exams by
  `findFirst({ slug, orgId: null })` (the `@@unique([slug, orgId])` constraint does NOT
  apply when `orgId` is NULL — Postgres treats NULLs as distinct), updates course/exam
  fields in place, and deletes + recreates modules/units so re-runs converge.
- Course ↔ exam linking (`Course.linkedExamId` ↔ `Exam.linkedCourseId`) is set on every run.

For production, run the same command with the prod `DATABASE_URL` in the backend env.
No migrations are required — `Unit.type` is a plain string and `Unit.content` is JSON.

## Authoring more courses

1. Pick an embed-allowed video (check: `curl "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>"` — HTTP 200 means embeddable, 401 means blocked).
2. Pull the chapter timestamps from the video description.
3. Use `generation-prompt.md` with the transcript/chapters to draft the course JSON.
4. Verify every coding test case by actually running the solution.
5. Drop the file in `data/` and re-run the seeder (it picks up all `data/*.json`).
