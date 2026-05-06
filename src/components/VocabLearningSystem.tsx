import { useState, useEffect, useMemo } from "react";
import { Check, Pause, Play, Volume2, X, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getExampleAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";
import type { UseAudioPlayerResult } from "@/hooks/useAudioPlayer";
import { toast } from "sonner";

export type VocabStatus = "known" | "unknown" | "none";

type Vocabulary = {
  nepali: string;
  romanized: string;
  korean: string;
  lessonId?: number | string;
  example?: unknown;
  exampleKo?: unknown;
  example_audio?: unknown;
  exampleAudioIndex?: unknown;
};

type ExampleLike = { nepali: string; romanized: string; korean: string };

function getExample(word: Vocabulary): ExampleLike | null {
  if (word.example && typeof word.example === "object") {
    const ex = word.example as Partial<ExampleLike>;
    if (typeof ex.nepali === "string" && typeof ex.korean === "string") {
      return {
        nepali: ex.nepali,
        romanized: typeof ex.romanized === "string" ? ex.romanized : "",
        korean: ex.korean,
      };
    }
  }

  if (typeof word.example === "string" && word.example.trim().length > 0) {
    return {
      nepali: word.example,
      romanized: "",
      korean: typeof word.exampleKo === "string" ? word.exampleKo : "",
    };
  }

  return null;
}

function getExampleAudio(word: Vocabulary, lessonId: number | string): string | null {
  if (typeof word.example_audio === "string" && word.example_audio.trim().length > 0) {
    return word.example_audio;
  }

  if (typeof word.exampleAudioIndex === "number" && Number.isFinite(word.exampleAudioIndex)) {
    return getExampleAudioPath(lessonId, word.exampleAudioIndex);
  }

  return null;
}

export function VocabLearningSystem({
  lessonId,
  vocabulary,
  audioPlayer,
}: {
  lessonId: number | string;
  vocabulary: Vocabulary[];
  audioPlayer: UseAudioPlayerResult;
}) {
  const storageKey = `nepali-bloom-vocab-status-${lessonId}`;
  const [statuses, setStatuses] = useState<Record<string, VocabStatus>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(statuses));
  }, [statuses, storageKey]);

  const resetStatuses = () => {
    setStatuses({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setGridFlipped(new Set());
    setReviewQueue([]);
    setFlashcardIdx(0);
    setIsFlipped(false);
    setIsFlashcardOpen(false);
    setFilter("all");
    toast("학습 상태를 초기화했어요.", {
      duration: 2000,
      position: "top-center",
      className: "text-center",
    });
  };

  const setStatus = (wordId: string, status: VocabStatus) => {
    setStatuses((prev) => ({ ...prev, [wordId]: status }));
  };

  const markAllKnown = () => {
    const next = { ...statuses };
    vocabulary.forEach((w) => {
      next[w.romanized] = "known";
    });
    setStatuses(next);
    toast("모든 단어를 '외웠어요'로 변경했어요.", {
      duration: 2000,
      position: "top-center",
      className: "text-center",
    });
  };

  const markAllUnknown = () => {
    const next = { ...statuses };
    vocabulary.forEach((w) => {
      next[w.romanized] = "unknown";
    });
    setStatuses(next);
    toast("모든 단어를 '몰라요'로 변경했어요.", {
      duration: 2000,
      position: "top-center",
      className: "text-center",
    });
  };

  const [filter, setFilter] = useState<"all" | "unknown" | "known">("all");
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Vocabulary[]>([]);
  const [reviewEntryQueue, setReviewEntryQueue] = useState<Vocabulary[]>([]);
  const [reviewList, setReviewList] = useState<Vocabulary[]>([]);
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewStage, setReviewStage] = useState<"study" | "summary">("study");
  const [gridFlipped, setGridFlipped] = useState<Set<string>>(new Set());
  const [reviewBtnShake, setReviewBtnShake] = useState(false);

  const toggleGridFlip = (id: string) => {
    const next = new Set(gridFlipped);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setGridFlipped(next);
  };

  const knownCount = vocabulary.filter((w) => statuses[w.romanized] === "known").length;
  const progress = vocabulary.length > 0 ? Math.round((knownCount / vocabulary.length) * 100) : 0;

  const filteredVocab = useMemo(() => {
    return vocabulary.filter((w) => {
      const st = statuses[w.romanized] || "none";
      if (filter === "known") return st === "known";
      if (filter === "unknown") return st !== "known";
      return true;
    });
  }, [vocabulary, statuses, filter]);

  const unknownWords = useMemo(() => {
    return vocabulary.filter((w) => (statuses[w.romanized] || "none") !== "known");
  }, [vocabulary, statuses]);

  const handleStartReview = () => {
    if (unknownWords.length === 0) {
      toast("현재 '몰라요'로 체크한 단어가 없어요.", {
        duration: 3000,
        position: "top-center",
        className: "bg-[#E8EDDF] text-[#2F4F2F] border border-[#C9D3B8] shadow-lg",
      });
      setFilter("all");
      setReviewBtnShake(true);
      window.setTimeout(() => setReviewBtnShake(false), 450);
      return;
    }

    setFilter("unknown");
    const entryQueue = [...unknownWords].sort(() => Math.random() - 0.5);
    setReviewEntryQueue(entryQueue);
    setReviewQueue(entryQueue);
    setReviewList([]);
    setFlashcardIdx(0);
    setIsFlipped(false);
    setReviewStage("study");
    setIsFlashcardOpen(true);
  };

  const handleFlashcardAnswer = (status: VocabStatus) => {
    const currentWord = reviewQueue[flashcardIdx];
    setStatus(currentWord.romanized, status);

    if (status === "unknown") {
      setReviewList((prev) => {
        if (prev.some((w) => w.romanized === currentWord.romanized)) return prev;
        return [...prev, currentWord];
      });
    }

    if (flashcardIdx < reviewQueue.length - 1) {
      setIsFlipped(false);
      setFlashcardIdx((c) => c + 1);
    } else {
      setIsFlipped(false);
      setReviewStage("summary");
    }
  };

  const currentReviewWord = reviewQueue[flashcardIdx];

  const closeReview = () => {
    setIsFlashcardOpen(false);
    setReviewStage("study");
    setReviewQueue([]);
    setReviewEntryQueue([]);
    setReviewList([]);
    setFlashcardIdx(0);
    setIsFlipped(false);
  };

  const restartReview = () => {
    // Restart returns to the set of "몰라요" words at the moment the session started,
    // even if the user marked some as "외웠어요" during the session.
    const nextQueue = [...reviewEntryQueue];
    if (nextQueue.length === 0) {
      setReviewQueue([]);
      setFlashcardIdx(0);
      setIsFlipped(false);
      setReviewStage("summary");
      return;
    }
    setReviewQueue(nextQueue);
    setReviewList([]);
    setFlashcardIdx(0);
    setIsFlipped(false);
    setReviewStage("study");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 상단 컨트롤바 + 진행률/필터 */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold text-foreground">학습 진행률</h3>
          <span className="text-sm font-semibold text-primary">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-[#839665] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full rounded-xl bg-secondary p-1 sm:w-auto">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
                filter === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              전체
            </button>
            <button
              onClick={() => setFilter("unknown")}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
                filter === "unknown"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              몰라요{" "}
            </button>
            <button
              onClick={() => setFilter("known")}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
                filter === "known"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              외웠어요{" "}
            </button>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button
              type="button"
              onClick={markAllUnknown}
              variant="outline"
              className="rounded-xl bg-background text-xs sm:text-sm"
            >
              모두 몰라요{" "}
            </Button>
            <Button
              type="button"
              onClick={markAllKnown}
              variant="outline"
              className="rounded-xl bg-background text-xs sm:text-sm"
            >
              모두 외웠어요
            </Button>
            <Button
              onClick={handleStartReview}
              className={cn("rounded-xl text-xs sm:text-sm", reviewBtnShake && "animate-shake")}
              variant="default"
            >
              <BrainCircuit className="mr-1.5 h-4 w-4" /> 몰라요 복습
            </Button>
            <Button
              type="button"
              onClick={resetStatuses}
              className="rounded-xl text-xs sm:text-sm"
              variant="secondary"
            >
              초기화{" "}
            </Button>
          </div>
        </div>
      </div>

      {/* 단어장 그리드 영역 */}
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {filteredVocab.map((word) => {
          const actualLessonId = word.lessonId ?? lessonId;
          const uniqueKey = `${actualLessonId}-${word.romanized}`;
          const status = statuses[word.romanized] || "none";
          const isKnown = status === "known";
          const isUnknown = status === "unknown";
          const isCardFlipped = gridFlipped.has(uniqueKey);
          const itemId = `vocab-${actualLessonId}-${word.romanized}`;
          const src = getVocabAudioPath(actualLessonId, word.romanized);
          const isPlaying = audioPlayer.currentItemId === itemId && audioPlayer.isPlaying;
          const example = getExample(word);
          const exampleAudioSrc = getExampleAudio(word, actualLessonId);
          const exampleItemId = `example-${actualLessonId}-${word.romanized}`;

          return (
            <div
              key={uniqueKey}
              onClick={() => toggleGridFlip(uniqueKey)}
              className={cn(
                "group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition-all duration-300 sm:p-5",
                isKnown ? "border-[#DDE3D2] bg-[#E8EDDF]" : "bg-card hover:shadow-md",
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void audioPlayer.play(itemId, src, { silentError: true });
                }}
                className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground transition-colors hover:bg-accent"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              {isKnown && (
                <div className="absolute -right-2 -top-2 z-10 animate-in zoom-in duration-300">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#839665] text-white shadow-sm">
                    <Check className="h-4 w-4" />
                  </div>
                </div>
              )}

              <div className="mb-4 min-h-[4.5rem]">
                <div
                  className={cn(
                    "transition-opacity duration-200 ease-in-out",
                    isCardFlipped ? "opacity-0 pointer-events-none" : "opacity-100",
                  )}
                  aria-hidden={isCardFlipped}
                >
                  <p
                    className={cn(
                      "text-xl font-bold sm:text-2xl",
                      isKnown ? "text-[#333D29]" : "text-foreground",
                    )}
                    style={{ fontFamily: "var(--font-nepali)" }}
                  >
                    {word.nepali}
                  </p>
                  <p className="mt-0.5 text-xs italic text-muted-foreground sm:text-sm">
                    {word.romanized}
                  </p>
                </div>

                <div
                  className={cn(
                    "transition-opacity duration-200 ease-in-out",
                    isCardFlipped ? "opacity-100" : "opacity-0 pointer-events-none",
                  )}
                  aria-hidden={!isCardFlipped}
                >
                  <p className="text-base font-semibold text-foreground sm:text-lg">
                    {word.korean}
                  </p>

                  {example && (
                    <div className="mt-3 border-t border-border/50 pt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          예문
                        </span>
                        {exampleAudioSrc && (
                          <button
                            type="button"
                            aria-label="예문 오디오 재생"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/60 text-foreground transition-colors hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              void audioPlayer.play(exampleItemId, exampleAudioSrc, {
                                silentError: true,
                              });
                            }}
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p
                        className="text-sm font-bold text-foreground"
                        style={{ fontFamily: "var(--font-nepali)" }}
                      >
                        {example.nepali}
                      </p>
                      {example.korean.trim().length > 0 && (
                        <p className="mt-1.5 text-xs text-foreground/80">{example.korean}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div
                className="mt-auto flex gap-2 border-t border-border/50 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setStatus(word.romanized, isUnknown ? "none" : "unknown")}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-semibold transition-all active:scale-95",
                    isUnknown
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-transparent bg-background/50 text-muted-foreground hover:bg-background",
                  )}
                >
                  몰라요{" "}
                </button>
                <button
                  onClick={() => setStatus(word.romanized, isKnown ? "none" : "known")}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-semibold transition-all active:scale-95",
                    isKnown
                      ? "border-[#839665]/30 bg-[#839665]/10 text-[#54653e]"
                      : "border-transparent bg-background/50 text-muted-foreground hover:bg-background",
                  )}
                >
                  외웠어요
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 몰라요 복습 모달 */}
      {isFlashcardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-[2rem] bg-background shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="text-sm font-semibold text-muted-foreground">
                {reviewStage === "study"
                  ? `몰라요 복습 (${flashcardIdx + 1} / ${reviewQueue.length})`
                  : "복습 결과"}
              </span>
              <button
                onClick={closeReview}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {reviewStage === "summary" && (
                <div className="rounded-3xl border bg-[#F5EBE0] p-6 text-center shadow-sm">
                  {reviewList.length === 0 ? (
                    <>
                      <div className="mb-2 text-4xl">🎉</div>
                      <p className="text-lg font-bold text-[#333D29]">
                        축하합니다! 모두 외우셨습니다!
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        이번 세션에서 “아직 몰라요”로 표시한 단어가 없어요.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-[#333D29]">세션이 끝났어요!</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        이번 세션에서 “아직 몰라요”로 표시한 단어:{" "}
                        <span className="font-semibold text-foreground">{reviewList.length}</span>개
                      </p>
                    </>
                  )}

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={restartReview}
                      className="rounded-2xl bg-secondary py-3 text-sm font-bold text-secondary-foreground transition-all hover:bg-secondary/80 active:scale-95"
                    >
                      다시 복습하기
                    </button>
                    <button
                      type="button"
                      onClick={closeReview}
                      className="rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
                    >
                      학습 종료
                    </button>
                  </div>
                </div>
              )}
              {reviewStage === "study" && (
                <>
                  <div
                    className="relative h-64 w-full cursor-pointer [perspective:1000px]"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 h-full w-full rounded-3xl transition-all duration-500 [transform-style:preserve-3d]",
                        isFlipped ? "[transform:rotateY(180deg)]" : "",
                      )}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-border bg-card p-6 text-center shadow-sm [backface-visibility:hidden]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const actualLessonId = currentReviewWord.lessonId ?? lessonId;
                            audioPlayer.play(
                              `modal-vocab-${actualLessonId}-${currentReviewWord.romanized}`,
                              getVocabAudioPath(actualLessonId, currentReviewWord.romanized),
                              { silentError: true },
                            );
                          }}
                          className="absolute right-4 top-4 rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-accent"
                        >
                          <Volume2 className="h-5 w-5" />
                        </button>
                        <p
                          className="text-4xl font-bold"
                          style={{ fontFamily: "var(--font-nepali)" }}
                        >
                          {currentReviewWord.nepali}
                        </p>
                        <p className="mt-3 text-lg italic text-muted-foreground">
                          {currentReviewWord.romanized}
                        </p>
                        <p className="absolute bottom-5 text-xs text-muted-foreground">
                          카드를 터치해 뒤집기
                        </p>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-border bg-[#F5EBE0] p-6 text-center shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                        <p className="text-3xl font-bold text-[#333D29]">
                          {currentReviewWord.korean}
                        </p>
                        <p className="mt-3 text-base italic text-[#6B5D4F]">
                          {currentReviewWord.romanized}
                        </p>
                        <p className="absolute bottom-5 text-xs text-[#6B5D4F]/80">
                          카드를 터치해 원래대로
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => handleFlashcardAnswer("unknown")}
                      className="flex-1 rounded-2xl bg-secondary py-4 text-sm font-bold text-secondary-foreground transition-all hover:bg-secondary/80 active:scale-95"
                    >
                      아직 몰라요
                    </button>
                    <button
                      onClick={() => handleFlashcardAnswer("known")}
                      className="flex-1 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
                    >
                      외웠어요
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
