import { useEffect, useMemo, useState } from "react";
import type { Lesson } from "@/data/lesson";
import { loadLessonsInRange } from "@/data/lessonLoader";
import { MAX_LESSON_ID, MIN_LESSON_ID } from "@/data/lessonsMeta";
import { clampLessonRange, mergeLessonsInRange, type LessonRange, type MergedLessonData } from "@/lib/lessonRange";

export function useLessonRangeData(
  range: LessonRange | null,
  opts: { minLessonId: number; maxLessonId: number } = { minLessonId: MIN_LESSON_ID, maxLessonId: MAX_LESSON_ID },
): { isLoading: boolean; error: string | null; data: MergedLessonData | null } {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);

  const start = range?.start ?? null;
  const end = range?.end ?? null;

  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (start === null || end === null) {
      setLessons(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const clamped = clampLessonRange({ start, end }, opts.minLessonId, opts.maxLessonId);
    setIsLoading(true);
    // eslint-disable-next-line no-console
    console.log("[useLessonRangeData] loading range:", clamped);

    void loadLessonsInRange(clamped.start, clamped.end)
      .then((loaded) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.log("[useLessonRangeData] loaded lessons:", loaded.length);
        setLessons(loaded);
        setIsLoading(false);
      })
      .catch((e) => {
        console.error("Failed to load lessons:", e);
        if (cancelled) return;
        setLessons(null);
        setError("레슨 데이터를 불러오지 못했어요.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [opts.maxLessonId, opts.minLessonId, start, end]);

  const data = useMemo(() => {
    if (start === null || end === null || !lessons) return null;
    const clamped = clampLessonRange({ start, end }, opts.minLessonId, opts.maxLessonId);
    return mergeLessonsInRange(lessons, clamped);
  }, [lessons, opts.maxLessonId, opts.minLessonId, start, end]);

  return { isLoading, error, data };
}
