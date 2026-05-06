import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getVocabAudioPath } from "@/lib/getAudioPath";
import { MAX_LESSON_ID, MIN_LESSON_ID } from "@/data/lessonsMeta";
import { cn } from "@/lib/utils";
import type { Vocabulary } from "@/data/lesson";

const MIN = MIN_LESSON_ID;
const MAX = MAX_LESSON_ID;

type DrivingWord = Vocabulary & { lessonId: number };

export const Route = createFileRoute("/study/driving")({
  validateSearch: (search: Record<string, unknown>) => {
    const s = typeof search.start === "string" || typeof search.start === "number" ? Number(search.start) : undefined;
    const e = typeof search.end === "string" || typeof search.end === "number" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(s) ? s : undefined,
      end: Number.isFinite(e) ? e : undefined,
    };
  },
  component: DrivingModePage,
});

/* ─── Range Picker (shown before learning starts) ─── */
function DrivingRangePicker({ onSubmit }: { onSubmit: (s: number, e: number) => void }) {
  const [startText, setStartText] = useState("1");
  const [endText, setEndText] = useState("5");

  const submit = () => {
    const s = Number.parseInt(startText, 10);
    const e = Number.parseInt(endText, 10);
    if (!Number.isFinite(s) || !Number.isFinite(e) || s < MIN || e > MAX || s > e) return;
    onSubmit(s, e);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0f1117] px-6 text-white">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight">🚗 운전 모드</h1>
      <p className="mb-8 text-base text-white/60">학습할 레슨 범위를 선택하세요</p>

      <div className="grid w-full max-w-xs grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-white/50">시작</span>
          <input
            value={startText}
            onChange={(e) => setStartText(e.target.value)}
            type="number"
            min={MIN}
            max={MAX}
            inputMode="numeric"
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-white/40"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-white/50">종료</span>
          <input
            value={endText}
            onChange={(e) => setEndText(e.target.value)}
            type="number"
            min={MIN}
            max={MAX}
            inputMode="numeric"
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-white/40"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-8 w-full max-w-xs rounded-2xl bg-white px-6 py-4 text-lg font-bold text-[#0f1117] active:scale-95 transition-transform"
      >
        학습 시작
      </button>

      <Link to="/study" className="mt-6 text-sm text-white/40 hover:text-white/70 transition-colors">
        ← 범위 학습으로 돌아가기
      </Link>
    </div>
  );
}

