/**
 * Shrink a sections × items brief so it fits the plan's per-generation cap
 * (negative = unlimited). Trims items per section first, then sections.
 */
export function fitToQuestionLimit<T extends { sections: number; questionsPerSection: number }>(
    brief: T,
    maxQuestions: number,
): T {
    if (maxQuestions < 0 || brief.sections * brief.questionsPerSection <= maxQuestions) return brief;
    let { sections, questionsPerSection } = brief;
    while (sections * questionsPerSection > maxQuestions && questionsPerSection > 1) questionsPerSection--;
    while (sections * questionsPerSection > maxQuestions && sections > 1) sections--;
    return { ...brief, sections, questionsPerSection };
}
