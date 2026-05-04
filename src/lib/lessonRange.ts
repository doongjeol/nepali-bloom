import type { Lesson, Vocabulary, Dialogue } from "@/data/lesson";

export type LessonRange = { start: number; end: number };

export function clampLessonRange(range: LessonRange, min: number, max: number): LessonRange {
  const start = Math.min(max, Math.max(min, Math.floor(range.start)));
  const end = Math.min(max, Math.max(min, Math.floor(range.end)));
  return start <= end ? { start, end } : { start: end, end: start };
}

export function getLessonsInRange(allLessons: Lesson[], range: LessonRange): Lesson[] {
  return allLessons.filter((l) => l.id >= range.start && l.id <= range.end);
}

export function mergeVocabulary(lessons: Lesson[]): Vocabulary[] {
  return lessons.flatMap((l) => l.vocabulary ?? []);
}

export function mergeDialogues(lessons: Lesson[]): Dialogue[] {
  return lessons.flatMap((l) => l.dialogues ?? []);
}

export type MergedLessonData = {
  range: LessonRange;
  lessons: Lesson[];
  vocabulary: Vocabulary[];
  dialogues: Dialogue[];
};

export function mergeLessonsInRange(allLessons: Lesson[], range: LessonRange): MergedLessonData {
  const lessons = getLessonsInRange(allLessons, range);
  return {
    range,
    lessons,
    vocabulary: mergeVocabulary(lessons),
    dialogues: mergeDialogues(lessons),
  };
}

