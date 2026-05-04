import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RangeSelector } from "@/components/RangeSelector";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import { RangeVocabCard } from "@/components/RangeVocabCard";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { cn } from "@/lib/utils";
import { MAX_LESSON_ID, MIN_LESSON_ID } from "@/data/lessonsMeta";

const MIN = MIN_LESSON_ID;
const MAX = MAX_LESSON_ID;

export const Route = createFileRoute("/study/vocab")({
  validateSearch: (search: Record<string, unknown>) => {
    const startRaw = typeof search.start === "string" || typeof search.start === "number" ? Number(search.start) : undefined;
    const endRaw = typeof search.end === "string" || typeof search.end === "number" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(startRaw) ? startRaw : undefined,
      end: Number.isFinite(endRaw) ? endRaw : undefined,
    };
  },
  component: StudyVocabPage,
});

function StudyVocabPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const [isLearningMode, setIsLearningMode] = useState(false);
  const start = search.start;
  const end = search.end;
  const range = typeof start === "number" && typeof end === "number" ? { start, end } : null;
  const audioPlayer = useAudioPlayer();

  // Auto-enter learning mode when query params exist
  useEffect(() => {
    if (range) setIsLearningMode(true);
  }, [range?.start, range?.end]);

  const { isLoading, error, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });
  const lessonTitles = useMemo(() => (data?.lessons ?? []).map((l) => l.titleKo ?? `Lesson ${l.id}`), [data?.lessons]);

  const allVocab = useMemo(() => {
    if (!data?.lessons) return [];
    return data.lessons.flatMap((l) =>
      (l.vocabulary ?? []).map((w) => ({ ...w, lessonId: l.id }))
    );
  }, [data?.lessons]);

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

        {!isLearningMode && (
          <RangeSelector
            min={MIN}
            max={MAX}
            onSubmit={({ start, end }) => {
              // eslint-disable-next-line no-console
              console.log("[study.vocab] submit:", { start, end });
              navigate({ search: { start, end } });
              setIsLearningMode(true);
            }}
          />
        )}

        {isLearningMode && range && (
          <div className="mb-4 rounded-3xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                범위: <span className="font-semibold text-foreground">{range.start} ~ {range.end}</span>
              </div>
              <button
                type="button"
                className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all"
                onClick={() => {
                  // eslint-disable-next-line no-console
                  console.log("[study.vocab] reset range");
                  navigate({ search: { start: undefined, end: undefined } });
                  setIsLearningMode(false);
                }}
              >
                범위 다시 정하기
              </button>
            </div>
            {lessonTitles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lessonTitles.map((t, i) => (
                  <span key={`${t}-${i}`} className="rounded-full border border-[#D7DEE8] bg-[#E2E8F0] px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide text-[#4A5568]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading && <LoadingSpinner />}
        {error && <div className="rounded-2xl border bg-card p-6 text-sm text-destructive shadow-sm">{error}</div>}

        {isLearningMode && range && data && (
          data.lessons.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground shadow-sm">
              선택한 범위에 레슨 데이터가 없어요. (현재 데이터: {data.range.start}~{data.range.end})
            </div>
          ) : (
          <RangeVocabCard
            lessonId={`range-${data.range.start}-${data.range.end}`}
            vocabulary={allVocab}
            audioPlayer={audioPlayer}
            onFinish={() => setIsLearningMode(false)}
          />
          )
        )}

        {isLearningMode && range && !data && !error && (
          <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground shadow-sm">
            학습 데이터를 준비 중입니다...
          </div>
        )}
      </main>
    </div>
  );
}
