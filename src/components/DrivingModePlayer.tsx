import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrivingMode, type VocabularyItem } from "@/hooks/useDrivingMode";
import { Bookmark, Car, ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookmarks } from "@/hooks/useBookmarks";
import type { BookmarkItem } from "@/lib/bookmarks";

interface DrivingModePlayerProps {
  lessonId: string | number;
  vocabulary: (VocabularyItem & { type?: string })[];
  onClose: () => void;
}

type Vote = "known" | "unknown";
type StudyMode = "select" | "word" | "dialogue";

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getWordId(lessonId: string | number, v: VocabularyItem) {
  return `${v.lessonId ?? lessonId}::${v.romanized || v.nepali || v.korean}`;
}

function getDrivingBookmarkId(lessonId: string | number, v: VocabularyItem): string | null {
  const baseLessonId = v.lessonId ?? lessonId;
  const type = v.type || "vocab";
  if (type === "dialogue") {
    if (typeof v.dIdx !== "number" || typeof v.lIdx !== "number") return null;
    return `dialogue:${baseLessonId}:${v.dIdx}:${v.lIdx}`;
  }
  if (!v.romanized) return null;
  return `vocab:${baseLessonId}:${v.romanized}`;
}

function buildDrivingBookmarkItem(lessonId: string | number, v: VocabularyItem): BookmarkItem | null {
  const id = getDrivingBookmarkId(lessonId, v);
  if (!id) return null;

  const baseLessonId = v.lessonId ?? lessonId;
  const now = Date.now();
  const type = v.type || "vocab";

  if (type === "dialogue") {
    const match = typeof v.korean === "string" ? v.korean.match(/^\[(.*?)\]\s*/) : null;
    const speaker = match?.[1] ?? undefined;
    const korean = typeof v.korean === "string" ? v.korean.replace(/^\[.*?\]\s*/, "") : v.korean;
    return {
      id,
      kind: "dialogue",
      lessonId: baseLessonId,
      createdAt: now,
      updatedAt: now,
      nepali: v.nepali,
      korean,
      romanized: v.romanized,
      speaker,
      dIdx: v.dIdx,
      lIdx: v.lIdx,
    };
  }

  return {
    id,
    kind: "vocab",
    lessonId: baseLessonId,
    createdAt: now,
    updatedAt: now,
    nepali: v.nepali,
    korean: v.korean,
    romanized: v.romanized,
  };
}

function unlockBrowserAutoplayBridge() {
  if (typeof window === "undefined") return;
  try {
    const a = new Audio();
    a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
    a.preload = "auto";
    a.muted = true;
    a.volume = 0;
    const p = a.play();
    if (p && typeof (p as any).catch === "function") (p as Promise<void>).catch(() => {});
    a.pause();
    a.currentTime = 0;
  } catch {
    // ignore
  }

  try {
    void window.speechSynthesis?.getVoices?.();
  } catch {
    // ignore
  }
}

