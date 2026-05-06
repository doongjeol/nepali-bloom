﻿import { useState, useEffect, useMemo } from "react";
import { Volume2, X, BrainCircuit, Pause, Check, RefreshCw, HelpCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getVocabAudioPath } from "@/lib/getAudioPath";
import type { UseAudioPlayerResult } from "@/hooks/useAudioPlayer";
import { toast } from "sonner";

export type VocabStatus = "known" | "unknown" | "none";

type Vocabulary = {
  nepali: string;
  romanized: string;
  korean: string;
  lessonId?: number | string;
  example?: any;
  exampleKo?: any;
};

function getExample(word: any) {
  if (word.example && typeof word.example === "object") {
    return {
      nepali: word.example.nepali,
      romanized: typeof word.example.romanized === "string" ? word.example.romanized : "",
      korean: typeof word.example.korean === "string" ? word.example.korean : typeof word.exampleKo?.korean === "string" ? word.exampleKo.korean : "",
    };
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
    toast("학습 상태를 초기화했어요.", { duration: 2000, position: "top-center", className: "text-center" });
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
    toast("모든 단어를 '외웠어요'로 변경했습니다.", { duration: 2000, position: "top-center", className: "text-center" });
  };

  const markAllUnknown = () => {
    const next = { ...statuses };
    vocabulary.forEach((w) => {
      next[w.romanized] = "unknown";
    });
    setStatuses(next);
    toast("모든 단어를 '아직 몰라요'로 변경했습니다.", { duration: 2000, position: "top-center", className: "text-center" });
  };

  const [filter, setFilter] = useState<"all" | "unknown" | "known">("all");
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Vocabulary[]>([]);
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [gridFlipped, setGridFlipped] = useState<Set<string>>(new Set());
  const [reviewBtnShake, setReviewBtnShake] = useState(false);

  const toggleGridFlip = (id: string) => {
    const next = new Set(gridFlipped);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setGridFlipped(next);
  };

  const toggleAllFlip = () => {
    if (filteredVocab.length === 0) return;
    const allKeys = filteredVocab.map((w) => `${w.lessonId ?? lessonId}-${w.romanized}`);
    const allFlipped = allKeys.every((k) => gridFlipped.has(k));
    const next = new Set(gridFlipped);
    if (allFlipped) {
      allKeys.forEach((k) => next.delete(k));
    } else {
      allKeys.forEach((k) => next.add(k));
    }
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
      toast("현재 '몰라요'로 체크된 단어가 없어요!", {
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
    setReviewQueue([...unknownWords].sort(() => Math.random() - 0.5));
    setFlashcardIdx(0);
    setIsFlipped(false);
    setIsFlashcardOpen(true);
  };

  const handleFlashcardAnswer = (status: VocabStatus) => {
    const currentWord = reviewQueue[flashcardIdx];
    setStatus(currentWord.romanized, status);
    if (flashcardIdx < reviewQueue.length - 1) {
      setIsFlipped(false);
      setFlashcardIdx((c) => c + 1);
    } else {
      setIsFlashcardOpen(false);
    }
  };

  const currentReviewWord = reviewQueue[flashcardIdx];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 상단 컨트롤 바: 진행률 및 필터 */}
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
                filter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              전체
            </button>
            <button
              onClick={() => setFilter("unknown")}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
                filter === "unknown" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              공부 중
            </button>
            <button
              onClick={() => setFilter("known")}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
                filter === "known" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              마스터
            </button>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button
              type="button"
              onClick={toggleAllFlip}
              variant="outline"
              className="rounded-xl bg-background text-xs sm:text-sm gap-1"
            >
              모두 <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              onClick={handleStartReview}
              className={cn("rounded-xl text-xs sm:text-sm", reviewBtnShake && "animate-shake")}
              variant="default"
            >
              복습
            </Button>
            <Button
              type="button"
              onClick={markAllUnknown}
              variant="outline"
              className="rounded-xl bg-background text-xs sm:text-sm gap-1"
            >
              모두 <HelpCircle className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              onClick={markAllKnown}
              variant="outline"
              className="rounded-xl bg-background text-xs sm:text-sm gap-1"
            >
              모두 <CheckCircle className="h-3 w-3" />
            </Button>
            
            <Button type="button" onClick={resetStatuses} className="col-span-2 sm:col-auto rounded-xl text-xs sm:text-sm" variant="secondary">
              초기화
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

          return (
            <div
              key={uniqueKey}
              onClick={() => toggleGridFlip(uniqueKey)}
              className={cn(
                "group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition-all duration-300 sm:p-5",
                isKnown ? "border-[#DDE3D2] bg-[#E8EDDF]" : "bg-card hover:shadow-md"
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
                {isCardFlipped ? (
                  <div className="animate-in fade-in duration-300">
                    <p className="text-base font-semibold text-foreground sm:text-lg">{word.korean}</p>
                    <p className="mt-0.5 text-xs italic text-muted-foreground sm:text-sm">{word.romanized}</p>
                    {(() => {
                      const ex = getExample(word);
                      if (!ex) return null;
                      return (
                        <div className="mt-3 w-full rounded-xl bg-background/50 p-3 text-left ring-1 ring-border/50">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-muted-foreground">예문</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const actualLessonId = word.lessonId ?? lessonId;
                                const itemId = `vocab-example-${actualLessonId}-${word.romanized}`;
                                const src = `/audio/lesson_${actualLessonId}/${word.romanized}_example.mp3`;
                                void audioPlayer.play(itemId, src, { silentError: true });
                              }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                              aria-label="예문 음성 재생"
                            >
                              <Volume2 className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>{ex.nepali}</p>
                          {ex.romanized && <p className="mt-0.5 text-[11px] italic text-muted-foreground">{ex.romanized}</p>}
                          {ex.korean && <p className="mt-1 text-xs text-foreground/80">{ex.korean}</p>}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-300">
                    <p
                      className={cn("text-xl font-bold sm:text-2xl", isKnown ? "text-[#333D29]" : "text-foreground")}
                      style={{ fontFamily: "var(--font-nepali)" }}
                    >
                      {word.nepali}
                    </p>
                    <p className="mt-0.5 text-xs italic text-muted-foreground sm:text-sm">{word.romanized}</p>
                  </div>
                )}
              </div>

              <div className="mt-auto flex gap-2 border-t border-border/50 pt-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setStatus(word.romanized, isUnknown ? "none" : "unknown")}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-semibold transition-all active:scale-95",
                    isUnknown ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-transparent bg-background/50 text-muted-foreground hover:bg-background"
                  )}
                >
                  아직 몰라요
                </button>
                <button
                  onClick={() => setStatus(word.romanized, isKnown ? "none" : "known")}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-semibold transition-all active:scale-95",
                    isKnown ? "border-[#839665]/30 bg-[#839665]/10 text-[#54653e]" : "border-transparent bg-background/50 text-muted-foreground hover:bg-background"
                  )}
                >
                  외웠어요
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 플래시카드 집중 학습 모달 */}
      {isFlashcardOpen && currentReviewWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-[2rem] bg-background shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="text-sm font-semibold text-muted-foreground">단어 복습 ({flashcardIdx + 1} / {reviewQueue.length})</span>
              <button onClick={() => setIsFlashcardOpen(false)} className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="relative h-64 w-full cursor-pointer [perspective:1000px]" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={cn("absolute inset-0 h-full w-full rounded-3xl transition-all duration-500 [transform-style:preserve-3d]", isFlipped ? "[transform:rotateY(180deg)]" : "")}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-border bg-card p-6 text-center shadow-sm [backface-visibility:hidden]">
                    <button type="button" onClick={(e) => { e.stopPropagation(); const actualLessonId = currentReviewWord.lessonId ?? lessonId; audioPlayer.play(`modal-vocab-${actualLessonId}-${currentReviewWord.romanized}`, getVocabAudioPath(actualLessonId, currentReviewWord.romanized), { silentError: true }); }} className="absolute right-4 top-4 rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-accent"><Volume2 className="h-5 w-5" /></button>
                    <p className="text-4xl font-bold" style={{ fontFamily: "var(--font-nepali)" }}>{currentReviewWord.nepali}</p>
                    <p className="mt-3 text-lg italic text-muted-foreground">{currentReviewWord.romanized}</p>
                    <p className="absolute bottom-5 text-xs text-muted-foreground">터치하여 뒤집기</p>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-border bg-[#F5EBE0] p-6 text-center shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <p className="text-3xl font-bold text-[#333D29]">{currentReviewWord.korean}</p>
                    <p className="mt-3 text-base italic text-[#6B5D4F]">{currentReviewWord.romanized}</p>
                      {(() => {
                        const ex = getExample(currentReviewWord);
                        if (!ex) return null;
                        return (
                          <div className="mt-4 w-full rounded-xl bg-background/60 p-4 text-left shadow-sm ring-1 ring-border/50">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-bold text-muted-foreground">예문</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const actualLessonId = currentReviewWord.lessonId ?? lessonId;
                                  const itemId = `vocab-modal-example-${actualLessonId}-${currentReviewWord.romanized}`;
                                  const src = `/audio/lesson_${actualLessonId}/${currentReviewWord.romanized}_example.mp3`;
                                  void audioPlayer.play(itemId, src, { silentError: true });
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                                aria-label="예문 음성 재생"
                              >
                                <Volume2 className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>{ex.nepali}</p>
                            {ex.romanized && <p className="mt-1 text-[11px] italic text-muted-foreground">{ex.romanized}</p>}
                            {ex.korean && <p className="mt-1.5 text-xs text-foreground/80">{ex.korean}</p>}
                          </div>
                        );
                      })()}
                    <p className="absolute bottom-5 text-xs text-[#6B5D4F]/80">터치하여 앞면으로</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => handleFlashcardAnswer("unknown")} className="flex-1 rounded-2xl bg-secondary py-4 text-sm font-bold text-secondary-foreground transition-all hover:bg-secondary/80 active:scale-95">아직 몰라요</button>
                <button onClick={() => handleFlashcardAnswer("known")} className="flex-1 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95">외웠어요</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