/* ─── Main Driving UI ─── */
function DrivingModePage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const start = search.start;
  const end = search.end;
  const range = typeof start === "number" && typeof end === "number" ? { start, end } : null;

  const { isLoading, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });
  const audioPlayer = useAudioPlayer();

  const words = useMemo<DrivingWord[]>(() => {
    if (!data?.lessons) return [];
    return data.lessons.flatMap((l) =>
      (l.vocabulary ?? []).map((w) => ({ ...w, lessonId: l.id })),
    );
  }, [data?.lessons]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showKorean, setShowKorean] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = words[index] ?? null;
  const total = words.length;
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  // Play audio for current word
  const playAudio = useCallback(() => {
    if (!current) return;
    const itemId = `driving-${current.lessonId}-${current.romanized}`;
    const src = getVocabAudioPath(current.lessonId, current.romanized);
    void audioPlayer.play(itemId, src, { silentError: true });
  }, [current, audioPlayer]);

  // Auto-advance timer
  useEffect(() => {
    if (paused || !current || total === 0) return;

    // Play audio on each new word
    playAudio();
    setShowKorean(false);

    // Show Korean after 2s
    const koreanTimer = setTimeout(() => setShowKorean(true), 2000);

    // Move to next after 5s
    autoTimerRef.current = setTimeout(() => {
      setIndex((i) => (i < total - 1 ? i + 1 : i));
    }, 5000);

    return () => {
      clearTimeout(koreanTimer);
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [index, paused, current, total, playAudio]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const next = useCallback(() => {
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (!p) audioPlayer.stop();
      return !p;
    });
  }, [audioPlayer]);

  // If no range selected, show range picker
  if (!range) {
    return (
      <DrivingRangePicker
        onSubmit={(s, e) => navigate({ search: { start: s, end: e } })}
      />
    );
  }

  // Loading
  if (isLoading || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0f1117] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl animate-pulse">🚗</div>
          <p className="text-lg text-white/60">단어를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // No words
  if (total === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0f1117] px-6 text-white">
        <p className="mb-4 text-xl">선택한 범위에 단어가 없어요.</p>
        <button
          type="button"
          onClick={() => navigate({ search: { start: undefined, end: undefined } })}
          className="rounded-2xl bg-white/10 px-6 py-3 text-base font-semibold text-white"
        >
          범위 다시 선택
        </button>
      </div>
    );
  }

  // Finished
  if (index >= total) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0f1117] px-6 text-white">
        <div className="mb-4 text-6xl">🎉</div>
        <h2 className="mb-2 text-2xl font-bold">학습 완료!</h2>
        <p className="mb-8 text-base text-white/60">{total}개의 단어를 모두 학습했어요.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setIndex(0); setPaused(false); }}
            className="rounded-2xl bg-white px-6 py-3 text-base font-bold text-[#0f1117] active:scale-95 transition-transform"
          >
            처음부터 다시
          </button>
          <Link
            to="/study"
            className="rounded-2xl bg-white/10 px-6 py-3 text-base font-semibold text-white active:scale-95 transition-transform"
          >
            나가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[#0f1117] text-white select-none overflow-hidden">
      {/* Top bar: exit + status */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3">
        <Link
          to="/study"
          search={{ start, end }}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white/60 active:bg-white/20"
        >
          ✕ 나가기
        </Link>
        <div className="text-sm font-semibold text-white/50">
          {index + 1} / {total}
        </div>
        <button
          type="button"
          onClick={() => navigate({ search: { start: undefined, end: undefined } })}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white/60 active:bg-white/20"
        >
          범위 변경
        </button>
      </div>

      {/* Center: word display — tap to pause/resume */}
      <button
        type="button"
        onClick={togglePause}
        className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-6 active:bg-white/5 transition-colors landscape:gap-2"
      >
        {/* Paused indicator */}
        {paused && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="rounded-full bg-white/20 p-6 backdrop-blur-sm">
              <svg className="h-16 w-16 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Nepali word */}
        <p
          className="text-[clamp(2.5rem,10vw,5rem)] font-extrabold leading-tight tracking-wide"
          style={{ fontFamily: "var(--font-nepali)" }}
        >
          {current?.nepali}
        </p>

        {/* Romanized */}
        <p className="text-[clamp(1.25rem,4vw,2rem)] font-medium italic text-white/50">
          {current?.romanized}
        </p>

        {/* Korean meaning — fades in */}
        <p
          className={cn(
            "mt-2 text-[clamp(1.5rem,5vw,2.5rem)] font-bold text-amber-300 transition-all duration-700",
            showKorean ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          )}
        >
          {current?.korean}
        </p>

        {/* Lesson tag */}
        <p className="mt-4 text-sm text-white/30">
          Lesson {current?.lessonId}
        </p>
      </button>

      {/* Bottom: navigation buttons + progress */}
      <div className="relative z-20 flex flex-col">
        {/* Nav buttons */}
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            disabled={index === 0}
            className={cn(
              "flex items-center justify-center py-5 text-lg font-bold transition-all active:bg-white/10 landscape:py-4",
              "border-r border-white/10",
              index === 0 ? "text-white/20" : "text-white/70",
            )}
          >
            ◀ 이전
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            disabled={index >= total - 1}
            className={cn(
              "flex items-center justify-center py-5 text-lg font-bold transition-all active:bg-white/10 landscape:py-4",
              index >= total - 1 ? "text-white/20" : "text-white/70",
            )}
          >
            다음 ▶
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full bg-white/10">
          <div
            className="h-full bg-amber-400 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
