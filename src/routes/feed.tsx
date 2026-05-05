import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { LearningFeed } from "@/components/LearningFeed";
import { availableLessonIds, loadLesson } from "@/data/lessonLoader";
import type { Lesson } from "@/data/lesson";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "러닝 피드 — 네팔어 학습" },
      { name: "description", content: "인스타그램 스타일의 네팔어 학습 피드" },
      { property: "og:title", content: "러닝 피드 — 네팔어 학습" },
      { property: "og:description", content: "인스타그램 스타일의 네팔어 학습 피드" },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = availableLessonIds.slice(0, 10);
    Promise.all(ids.map((id) => loadLesson(id)))
      .then(setLessons)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b28471] border-t-transparent" />
      </div>
    );
  }

  return <LearningFeed lessons={lessons} />;
}
