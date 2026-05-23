import type { Lesson } from "@/data/lesson";

const extraLessonModules = import.meta.glob("./lessons/extra_lesson_*.json", { import: "default" }) as Record<
  string,
  () => Promise<Lesson>
>;

export const availableExtraLessonIds = Object.keys(extraLessonModules)
  .map((k) => {
    const m = k.match(/extra_lesson_(\d+)\.json$/);
    return m ? Number(m[1]) : null;
  })
  .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  .sort((a, b) => a - b);

export async function loadExtraLesson(extraId: number): Promise<Lesson> {
  const key = `./lessons/extra_lesson_${extraId}.json`;
  const loader = extraLessonModules[key];
  if (!loader) {
    throw new Error(`Extra lesson JSON not found for extraId=${extraId} (expected ${key})`);
  }
  return await loader();
}

