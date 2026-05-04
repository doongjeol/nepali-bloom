import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RangeSelector } from "@/components/RangeSelector";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import type { Vocabulary } from "@/data/lesson";
import { cn } from "@/lib/utils";

const MIN = 1;
const MAX = 37;

export const Route = createFileRoute("/study/vocab")({
  validateSearch: (search: Record<string, unknown>) => {
    const start = typeof search.start === "string" ? Number(search.start) : undefined;
    const end = typeof search.end === "string" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(start) ? start : undefined,
      end: Number.isFinite(end) ? end : undefined,
    };
  },
  component: StudyVocabPage,
});

function StudyVocabPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const range = search.start && search.end ? { start: search.start, end: search.end } : null;

  const { isLoading, error, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });
  const [sortMode, setSortMode] = useState<"shuffle" | "korean">("shuffle");

  const vocab = useMemo(() => {
    const list = data?.vocabulary ?? [];
    if (sortMode === "korean") return [...list].sort((a, b) => a.korean.localeCompare(b.korean, "ko"));
    // shuffle
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }, [data?.vocabulary, sortMode]);

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-6">
          <Link to="/study" search={{ start: search.start, end: search.end }} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 범위 학습
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">단어장</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            범위 내 레슨 단어를 합쳐서 보여줘요.
          </p>
        </div>

        {!range && (
          <RangeSelector min={MIN} max={MAX} onSubmit={({ start, end }) => navigate({ search: { start, end } })} />
        )}

        {range && (
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              범위: <span className="font-semibold text-foreground">{range.start} ~ {range.end}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", sortMode === "shuffle" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}
                onClick={() => setSortMode("shuffle")}
              >
                랜덤(Shuffle)
              </button>
              <button
                type="button"
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", sortMode === "korean" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}
                onClick={() => setSortMode("korean")}
              >
                가나다순
              </button>
            </div>
          </div>
        )}

        {isLoading && <LoadingSpinner />}
        {error && <div className="rounded-2xl border bg-card p-6 text-sm text-destructive shadow-sm">{error}</div>}

        {data && (
          <div className="grid gap-2 sm:grid-cols-2">
            {vocab.map((w: Vocabulary, idx) => (
              <div key={idx} className="rounded-xl border bg-card p-4 shadow-sm">
                <p className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                  {w.nepali}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground italic">{w.romanized}</p>
                <p className="mt-1 text-sm text-foreground">{w.korean}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