export function DrivingModePlayer({ lessonId, vocabulary, onClose }: DrivingModePlayerProps) {
  const bookmarks = useBookmarks();
  // displayData
  const [displayData, setDisplayData] = useState<VocabularyItem[]>([]);
  const [failedList, setFailedList] = useState<Array<VocabularyItem & { id: string }>>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(0.9);
  const [studyMode, setStudyMode] = useState<StudyMode>("select");
  const [showRomanization, setShowRomanization] = useState(true);

  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vocabOnly = useMemo(() => vocabulary.filter((v) => (v.type || "vocab") === "vocab"), [vocabulary]);
  const dialogueOnly = useMemo(() => vocabulary.filter((v) => (v.type || "vocab") === "dialogue"), [vocabulary]);

  const {
    isPlaying,
    autoplayBlocked,
    currentTask,
    progress,
    currentWordIndex,
    currentWord,
    unlockAudio,
    play,
    pause,
    stop,
    nextWord,
    prevWord,
    jumpToWord,
    totalEstimatedMs,
    currentEstimatedMs,
  } = useDrivingMode(lessonId, displayData, {
    ttsSpeed,
    enableSwipe: false,
    studyMode: studyMode === "dialogue" ? "dialogue" : "word",
    onSessionComplete: () => {
      setIsFinished(true);
      // 종료는 마지막 클릭에서만 처리
    },
  });

  const isLastItem = displayData.length > 0 && currentWordIndex >= displayData.length - 1;

  // Auto-start guard: on some browsers (notably iOS Safari) play() must originate from a user gesture.
  // We still auto-start after displayData is set, but we avoid re-triggering if play was already kicked off.
  const didKickoffPlayRef = useRef(false);

  // 4) 코드 클린업: useEffect 내 중복 재생 방지 + cleanup에서 stop() 보장
  useEffect(() => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = null;

    if (displayData.length === 0 || isFinished) {
      stop();
      didKickoffPlayRef.current = false;
      return;
    }

    startTimerRef.current = setTimeout(() => {
      void unlockAudio();
      if (!didKickoffPlayRef.current) play();
    }, 200);

    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
      stop();
      didKickoffPlayRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayData, isFinished]);

  const handleVote = useCallback(
    (vote: Vote) => {
      if (!currentWord) return;

      // 클릭 시 현재 재생 즉시 정지 + 다음 오디오 중복 방지
      pause();
      void unlockAudio();

      if (vote === "unknown") {
        // 1) 오답 누적 로직 (함수형 업데이트 필수) - 요청 스니펫을 그대로 구현
        const currentWordWithId = { ...currentWord, id: getWordId(lessonId, currentWord) };
        setFailedList((prev) => {
          const exists = prev.find((i) => i.id === currentWordWithId.id);
          if (exists) return prev;
          const updated = [...prev, currentWordWithId];
          console.log("🔥 현재 오답 리스트 개수:", updated.length); // 반드시 로그로 확인 가능하게
          return updated;
        });
      }

      // 3) 세션 종료: 마지막 단어 클릭 시 isFinished=true
      if (isLastItem) {
        setIsFinished(true);
        return;
      }

      nextWord();
    },
    [currentWord, isLastItem, lessonId, nextWord, pause, unlockAudio],
  );

  const handleRestart = useCallback(() => {
    // 3) 다시 학습하기 데이터 교체: displayData <- failedList, failedList 비우기, 인덱스 0, isFinished=false
    console.log("[DrivingMode] handleRestart", { failedCount: failedList.length, currentIndex: currentWordIndex });
    stop();

    const nextData = failedList.map(({ id: _id, ...rest }) => rest);
    setDisplayData(nextData);
    setFailedList([]);
    setIsFinished(false);
  }, [currentWordIndex, failedList, stop]);

  // Setup (문법 UI 제거, 단어/예문 중심)
  if (studyMode === "select") {
    return (
      <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-background p-4 landscape:p-3" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mb-4 flex shrink-0 items-center justify-between landscape:mb-2">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Car className="h-6 w-6" />
            <span className="text-xl sm:text-2xl">드라이브 모드</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-accent"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 landscape:flex-row landscape:items-center landscape:gap-4">
          <button
            type="button"
            onClick={() => {
              unlockBrowserAutoplayBridge();
              void unlockAudio();
              setFailedList([]);
              setIsFinished(false);
              setStudyMode("word");
              setDisplayData(vocabOnly);
              // Kick off inside the user gesture; useDrivingMode will defer until tasks are ready if needed.
              didKickoffPlayRef.current = true;
              play();
            }}
            className="flex-1 rounded-3xl border bg-[#FFFDF9] px-6 py-6 text-left shadow-sm ring-1 ring-border/60 transition-colors hover:bg-accent/20 active:scale-[0.99] landscape:py-4"
          >
            <div className="text-2xl font-black tracking-tight text-foreground sm:text-3xl landscape:text-xl">단어만 듣기</div>
            <div className="mt-2 text-base font-semibold text-muted-foreground sm:text-lg landscape:mt-1 landscape:text-sm">단어 → 뜻</div>
            <div className="mt-1 text-sm text-muted-foreground">총 {vocabOnly.length}개</div>
          </button>

          <button
            type="button"
            onClick={() => {
              unlockBrowserAutoplayBridge();
              void unlockAudio();
              setFailedList([]);
              setIsFinished(false);
              setStudyMode("dialogue");
              setDisplayData(dialogueOnly);
              didKickoffPlayRef.current = true;
              play();
            }}
            className="flex-1 rounded-3xl border bg-[#FFFDF9] px-6 py-6 text-left shadow-sm ring-1 ring-border/60 transition-colors hover:bg-accent/20 active:scale-[0.99] landscape:py-4"
          >
            <div className="text-2xl font-black tracking-tight text-foreground sm:text-3xl landscape:text-xl">대화문만 듣기</div>
            <div className="mt-2 text-base font-semibold text-muted-foreground sm:text-lg landscape:mt-1 landscape:text-sm">네팔어 → 한국어 해석</div>
            <div className="mt-1 text-sm text-muted-foreground">총 {dialogueOnly.length}문장</div>
          </button>

          <div className="shrink-0 rounded-2xl border bg-[#FFFDF9] p-3 text-sm text-muted-foreground ring-1 ring-border/60 landscape:hidden">
            운전 중 사용을 고려해 텍스트/버튼이 크게 표시됩니다.
          </div>
        </div>
      </div>
    );
  }

  if (displayData.length === 0 && !isFinished) {
    return (
      <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-background p-4 landscape:p-3" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Car className="h-6 w-6" />
            <span className="text-xl sm:text-2xl">드라이브 모드</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-accent"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1">
          <h2 className="mb-3 text-lg font-bold text-foreground">TTS 속도</h2>
          <div className="mb-8 flex gap-2">
            {[0.7, 0.9, 1.0, 1.2, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => setTtsSpeed(speed)}
                className={cn(
                  "flex-1 rounded-xl border py-2 text-sm font-medium transition-colors",
                  ttsSpeed === speed ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground",
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">단어/대화문 전용 드라이브 모드입니다.</p>
        </div>

        <div className="border-t pt-4">
	          <button
	            type="button"
	            disabled={vocabOnly.length === 0}
	            onClick={() => {
	              unlockBrowserAutoplayBridge();
	              void unlockAudio();
	              setFailedList([]);
	              setIsFinished(false);
	              setDisplayData(studyMode === "dialogue" ? dialogueOnly : vocabOnly);
	              didKickoffPlayRef.current = true;
	              play();
	            }}
	            className="w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50"
	          >
            {studyMode === "dialogue"
              ? dialogueOnly.length === 0
                ? "학습할 대화문이 없습니다"
                : `${dialogueOnly.length}문장 듣기 시작`
              : vocabOnly.length === 0
                ? "학습할 단어가 없습니다"
                : `${vocabOnly.length}개 단어 학습 시작`}
          </button>
        </div>
      </div>
    );
  }

  // Finished (failedList.length 기반으로 UI 결정)
  if (isFinished) {
    return (
      <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background text-center" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <h2 className="mb-3 text-3xl font-bold text-foreground landscape:text-2xl">학습 종료</h2>

        {failedList.length > 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-4 px-6 landscape:gap-3">
            <p className="text-xl text-muted-foreground landscape:text-lg">미암기 {failedList.length}개가 남았습니다.</p>
            <button
              type="button"
              onClick={handleRestart}
              className="w-full max-w-md rounded-3xl bg-primary px-8 py-6 text-xl font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 landscape:py-4 landscape:text-lg"
            >
              미암기 복습하기
            </button>
            <button onClick={onClose} className="w-full max-w-md rounded-3xl border border-border px-8 py-4 text-lg font-semibold text-muted-foreground transition-transform active:scale-95 landscape:py-3 landscape:text-base">
              종료하기
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-4 px-6 landscape:gap-3">
            <p className="text-xl text-muted-foreground landscape:text-lg">모든 단어를 마스터했습니다! 🎉</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full max-w-md rounded-3xl bg-primary px-8 py-6 text-xl font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 landscape:py-4 landscape:text-lg"
            >
              완료
            </button>
          </div>
        )}
      </div>
    );
  }

  const dialogueSpeaker =
    studyMode === "dialogue" ? (currentWord?.korean?.match(/^\[(.*?)\]\s*/)?.[1] ?? null) : null;

  const dialogueKorean =
    studyMode === "dialogue" && currentWord?.korean ? currentWord.korean.replace(/^\[.*?\]\s*/, "") : null;

  const bookmarkId = useMemo(() => (currentWord ? getDrivingBookmarkId(lessonId, currentWord) : null), [currentWord, lessonId]);
  const isBookmarked = bookmarkId ? bookmarks.isBookmarked(bookmarkId) : false;
  const canBookmark = Boolean(currentWord && bookmarkId);

  const toggleBookmark = useCallback(() => {
    if (!currentWord) return;
    const item = buildDrivingBookmarkItem(lessonId, currentWord);
    if (!item) return;
    bookmarks.toggle(item);
  }, [bookmarks, currentWord, lessonId]);

  return (
    <div
      className="fixed inset-0 z-[100] h-[100dvh] overflow-hidden bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Full-screen overlay hit areas (must not cover header/control bar) */}
      <div className="absolute inset-0 z-30 grid grid-cols-2">
        <button
          type="button"
          onClick={() => handleVote("known")}
          aria-label={isLastItem ? "외웠어요 - 종료" : "외웠어요 - 다음"}
          className={cn(
            "relative h-full w-full outline-none",
            "bg-green-500/[0.03] active:bg-green-500/[0.06]",
          )}
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <span className="text-3xl font-black text-green-800/25 sm:text-4xl landscape:text-2xl">외웠어요</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => handleVote("unknown")}
          aria-label={isLastItem ? "몰라요 - 종료" : "몰라요 - 다음"}
          className={cn(
            "relative h-full w-full outline-none",
            "bg-red-500/[0.03] active:bg-red-500/[0.06]",
          )}
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <span className="text-3xl font-black text-red-800/25 sm:text-4xl landscape:text-2xl">몰라요</span>
          </div>
        </button>
      </div>

      {/* Header + progress (always visible) */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Car className="h-5 w-5" />
            <span className="text-base">드라이브</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleBookmark}
              disabled={!canBookmark}
              className={cn(
                "pointer-events-auto rounded-full bg-secondary/80 p-2 text-secondary-foreground backdrop-blur-sm transition-colors",
                canBookmark ? "hover:bg-accent" : "opacity-50",
              )}
              aria-label={isBookmarked ? "북마크 해제" : "북마크"}
              title={isBookmarked ? "북마크 해제" : "북마크"}
            >
              <Bookmark className={cn("h-5 w-5", isBookmarked && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={() => setShowRomanization(!showRomanization)}
              className="pointer-events-auto rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-secondary-foreground backdrop-blur-sm"
            >
              로마자 {showRomanization ? "숨기기" : "보기"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto rounded-full bg-secondary/80 p-2 text-secondary-foreground backdrop-blur-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="relative flex cursor-pointer items-center justify-center rounded bg-secondary/80 px-2 py-1 text-secondary-foreground transition-colors hover:bg-secondary">
                <select
                  value={currentWordIndex}
                  onChange={(e) => {
                    void unlockAudio();
                    jumpToWord(Number(e.target.value));
                  }}
                  className="absolute inset-0 w-full cursor-pointer opacity-0"
                >
                  {displayData.map((_, i) => (
                    <option key={i} value={i}>
                      {i + 1}번으로 이동
                    </option>
                  ))}
                </select>
                <span>
                  {currentWordIndex + 1} / {displayData.length}
                </span>
                <span className="ml-1 text-[10px] opacity-60">▼</span>
              </div>
              <span className="text-[11px] tabular-nums tracking-wider opacity-80">
                {formatTime(currentEstimatedMs)} / {formatTime(totalEstimatedMs)}
              </span>
            </div>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        {autoplayBlocked ? (
          <div className="mx-3 mb-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-2 text-center text-sm font-semibold text-destructive">
            재생이 차단되었습니다. 아래 ▶ 버튼을 눌러주세요.
          </div>
        ) : null}
      </div>

      {/* Center content (keeps room for bottom bar) */}
      <div className="pointer-events-none relative z-20 flex h-full flex-col items-center justify-center px-4 text-center pt-24 pb-28 sm:pt-28 sm:pb-32 landscape:pt-20 landscape:pb-24">
        {currentWord ? (
          <div className="animate-in fade-in duration-200">
            {studyMode === "dialogue" ? (
              <div className="w-full max-w-3xl">
                <div className="mb-3 flex items-center justify-center">
                  <div
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-lg font-black tracking-wide landscape:text-sm",
                      dialogueSpeaker === "A"
                        ? "border-[#C9B8A6] bg-[#FFFDF9] text-[#6B5D4F]"
                        : "border-[#C9B8A6] bg-[#FFFDF9] text-[#4B5563]",
                    )}
                  >
                    {dialogueSpeaker ? `Speaker ${dialogueSpeaker}` : "Dialogue"}
                  </div>
                </div>
                <p
                  className="mb-2 break-keep text-3xl font-black leading-tight text-foreground sm:text-4xl landscape:text-2xl"
                  style={{ fontFamily: "var(--font-nepali)" }}
                >
                  {currentWord.nepali}
                </p>
                {showRomanization && currentWord.romanized && (
                  <p className="mb-4 max-w-full break-words px-2 pb-0.5 text-lg font-bold italic leading-relaxed text-muted-foreground sm:text-xl landscape:text-base">
                    {currentWord.romanized}
                  </p>
                )}
                {dialogueKorean ? (
                  <p className="break-keep text-2xl font-black text-foreground/90 sm:text-3xl landscape:text-xl">
                    {dialogueKorean}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="w-full max-w-3xl">
                <p
                  className="mb-2 break-keep text-4xl font-black leading-tight text-foreground sm:text-5xl landscape:text-3xl"
                  style={{ fontFamily: "var(--font-nepali)" }}
                >
                  {currentWord.nepali}
                </p>
                {showRomanization && currentWord.romanized && (
                  <p className="mb-4 max-w-full break-words px-2 pb-0.5 text-xl font-bold italic leading-relaxed text-muted-foreground sm:text-2xl landscape:text-lg">
                    {currentWord.romanized}
                  </p>
                )}
                <p className="break-keep text-3xl font-black text-foreground/90 sm:text-4xl landscape:text-2xl">
                  {currentWord.korean}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-2xl font-bold text-muted-foreground">재생 준비 중...</div>
        )}

        <div className="mt-4 flex min-h-8 items-center justify-center break-keep text-base font-medium text-primary landscape:text-sm">
          {currentTask?.description ?? ""}
        </div>
      </div>

      {/* Bottom control bar (always visible, above overlay) */}
      <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none px-3 pb-3">
        <div className="pointer-events-auto flex items-center justify-center gap-2 rounded-2xl border bg-background/90 p-2 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => {
              void unlockAudio();
              prevWord();
            }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground transition-colors hover:bg-accent active:scale-95"
            aria-label="이전"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => {
              void unlockAudio();
              isPlaying ? pause() : play();
            }}
            className="inline-flex h-12 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
            aria-label={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 translate-x-0.5 fill-current" />}
          </button>

          <button
            type="button"
            onClick={() => {
              void unlockAudio();
              nextWord();
            }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground transition-colors hover:bg-accent active:scale-95"
            aria-label="다음"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
