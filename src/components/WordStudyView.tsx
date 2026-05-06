import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Lesson, Vocabulary } from "@/data/lesson";
import { FlashCard, type StudyWord } from "@/components/FlashCard";
import { Car } from "lucide-react";
import { DrivingModePlayer } from "@/components/DrivingModePlayer";

const STORAGE_KEY = "nepali-bloom:knewWords:v1";

function loadKnewSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveKnewSet(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {}
}

export function WordStudyView({
  lessons,
  range,
  className,
}: {
  lessons: Lesson[];
  range: { start: number; end: number };
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [knew, setKnew] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : loadKnewSet()));
  const [showDrivingMode, setShowDrivingMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveKnewSet(knew);
  }, [knew]);

  const items = useMemo(() => {
    const out: StudyWord[] = [];
    for (const lesson of lessons) {
      (lesson.vocabulary ?? []).forEach((word: Vocabulary, vocabIndex: number) => {
        out.push({
          id: `${lesson.id}:${vocabIndex}`,
          lessonId: lesson.id,
          vocabIndex,
          word,
        });
      });
    }
    return out;
  }, [lessons]);

  const drivingVocab = useMemo(() => {
    return items.map((item) => ({
      ...item.word,
      lessonId: item.lessonId,
      type: "vocab",
    }));
  }, [items]);

  const activeItems = useMemo(() => items.filter((it) => !knew.has(it.id)), [items, knew]);
  const totalCount = items.length;
  const remainingCount = activeItems.length;
  const learnedCount = totalCount - remainingCount;
  const progressPct = totalCount ? Math.round((learnedCount / totalCount) * 100) : 0;

  useEffect(() => {
    setIndex(0);
  }, [range.start, range.end, totalCount]);

  const current = activeItems[index] ?? null;

  const markKnew = () => {
    if (!current) return;
    setKnew((prev) => {
      const next = new Set(prev);
      next.add(current.id);
      return next;
    });
    setIndex((i) => Math.min(i, Math.max(0, activeItems.length - 2)));
  };

  const markNeedStudy = () => {
    if (!current) return;
    setIndex((i) => Math.min(activeItems.length - 1, i + 1));
  };

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(activeItems.length - 1, i + 1));

  return (
    <div className={cn("rounded-3xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">단어장 플래시카드</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            범위: <span className="font-semibold text-foreground">{range.start} ~ {range.end}</span> · 총 {totalCount}개
          </p>
        </div>
      <div className="flex flex-col items-end gap-2">
        <div className="text-xs text-muted-foreground">
          외웠어요: <span className="font-semibold text-foreground">{learnedCount}</span> / {totalCount} ({progressPct}%)
        </div>
        <button
          type="button"
          onClick={() => setShowDrivingMode(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 active:scale-95"
        >
          <Car className="h-4 w-4" />
          운전 모드
        </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="mt-6 rounded-2xl border bg-background p-6 text-sm text-muted-foreground">
          선택한 범위에 단어가 없어요.
        </div>
      ) : remainingCount === 0 ? (
        <div className="mt-6 rounded-2xl border bg-background p-6 text-sm text-muted-foreground">
          축하해요! 선택한 범위의 단어를 모두 “외웠어요”로 표시했어요.
          <div className="mt-3">
            <button
              type="button"
              className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all"
              onClick={() => setKnew(new Set())}
            >
              다시 시작하기
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <FlashCard key={current!.id} item={current!} />
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {index + 1} / {remainingCount} (남은 단어)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                disabled={index === 0}
                className={cn(
                  "rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground transition-all hover:bg-accent active:scale-[0.99]",
                  index === 0 && "opacity-60",
                )}
              >
                ← 이전
              </button>
              <button
                type="button"
                onClick={next}
                disabled={index >= remainingCount - 1}
                className={cn(
                  "rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground transition-all hover:bg-accent active:scale-[0.99]",
                  index >= remainingCount - 1 && "opacity-60",
                )}
              >
                다음 →
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={markNeedStudy}
              className="rounded-2xl border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
            >
              아직 몰라요
              
            </button>
            <button
              type="button"
              onClick={markKnew}
              className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
            >
              외웠어요
              
            </button>
          </div>
        </>
      )}

      {showDrivingMode && (
        <DrivingModePlayer
          lessonId={range.start}
          vocabulary={drivingVocab}
          onClose={() => setShowDrivingMode(false)}
        />
      )}
    </div>
  );
}
