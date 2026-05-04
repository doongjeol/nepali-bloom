import { useEffect, useMemo, useState } from "react";
import type { Lesson } from "@/data/lesson";
import { clampLessonRange, mergeLessonsInRange, type LessonRange, type MergedLessonData } from "@/lib/lessonRange";

export function useLessonRangeData(
  range: LessonRange | null,
  opts: { minLessonId: number; maxLessonId: number } = { minLessonId: 1, maxLessonId: 37 },
): { isLoading: boolean; error: string | null; data: MergedLessonData | null } {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    import("@/data/lessons")
      .then((mod) => {
        if (cancelled) return;
        setAllLessons(mod.default as Lesson[]);
        setIsLoading(false);
      })
      .catch((e) => {
        console.error("Failed to load lessons:", e);
        if (cancelled) return;
        setError("레슨 데이터를 불러오지 못했습니다.");
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => {
    if (!range || !allLessons) return null;
    const clamped = clampLessonRange(range, opts.minLessonId, opts.maxLessonId);
    return mergeLessonsInRange(allLessons, clamped);
  }, [allLessons, opts.maxLessonId, opts.minLessonId, range]);

  return { isLoading, error, data };
}

