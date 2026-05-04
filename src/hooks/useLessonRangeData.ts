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

  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (!range) {
      setLessons(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const clamped = clampLessonRange(range, opts.minLessonId, opts.maxLessonId);
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
        setError("?덉뒯 ?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲??");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [opts.maxLessonId, opts.minLessonId, range]);

  const data = useMemo(() => {
    if (!range || !lessons) return null;
    const clamped = clampLessonRange(range, opts.minLessonId, opts.maxLessonId);
    return mergeLessonsInRange(lessons, clamped);
  }, [lessons, opts.maxLessonId, opts.minLessonId, range]);

  return { isLoading, error, data };
}

