import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { availableExtraLessonIds, loadExtraLesson } from "@/data/extraLessonLoader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/extra-lessons/")({
  loader: async () => {
    const loaded = await Promise.all(availableExtraLessonIds.map((id) => loadExtraLesson(id).catch(() => null)));
    return loaded
      .map((l, idx) => ({ l, extraId: availableExtraLessonIds[idx]! }))
      .filter((x): x is { l: NonNullable<(typeof loaded)[number]>; extraId: number } => Boolean(x.l));
  },
  head: () => ({
    meta: [
      { title: "추가 레슨 - 네팔어 학습" },
      { name: "description", content: "기본 레슨 외 추가 학습 레슨" },
    ],
  }),
  component: ExtraLessonsPage,
});

function ExtraLessonsPage() {
  const list = Route.useLoaderData();

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="mb-6">
          <Link to="/" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 홈
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">추가 레슨</h1>
          <p className="mt-1 text-sm text-muted-foreground">기본 레슨 외에 별도로 추가된 레슨을 학습해요.</p>
        </div>

        {list.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 sm:p-12 text-center shadow-sm">
            <p className="text-sm sm:text-base text-muted-foreground">추가 레슨이 아직 없습니다.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:gap-3">
            {list.map(({ l, extraId }) => {
              const counts = {
                vocabulary: l.vocabulary?.length ?? 0,
                examples: l.examples?.length ?? 0,
                grammar: l.grammar?.length ?? 0,
                quiz: l.quiz?.length ?? 0,
                dialogues: l.dialogues?.length ?? 0,
              };
              return (
                <Link
                  key={extraId}
                  to="/extra-lessons/$extraLessonId"
                  params={{ extraLessonId: String(extraId) }}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4 shadow-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:shadow-md",
                  )}
                >
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-warm text-base sm:text-lg font-bold text-warm-foreground">
                    +
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-foreground break-words sm:truncate">{l.titleKo}</h2>
                    <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate">{l.title}</p>
                    {l.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground break-words leading-snug sm:text-sm">{l.description}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {counts.vocabulary > 0 && (
                        <span className="rounded-full border border-[#D7DEE8] bg-[#E2E8F0] px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide text-[#4A5568]">
                          단어 {counts.vocabulary}
                        </span>
                      )}
                      {counts.grammar > 0 && (
                        <span className="rounded-full border border-[#DDE3D2] bg-[#E8EDDF] px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide text-[#556B2F]">
                          문법 {counts.grammar}
                        </span>
                      )}
                      {counts.quiz > 0 && (
                        <span className="rounded-full border border-[#E9DED3] bg-[#F5EBE0] px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide text-[#8D7B68]">
                          퀴즈 {counts.quiz}
                        </span>
                      )}
                      {counts.dialogues > 0 && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] sm:text-xs font-medium text-secondary-foreground">
                          대화문 {counts.dialogues}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

