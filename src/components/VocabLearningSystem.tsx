﻿import { useState, useEffect, useMemo } from "react";
import { Volume2, Pause, Check, RefreshCw, HelpCircle, CheckCircle, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getVocabAudioPath } from "@/lib/getAudioPath";
import type { UseAudioPlayerResult } from "@/hooks/useAudioPlayer";
import { toast } from "sonner";
import { ReviewStudyModal, type ReviewWord } from "@/components/ReviewStudyModal";
import { useBookmarks } from "@/hooks/useBookmarks";

export type VocabStatus = "known" | "unknown" | "none";

type Vocabulary = {
  nepali: string;
  romanized: string;
  korean: string;
  baseForm?: string;
  lessonId?: number | string;
  example?: any;
  exampleKo?: any;
};

function normalizeForSearch(raw: string) {
  return String(raw ?? "")
    .normalize("NFC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function matchesQuery(word: Vocabulary, rawQuery: string) {
  const q = normalizeForSearch(rawQuery);
  if (!q) return true;

  const nepali = normalizeForSearch(word.nepali);
  const romanized = normalizeForSearch(word.romanized);
  const korean = normalizeForSearch(word.korean);
  const baseForm = normalizeForSearch(word.baseForm ?? "");

  return nepali.includes(q) || romanized.includes(q) || korean.includes(q) || baseForm.includes(q);
}

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
  const bookmarks = useBookmarks();
  const storageKey = `nepali-bloom-vocab-status-${lessonId}`;
  // SSR hydration note:
  // - The useState initializer may run on the server (no localStorage) and the empty
  //   value can be locked in on refresh.
  // - Persisting immediately on mount can overwrite existing saved data.
  // Load after mount and persist only after that.
  const [statuses, setStatuses] = useState<Record<string, VocabStatus>>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasLoaded(false);
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        setStatuses({});
        setHasLoaded(true);
        return;
      }
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setStatuses({});
        setHasLoaded(true);
        return;
      }
      setStatuses(parsed as Record<string, VocabStatus>);
      setHasLoaded(true);
    } catch {
      setStatuses({});
      setHasLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(statuses));
    } catch {
      // ignore
    }
  }, [statuses, storageKey, hasLoaded]);

  const resetStatuses = () => {
    setStatuses({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setGridFlipped(new Set());
    setReviewData([]);
    setIsReviewOpen(false);
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
  const [query, setQuery] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewWord[]>([]);
  const [gridFlipped, setGridFlipped] = useState<Set<string>>(new Set());
  const [reviewBtnShake, setReviewBtnShake] = useState(false);

  const toggleGridFlip = (id: string) => {
    const next = new Set(gridFlipped);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setGridFlipped(next);
  };

  const toggleAllFlip = () => {
    if (visibleVocab.length === 0) return;
    const allKeys = visibleVocab.map((w) => `${w.lessonId ?? lessonId}-${w.romanized}`);
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

  const visibleVocab = useMemo(() => {
    return filteredVocab.filter((w) => matchesQuery(w, query));
  }, [filteredVocab, query]);

  const unknownWords = useMemo(() => {
    return vocabulary.filter((w) => statuses[w.romanized] === "unknown");
  }, [vocabulary, statuses]);

  const handleStartReview = () => {
    if (unknownWords.length === 0) {
      toast("현재 '아직 몰라요'로 체크된 단어가 없어요!", {
        duration: 3000,
        position: "top-center",
        className: "bg-[#E8EDDF] text-[#2F4F2F] border border-[#C9D3B8] shadow-lg",
      });
      return;
    }

    setFilter("unknown");
    const shuffled = [...unknownWords].sort(() => Math.random() - 0.5);
    setReviewData(
      shuffled.map((w, idx) => ({
        id: `${w.lessonId ?? lessonId}::${w.romanized || w.nepali || w.korean}::${idx}`,
        ...w,
      })),
    );
    setIsReviewOpen(true);
  };

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

      {/* 검색 */}
      <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색 (네팔어/로마자/뜻/원형)"
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* 단어장 그리드 영역 */}
      {visibleVocab.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          검색 결과가 없어요.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {visibleVocab.map((word) => {
          const actualLessonId = word.lessonId ?? lessonId;
          const uniqueKey = `${actualLessonId}-${word.romanized}`;
          const status = statuses[word.romanized] || "none";
          const isKnown = status === "known";
          const isUnknown = status === "unknown";
          const isCardFlipped = gridFlipped.has(uniqueKey);
          const itemId = `vocab-${actualLessonId}-${word.romanized}`;
          const src = getVocabAudioPath(actualLessonId, word.romanized);
          const isPlaying = audioPlayer.currentItemId === itemId && audioPlayer.isPlaying;
          const bookmarkId = `vocab:${actualLessonId}:${word.romanized}`;
          const bookmarked = bookmarks.isBookmarked(bookmarkId);

          return (
            <div
              key={uniqueKey}
              onClick={() => toggleGridFlip(uniqueKey)}
              className={cn(
                "group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition-all duration-300 sm:p-5",
                isKnown ? "border-[#DDE3D2] bg-[#E8EDDF]" : "bg-card hover:shadow-md"
              )}
            >
              <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    bookmarks.toggle({
                      id: bookmarkId,
                      kind: "vocab",
                      lessonId: actualLessonId,
                      nepali: word.nepali,
                      romanized: word.romanized,
                      korean: word.korean,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    });
                    toast(bookmarked ? "북마크에서 제거했어요." : "북마크에 저장했어요.", {
                      duration: 1500,
                      position: "top-center",
                      className: "text-center",
                    });
                  }}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground transition-colors hover:bg-accent",
                    bookmarked && "bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                  aria-label={bookmarked ? "북마크 해제" : "북마크"}
                >
                  <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void audioPlayer.play(itemId, src, { silentError: true });
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground transition-colors hover:bg-accent"
                  aria-label="단어 음성 재생"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>

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
                    {typeof word.baseForm === "string" && word.baseForm.trim() ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        원형: <span className="font-medium text-foreground/80">{word.baseForm}</span>
                      </p>
                    ) : null}
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
                    {typeof word.baseForm === "string" && word.baseForm.trim() ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        원형: <span className="font-medium text-foreground/80">{word.baseForm}</span>
                      </p>
                    ) : null}
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
      )}

      <ReviewStudyModal
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        lessonId={lessonId}
        data={reviewData}
        audioPlayer={audioPlayer}
        onKnown={(word) => setStatus(word.romanized, "known")}
        onUnknown={(word) => setStatus(word.romanized, "unknown")}
        title="단어 복습"
      />
    </div>
  );
}
