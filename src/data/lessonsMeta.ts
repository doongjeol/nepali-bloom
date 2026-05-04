import { lessonsIndex } from "@/data/lessonLoader";

export const MIN_LESSON_ID = 1;

const maxFromIndex = lessonsIndex.reduce((max, l) => (l.id > max ? l.id : max), MIN_LESSON_ID);

// Book goes up to 40 lessons. Keep UI range flexible even if data is incomplete.
export const MAX_LESSON_ID = Math.max(40, maxFromIndex);
