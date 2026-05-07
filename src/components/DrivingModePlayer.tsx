import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrivingMode, type VocabularyItem } from "@/hooks/useDrivingMode";
import { Car, ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrivingModePlayerProps {
  lessonId: string | number;
  vocabulary: (VocabularyItem & { type?: string })[];
  onClose: () => void;
}

type Vote = "known" | "unknown";
type StudyMode = "select" | "word" | "dialogue";

function getWordId(lessonId: string | number, v: VocabularyItem) {
  return `${v.lessonId ?? lessonId}::${v.romanized || v.nepali || v.korean}`;
}

export function DrivingModePlayer({ lessonId, vocabulary, onClose }: DrivingModePlayerProps) {
  // displayData
  const [displayData, setDisplayData] = useState<VocabularyItem[]>([]);
  const [failedList, setFailedList] = useState<Array<VocabularyItem & { id: string }>>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(0.9);
  const [studyMode, setStudyMode] = useState<StudyMode>("select");

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

  // 4) 코드 클린업: useEffect 내 중복 재생 방지 + cleanup에서 stop() 보장
  useEffect(() => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = null;

    if (displayData.length === 0 || isFinished) {
      stop();
      return;
    }

    startTimerRef.current = setTimeout(() => {
      void unlockAudio();
      play();
    }, 200);

    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
      stop();
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
              void unlockAudio();
              setFailedList([]);
              setIsFinished(false);
              setStudyMode("word");
              setDisplayData(vocabOnly);
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
              void unlockAudio();
              setFailedList([]);
              setIsFinished(false);
              setStudyMode("dialogue");
              setDisplayData(dialogueOnly);
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
      <div className="fixed inset-0 z-[100] flex flex-col bg-background p-4 sm:p-6">
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
              void unlockAudio();
              setFailedList([]);
              setIsFinished(false);
              setDisplayData(studyMode === "dialogue" ? dialogueOnly : vocabOnly);
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
        <h2 className="mb-4 text-4xl font-bold text-foreground sm:text-5xl">학습 종료</h2>

        {failedList.length > 0 ? (
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-6">
            <p className="text-2xl text-muted-foreground">미암기 {failedList.length}개가 남았습니다.</p>
            <button
              type="button"
              onClick={handleRestart}
              className="w-full max-w-md rounded-3xl bg-primary px-8 py-8 text-2xl font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              미암기 복습하기
            </button>
            <button onClick={onClose} className="w-full max-w-md rounded-3xl border border-border px-8 py-6 text-xl font-semibold text-muted-foreground transition-transform active:scale-95">
              종료하기
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-6">
            <p className="text-2xl text-muted-foreground">모든 단어를 마스터했습니다! 🎉</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full max-w-md rounded-3xl bg-primary px-8 py-8 text-2xl font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
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

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-background landscape:flex-row" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      {/* ── Content Area (top in portrait, left in landscape) ── */}
      <div className="relative flex flex-[4] flex-col items-center justify-center overflow-hidden landscape:flex-[5]">
        {/* Header overlay */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-3">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Car className="h-5 w-5" />
            <span className="text-base">드라이브</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Play/Pause small toggle */}
            <button
              type="button"
              onClick={() => { void unlockAudio(); isPlaying ? pause() : play(); }}
              className="rounded-full bg-secondary/80 p-2 text-secondary-foreground backdrop-blur-sm"
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-0.5 fill-current" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-secondary/80 p-2 text-secondary-foreground backdrop-blur-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress bar at top */}
        <div className="absolute top-14 left-3 right-3 z-40">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1">
            <span>{currentWordIndex + 1} / {displayData.length}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        {autoplayBlocked ? (
          <div className="absolute top-24 left-3 right-3 z-40 rounded-2xl border border-destructive/20 bg-destructive/5 p-2 text-center text-sm font-semibold text-destructive">
            재생이 차단되었습니다. ▶ 버튼을 눌러주세요.
          </div>
        ) : null}

        {/* Word content */}
        <div className="relative z-30 flex flex-col items-center px-4 text-center">
          {currentWord ? (
            <div className="animate-in fade-in duration-200">
              {studyMode === "dialogue" ? (
                <div className="w-full">
                  <div className="mb-3 flex items-center justify-center">
                    <div
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-lg font-black tracking-wide",
                        dialogueSpeaker === "A"
                          ? "border-[#C9B8A6] bg-[#FFFDF9] text-[#6B5D4F]"
                          : "border-[#C9B8A6] bg-[#FFFDF9] text-[#4B5563]",
                      )}
                    >
                      {dialogueSpeaker ? `Speaker ${dialogueSpeaker}` : "Dialogue"}
                    </div>
                  </div>
                  <p
                    className="mb-4 break-keep text-4xl font-black leading-tight text-foreground sm:text-5xl landscape:text-3xl"
                    style={{ fontFamily: "var(--font-nepali)" }}
                  >
                    {currentWord.nepali}
                  </p>
                  {dialogueKorean ? (
                    <p className="break-keep text-2xl font-black text-foreground/90 sm:text-3xl landscape:text-xl">{dialogueKorean}</p>
                  ) : null}
                </div>
              ) : (
                <>
                  <p
                    className="mb-4 break-keep text-5xl font-black leading-tight text-foreground sm:text-6xl landscape:text-4xl"
                    style={{ fontFamily: "var(--font-nepali)" }}
                  >
                    {currentWord.nepali}
                  </p>
                  <p className="break-keep text-3xl font-black text-foreground/90 sm:text-4xl landscape:text-2xl">{currentWord.korean}</p>
                </>
              )}
            </div>
          ) : (
            <div className="text-2xl font-bold text-muted-foreground">재생 준비 중...</div>
          )}

          <div className="mt-4 flex min-h-8 items-center justify-center break-keep text-base font-medium text-primary">
            {currentTask?.description ?? ""}
          </div>
        </div>
      </div>

      {/* ── Touch Sections (bottom in portrait, right in landscape) ── */}
      <div className="flex flex-[6] landscape:flex-[5] landscape:flex-col">
        {/* Known (left in portrait / top in landscape) */}
        <button
          type="button"
          className="flex flex-1 items-center justify-center bg-green-500/[0.07] outline-none transition-colors active:bg-green-500/20"
          onClick={() => handleVote("known")}
          aria-label={isLastItem ? "외웠어요 - 종료" : "외웠어요 - 다음"}
        >
          <span className="text-3xl font-bold text-green-700/50 sm:text-4xl">✓ 외웠어요</span>
        </button>

        {/* Unknown (right in portrait / bottom in landscape) */}
        <button
          type="button"
          className="flex flex-1 items-center justify-center bg-red-500/[0.07] outline-none transition-colors active:bg-red-500/20"
          onClick={() => handleVote("unknown")}
          aria-label={isLastItem ? "몰라요 - 종료" : "몰라요 - 다음"}
        >
          <span className="text-3xl font-bold text-red-700/50 sm:text-4xl">✗ 몰라요</span>
        </button>
      </div>
    </div>
  );
}
