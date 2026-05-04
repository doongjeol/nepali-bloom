import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import lessonsData from "@/data/lesson_1.json";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lessons/")({
  head: () => ({
    meta: [
      { title: "레슨 목록 - 네팔어 학습" },
      { name: "description", content: "Basic Course in Spoken Nepali 기반 37개 레슨" },
    ],
  }),
  component: LessonsPage,
});

function LessonsPage() {
  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <h1 className="mb-1 sm:mb-2 text-2xl sm:text-3xl font-bold text-foreground">📚 레슨 목록</h1>
        <p className="mb-5 sm:mb-8 text-sm text-muted-foreground">
          Basic Course in Spoken Nepali · 총 37개 레슨
        </p>

        <div className="grid gap-2 sm:gap-3">
          {lessonsData.map((lesson) => {
            const hasContent = lesson.vocabulary.length > 0 || lesson.quiz.length > 0 || lesson.dialogues.length > 0;
            return (
              <Link
                key={lesson.id}
                to="/lessons/$lessonId"
                params={{ lessonId: String(lesson.id) }}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4 shadow-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-md",
                  !hasContent && "opacity-60"
                )}
              >
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-base sm:text-lg font-bold text-primary-foreground">
                  {lesson.id}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold text-foreground truncate">
                    {lesson.titleKo}
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate">
                    {lesson.title}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col sm:flex-row gap-1 sm:gap-1.5">
                  {lesson.vocabulary.length > 0 && (
                    <span className="rounded-full bg-warm/50 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-warm-foreground">
                      단어 {lesson.vocabulary.length}
                    </span>
                  )}
                  {lesson.quiz.length > 0 && (
                    <span className="rounded-full bg-nepali/10 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-nepali">
                      퀴즈 {lesson.quiz.length}
                    </span>
                  )}
                  {!hasContent && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] sm:text-xs text-muted-foreground">
                      준비 중
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
