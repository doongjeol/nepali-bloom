import type { Lesson } from "@/data/lesson";

export type LessonIndexItem = {
  id: number;
  title: string;
  titleKo: string;
  description?: string;
  counts?: {
    vocabulary?: number;
    examples?: number;
    grammar?: number;
    quiz?: number;
    dialogues?: number;
  };
};

import lessonsIndexJson from "./index.json";

export const lessonsIndex = lessonsIndexJson as LessonIndexItem[];

const lessonModules = import.meta.glob("./lessons/lesson_*.json", { import: "default" }) as Record<
  string,
  () => Promise<Lesson>
>;

export const availableLessonIds = Object.keys(lessonModules)
  .map((k) => {
    const m = k.match(/lesson_(\d+)\.json$/);
    return m ? Number(m[1]) : null;
  })
  .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  .sort((a, b) => a - b);

export async function loadLesson(id: number): Promise<Lesson> {
  const key = `./lessons/lesson_${id}.json`;
  const loader = lessonModules[key];
  if (!loader) {
    throw new Error(`Lesson JSON not found for id=${id} (expected ${key})`);
  }
  return await loader();
}

export async function loadLessons(ids: number[]): Promise<Lesson[]> {
  return await Promise.all(ids.map((id) => loadLesson(id)));
}

export async function loadLessonsInRange(start: number, end: number): Promise<Lesson[]> {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const ids = Array.from({ length: e - s + 1 }, (_, i) => s + i);
  const existingIds = ids.filter((id) => Boolean(lessonModules[`./lessons/lesson_${id}.json`]));
  const missingIds = ids.filter((id) => !lessonModules[`./lessons/lesson_${id}.json`]);
  if (missingIds.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[lessonLoader] missing lesson files:", missingIds);
  }
  if (existingIds.length === 0) {
    throw new Error(`No lesson JSON files found in range ${s}..${e}`);
  }
  return await loadLessons(existingIds);
}
