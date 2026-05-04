import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RangeSelector } from "@/components/RangeSelector";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import { cn } from "@/lib/utils";
import { MAX_LESSON_ID, MIN_LESSON_ID } from "@/data/lessonsMeta";

const MIN = MIN_LESSON_ID;
const MAX = MAX_LESSON_ID;

export const Route = createFileRoute("/study/dialogues")({
  validateSearch: (search: Record<string, unknown>) => {
    const startRaw = typeof search.start === "string" || typeof search.start === "number" ? Number(search.start) : undefined;
    const endRaw = typeof search.end === "string" || typeof search.end === "number" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(startRaw) ? startRaw : undefined,
      end: Number.isFinite(endRaw) ? endRaw : undefined,
    };
  },
  component: StudyDialoguesPage,
});

function StudyDialoguesPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const start = search.start;
  const end = search.end;
  const range = typeof start === "number" && typeof end === "number" ? { start, end } : null;

  const { isLoading, error, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });
  const [idx, setIdx] = useState(0);

  const slides = useMemo(() => {
    const dialogues = data?.dialogues ?? [];
    const flattened = dialogues.flatMap((d) => d.lines.map((l) => ({ title: d.title, ...l })));
    return flattened;
  }, [data?.dialogues]);

  const current = slides[idx] ?? null;
  const canPrev = idx > 0;
  const canNext = idx < slides.length - 1;

  // Debug logs for range selection issues
  // eslint-disable-next-line no-console
  console.log("[study.dialogues] search:", search, "range:", range);
  // eslint-disable-next-line no-console
  console.log("[study.dialogues] data:", {
    isLoading,
    error,
    lessons: data?.lessons.length ?? null,
    dialogues: data?.dialogues.length ?? null,
    slides: slides.length,
  });

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-6">
          <Link to="/study" search={{ start: search.start, end: search.end }} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 범위 학습
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">대화문</h1>
          <p className="mt-1 text-sm text-muted-foreground">범위 내 대화문을 슬라이드처럼 넘겨서 봐요.</p>
        </div>

        {!range && (
          <RangeSelector min={MIN} max={MAX} onSubmit={({ start, end }) => navigate({ search: { start, end } })} />
        )}

        {range && (
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              범위: <span className="font-semibold text-foreground">{range.start} ~ {range.end}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {slides.length ? idx + 1 : 0} / {slides.length}
            </div>
          </div>
        )}

        {isLoading && <LoadingSpinner />}
        {error && <div className="rounded-2xl border bg-card p-6 text-sm text-destructive shadow-sm">{error}</div>}

        {data && (
          slides.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground shadow-sm">선택한 범위에 대화문이 없어요.</div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{current?.title}</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">Speaker {current?.speaker}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => setIdx((v) => Math.max(0, v - 1))}
                    className={cn("rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all", !canPrev && "opacity-60")}
                  >
                    ← 이전
                  </button>
                  <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => setIdx((v) => Math.min(slides.length - 1, v + 1))}
                    className={cn("rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all", !canNext && "opacity-60")}
                  >
                    다음 →
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-background p-4">
                <p className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                  {current?.nepali}
                </p>
                <p className="mt-1 text-sm text-muted-foreground italic">{current?.romanized}</p>
                <p className="mt-2 text-sm text-foreground">{current?.korean}</p>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">키보드로도 넘길 수 있어요: ← / →</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
