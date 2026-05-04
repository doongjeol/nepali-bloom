import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { lessonsIndex, availableLessonIds, loadLesson } from "@/data/lessonLoader";
import { cn } from "@/lib/utils";
import { MAX_LESSON_ID } from "@/data/lessonsMeta";

export const Route = createFileRoute("/lessons/")({
  loader: async () => {
    // 각 레슨의 최신 JSON 데이터를 불러와 실제 개수를 실시간으로 동기화합니다.
    const loaded = await Promise.all(
      availableLessonIds.map((id) => loadLesson(id).catch(() => null))
    );
    const realCounts: Record<number, any> = {};
    loaded.forEach((l) => {
      if (l) {
        realCounts[l.id] = {
          vocabulary: l.vocabulary?.length || 0,
          examples: l.examples?.length || 0,
          grammar: l.grammar?.length || 0,
          quiz: l.quiz?.length || 0,
          dialogues: l.dialogues?.length || 0,
        };
      }
    });
    return realCounts;
  },
  head: () => ({
    meta: [
      { title: "레슨 목록 - 네팔어 학습" },
      { name: "description", content: `Basic Course in Spoken Nepali 기반 ${MAX_LESSON_ID}개 레슨` },
    ],
  }),
  component: LessonsPage,
});

function LessonsPage() {
  const realCounts = Route.useLoaderData();

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <h1 className="mb-1 sm:mb-2 text-2xl sm:text-3xl font-bold text-foreground">모든 레슨 목록</h1>
        <p className="mb-5 sm:mb-8 text-sm text-muted-foreground">
          Basic Course in Spoken Nepali · 총 {MAX_LESSON_ID}개 레슨
        </p>

        <div className="mb-4 sm:mb-6">
          <Link
            to="/study/pronunciation"
            className="group flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-muted-foreground">시작하기</div>
              <div className="mt-1 text-base font-bold text-foreground">발음 연습</div>
              <div className="mt-1 text-xs text-muted-foreground">
                네팔어 기초 발음(모음/자음)을 카드로 학습해요
              </div>
            </div>
            <div className="shrink-0 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground transition-colors group-hover:bg-accent">
              열기 →
            </div>
          </Link>
        </div>

        <div className="grid gap-2 sm:gap-3">
          {[...lessonsIndex].sort((a, b) => a.id - b.id).map((lesson) => {
            const baseCounts = lesson.counts ?? {};
            const counts = { ...baseCounts, ...(realCounts[lesson.id] ?? {}) };
            const hasContent =
              (counts.vocabulary ?? 0) > 0 ||
              (counts.examples ?? 0) > 0 ||
              (counts.grammar ?? 0) > 0 ||
              (counts.quiz ?? 0) > 0 ||
              (counts.dialogues ?? 0) > 0;
            const description = (lesson.description ?? "").trim();
            return (
              <Link
                key={lesson.id}
                to="/lessons/$lessonId"
                params={{ lessonId: String(lesson.id) }}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4 shadow-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-md",
                  !hasContent && "opacity-60",
                )}
              >
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-base sm:text-lg font-bold text-primary-foreground">
                  {lesson.id}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold text-foreground break-words sm:truncate">{lesson.titleKo}</h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate">{lesson.title}</p>
                  {description && (
                    <p className="mt-0.5 text-xs text-muted-foreground break-words leading-snug sm:text-sm">
                      {description}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(counts.vocabulary ?? 0) > 0 && (
                      <span className="rounded-full border border-[#D7DEE8] bg-[#E2E8F0] px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide text-[#4A5568] transition-colors hover:bg-[#D7DEE8]">
                      단어 {counts.vocabulary}
                      </span>
                    )}
                    {(counts.examples ?? 0) > 0 && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] sm:text-xs font-medium text-secondary-foreground">
                      예문 {counts.examples}
                      </span>
                    )}
                    {(counts.grammar ?? 0) > 0 && (
                      <span className="rounded-full border border-[#DDE3D2] bg-[#E8EDDF] px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide text-[#556B2F] transition-colors hover:bg-[#DDE3D2]">
                      문법 {counts.grammar}
                      </span>
                    )}
                    {(counts.quiz ?? 0) > 0 && (
                      <span className="rounded-full border border-[#E9DED3] bg-[#F5EBE0] px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide text-[#8D7B68] transition-colors hover:bg-[#E9DED3]">
                      퀴즈 {counts.quiz}
                      </span>
                    )}
                    {!hasContent && (
                      <span className="rounded-full border border-[#E9DED3] bg-[#F5EBE0] px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide text-[#8D7B68] transition-colors hover:bg-[#E9DED3]">
                      준비 중
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
