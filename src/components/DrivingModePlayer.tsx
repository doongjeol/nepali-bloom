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
    [currentWord, isLastItem, lessonId, nextWord, pause],
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

        <div className="flex flex-1 flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              void unlockAudio();
              setFailedList([]);
              setIsFinished(false);
              setStudyMode("word");
              setDisplayData(vocabOnly);
            }}
            className="flex-1 rounded-3xl border bg-[#FFFDF9] px-6 py-10 text-left shadow-sm ring-1 ring-border/60 transition-colors hover:bg-accent/20 active:scale-[0.99]"
          >
            <div className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">단어만 듣기</div>
            <div className="mt-3 text-lg font-semibold text-muted-foreground sm:text-xl">단어 → 뜻 → 예문</div>
            <div className="mt-2 text-sm text-muted-foreground">총 {vocabOnly.length}개</div>
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
            className="flex-1 rounded-3xl border bg-[#FFFDF9] px-6 py-10 text-left shadow-sm ring-1 ring-border/60 transition-colors hover:bg-accent/20 active:scale-[0.99]"
          >
            <div className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">대화문만 듣기</div>
            <div className="mt-3 text-lg font-semibold text-muted-foreground sm:text-xl">네팔어 → 한국어 해석</div>
            <div className="mt-2 text-sm text-muted-foreground">총 {dialogueOnly.length}문장</div>
          </button>

          <div className="rounded-2xl border bg-[#FFFDF9] p-4 text-sm text-muted-foreground ring-1 ring-border/60">
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
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6 text-center">
        <h2 className="mb-4 text-3xl font-bold text-foreground">학습 종료</h2>

        {failedList.length > 0 ? (
          <>
            <p className="mb-6 text-lg text-muted-foreground">미암기 {failedList.length}개가 남았습니다.</p>
            <button
              type="button"
              onClick={handleRestart}
              className="rounded-2xl bg-primary px-8 py-5 text-xl font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              미암기 복습하기
            </button>
            <button onClick={onClose} className="mt-4 text-sm text-muted-foreground underline underline-offset-4">
              종료하기
            </button>
          </>
        ) : (
          <>
            <p className="mb-6 text-lg text-muted-foreground">모든 단어를 마스터했습니다!</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-primary px-8 py-5 text-xl font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              완료
            </button>
          </>
        )}
      </div>
    );
  }

  const exampleText =
    currentWord?.example && typeof currentWord.example === "object"
      ? currentWord.example.nepali
      : typeof currentWord?.example === "string"
        ? currentWord.example
        : null;

  const dialogueSpeaker =
    studyMode === "dialogue" ? (currentWord?.korean?.match(/^\[(.*?)\]\s*/)?.[1] ?? null) : null;

  const dialogueKorean =
    studyMode === "dialogue" && currentWord?.korean ? currentWord.korean.replace(/^\[.*?\]\s*/, "") : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="relative z-50 flex items-center justify-between border-b bg-background/80 p-4 backdrop-blur-sm sm:p-6">
        <div className="flex items-center gap-2 font-bold text-primary">
          <Car className="h-6 w-6" />
          <span className="text-lg sm:text-xl">드라이브 모드</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-accent"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-10">
        <div className="absolute inset-0 z-20 flex w-full">
          <button
            type="button"
            className="flex-1 outline-none transition-colors hover:bg-success/5 active:bg-success/10"
            onClick={() => handleVote("known")}
            aria-label={isLastItem ? "외웠어요 - 종료" : "외웠어요 - 다음"}
          />
          <button
            type="button"
            className="flex-1 outline-none transition-colors hover:bg-destructive/5 active:bg-destructive/10"
            onClick={() => handleVote("unknown")}
            aria-label={isLastItem ? "몰라요 - 종료" : "몰라요 - 다음"}
          />
        </div>

        {/* 좌/우 터치 영역 안내 텍스트 (클릭 로직 영향 없도록 pointer-events-none) */}
        <div className="pointer-events-none absolute inset-0 z-20 flex w-full">
          <div className="flex flex-1 items-center justify-center">
            <span className="text-3xl font-bold text-slate-600 opacity-40 sm:text-4xl">외웠어요</span>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <span className="text-3xl font-bold text-slate-600 opacity-40 sm:text-4xl">몰라요</span>
          </div>
        </div>

        <div className="relative z-30 pointer-events-none flex max-w-full flex-col items-center">
          {currentWord ? (
            <div className="animate-in fade-in duration-200">
              {studyMode === "dialogue" ? (
                <div className="w-full max-w-4xl">
                  <div className="mb-4 flex items-center justify-center gap-3">
                    <div
                      className={cn(
                        "rounded-full border px-4 py-2 text-xl font-black tracking-wide sm:text-2xl",
                        dialogueSpeaker === "A"
                          ? "border-[#C9B8A6] bg-[#FFFDF9] text-[#6B5D4F]"
                          : "border-[#C9B8A6] bg-[#FFFDF9] text-[#4B5563]",
                      )}
                    >
                      {dialogueSpeaker ? `Speaker ${dialogueSpeaker}` : "Dialogue"}
                    </div>
                  </div>
                  <p
                    className="mb-6 break-keep text-5xl font-black text-foreground sm:text-7xl"
                    style={{ fontFamily: "var(--font-nepali)" }}
                  >
                    {currentWord.nepali}
                  </p>
                  {dialogueKorean ? (
                    <p className="mb-3 break-keep text-3xl font-black text-foreground/90 sm:text-4xl">{dialogueKorean}</p>
                  ) : null}
                </div>
              ) : (
                <>
                  <p
                    className="mb-6 break-keep text-5xl font-black text-foreground sm:text-7xl"
                    style={{ fontFamily: "var(--font-nepali)" }}
                  >
                    {currentWord.nepali}
                  </p>
                  <p className="mb-3 break-keep text-3xl font-black text-foreground/90 sm:text-4xl">{currentWord.korean}</p>
                </>
              )}
              {studyMode === "word" && exampleText ? (
                <p
                  className="mt-6 max-w-3xl break-keep rounded-2xl border bg-card p-5 text-xl font-semibold text-foreground sm:text-2xl"
                  style={{ fontFamily: "var(--font-nepali)" }}
                >
                  {exampleText}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="text-2xl font-bold text-muted-foreground">재생 준비 중...</div>
          )}

          <div className="mt-6 flex min-h-12 items-center justify-center break-keep text-lg font-medium text-primary sm:text-xl">
            {currentTask?.description ?? ""}
          </div>
        </div>
      </div>

      <div className="relative z-50 border-t bg-card p-6 pb-10 sm:p-10 sm:pb-12">
        <div className="mb-3 flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>
            {currentWordIndex + 1} / {displayData.length}
          </span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="mb-8 h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="flex items-center justify-center gap-6 sm:gap-10">
          <button
            type="button"
            onClick={prevWord}
            className="rounded-full bg-secondary p-4 text-secondary-foreground transition-colors hover:bg-accent active:scale-95"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>

          {isPlaying ? (
            <button
              type="button"
              onClick={pause}
              className="rounded-full bg-primary p-6 text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95"
            >
              <Pause className="h-10 w-10 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void unlockAudio();
                play();
              }}
              className="rounded-full bg-primary p-6 text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95"
            >
              <Play className="h-10 w-10 translate-x-0.5 fill-current" />
            </button>
          )}

          <button
            type="button"
            onClick={nextWord}
            className="rounded-full bg-secondary p-4 text-secondary-foreground transition-colors hover:bg-accent active:scale-95"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
