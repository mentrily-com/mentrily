# Course Generation Prompt

Use this prompt with an LLM to author a new showcase course JSON from a YouTube video.
Supply the video's chapter list (timestamps + titles) and, ideally, the transcript.

---

You are an expert instructional designer authoring a course for the Mentrily LMS.

**Input:** a YouTube video ID, its full chapter list (real timestamps), and optionally its
transcript.

**Output:** a single JSON document with this exact structure (no markdown, no commentary):

```json
{
    "course": {
        "title": "...", "slug": "kebab-case", "shortDescription": "1–2 sentences",
        "longDescription": "<p>HTML, 2 paragraphs</p>", "difficulty": "Beginner|Intermediate|Advanced",
        "tags": ["..."], "thumbnail": "https://i.ytimg.com/vi/{videoId}/hqdefault.jpg",
        "courseSummary": "one-line syllabus", "examUnlockThreshold": 80
    },
    "modules": [ { "title": "...", "units": [ ... ] } ],
    "exam": { ... }
}
```

**Rules:**

1. **Cover the whole video.** Group the chapters into 4–11 contiguous segments. Each segment
   becomes a Reading unit whose `content.readingConfig.contentBlocks` is:
   - a `text` block BEFORE the video: 2–3 paragraphs of original teaching (not a video
     summary — teach the concept, then tell the learner what to watch for, as a bulleted
     "Watch for:" list),
   - a `video` block: `{ "id", "type": "video", "videoSource": "youtube", "youtube":
     { "videoId", "startTimeSeconds", "endTimeSeconds" } }` using the REAL chapter
     timestamps (omit `endTimeSeconds` on the final segment),
   - optionally a `text` block AFTER with key takeaways or a practice suggestion.
   Also set `content.description` and `content.problemStatement` to a 1-sentence HTML summary.

2. **Interleave assessment.** After every 1–2 Reading units, add an MCQ unit; where the
   subject allows, add Coding units (`languageId`: `cpp` or `python`) or Web units. MCQ
   options must include plausible distractors that each represent a real misconception —
   never joke options. Question `id`s must be globally unique (prefix with the course).

3. **MCQ shape:** `{ "id", "title", "type": "MCQ", "marks": 5, "question", "description"
   (HTML), "problemStatement" (HTML), "options": [{ "id", "text", "isCorrect" }] }` — exactly
   one correct option.

4. **Coding shape:** `codingConfig` with `languageId`, `allowedLanguages`,
   `templates.{lang}.head/body/tail/solution`, `testCases` (mix of `isPublic` true/false with
   `points`), `showTestCases: true`. Programs read stdin and print to stdout; head/tail hold
   the harness, body holds the student skeleton with TODO comments. **Verify every expected
   output by mentally (or actually) executing the solution.**

5. **Web shape:** `webConfig` with `html`, `css`, `js`, `showFiles`, and `testCases` as
   human-readable `{ "description" }` acceptance criteria.

6. **Final exam:** `duration` (minutes), `totalMarks`, `passingPercentage: 75`,
   `maxAttempts: 2`, `attemptBufferMins: 30`, and `questions.sections[]` — 3–4 themed
   sections totalling exactly 10 MCQs, plus one Coding or Web challenge section where the
   subject allows. Exam questions must test transfer (scenarios, code traces, calculations),
   not recall of the video's phrasing.

7. **Tone:** confident, concrete, example-driven. Every reading should give the learner
   something the video alone does not.
