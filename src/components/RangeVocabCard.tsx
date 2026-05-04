import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getVocabAudioPath } from "@/lib/getAudioPath";
import type { UseAudioPlayerResult } from "@/hooks/useAudioPlayer";
import { toast } from "sonner";

export type VocabStatus = "known" | "unknown" | "none";
type StudyFilter = "all" | "unknown" | "known";

type Vocabulary = {
  nepali: string;
  romanized: string;
  korean: string;
  lessonId?: number | string;
};

export function RangeVocabCard({
  lessonId,
  vocabulary,
  audioPlayer,
  onFinish,
}: {
  lessonId: string;
  vocabulary: Vocabulary[];
  audioPlayer: UseAudioPlayerResult;
  onFinish: () => void;
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

  const [filter, setFilter] = useState<StudyFilter>("all");
  const didAutoSetFilterRef = useRef(false);

  const [[currentIndex, direction], setPage] = useState([0, 0]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const romanizedCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of vocabulary) map.set(w.romanized, (map.get(w.romanized) ?? 0) + 1);
    return map;
  }, [vocabulary]);

  const getWordKey = useCallback(
    (word: Vocabulary) => `${word.lessonId ?? lessonId}::${word.romanized}`,
    [lessonId],
  );

  const getStatus = useCallback(
    (word: Vocabulary): VocabStatus => {
      const newKey = getWordKey(word);
      return statuses[newKey] ?? statuses[word.romanized] ?? "none";
    },
    [getWordKey, statuses],
  );

  const knownCount = useMemo(() => vocabulary.filter((w) => getStatus(w) === "known").length, [getStatus, vocabulary]);
  const unknownCount = useMemo(
    () => vocabulary.filter((w) => getStatus(w) !== "known").length,
    [getStatus, vocabulary],
  );

  const studyQueue = useMemo(() => {
    if (filter === "known") return vocabulary.filter((w) => getStatus(w) === "known");
    if (filter === "unknown") return vocabulary.filter((w) => getStatus(w) !== "known");
    return vocabulary;
  }, [filter, getStatus, vocabulary]);

  // 초기 진입 UX:
  // - unknown이 0이면 "전체" 기본
  // - unknown이 1+이면 "아직 몰라요" 탭을 기본으로 보여줌
  useEffect(() => {
    if (didAutoSetFilterRef.current) return;
    setFilter(unknownCount > 0 ? "unknown" : "all");
    didAutoSetFilterRef.current = true;
  }, [unknownCount]);

  // unknown이 0이 된 경우(학습 중 전부 외웠을 때) unknown 탭을 숨기며 "전체"로 복귀
  useEffect(() => {
    if (unknownCount === 0 && filter === "unknown") setFilter("all");
  }, [filter, unknownCount]);

  const currentWord = studyQueue[currentIndex];
  const currentStatus = currentWord ? getStatus(currentWord) : "none";
  const isKnown = currentStatus === "known";

  const isQueueEmpty = vocabulary.length > 0 && studyQueue.length === 0;
  const isAllKnown = vocabulary.length > 0 && knownCount === vocabulary.length;

  const play = audioPlayer.play;
  const lastAutoPlayedKeyRef = useRef<string | null>(null);

  const resetStatuses = () => {
    setStatuses({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    didAutoSetFilterRef.current = false;
    lastAutoPlayedKeyRef.current = null;
    setIsFinished(false);
    setIsFlipped(false);
    setPage([0, 0]);
    toast("학습 상태를 초기화했어요.", {
      duration: 2000,
      position: "top-center",
      className: "text-center",
    });
  };

  // 오디오 자동 재생 로직
  const playCurrentAudio = useCallback(() => {
    if (currentIndex >= studyQueue.length || !studyQueue[currentIndex]) return;
    const word = studyQueue[currentIndex];
    const actualLessonId = word.lessonId ?? lessonId;
    const itemId = `slide-vocab-${actualLessonId}-${word.romanized}`;
    const src = getVocabAudioPath(actualLessonId, word.romanized);
    void play(itemId, src, { silentError: true });
  }, [currentIndex, studyQueue, lessonId, play]);

  // 슬라이드가 넘어갈 때 오디오 자동 재생
  useEffect(() => {
    if (isFinished) return;
    if (currentIndex >= studyQueue.length || !studyQueue[currentIndex]) return;
    const word = studyQueue[currentIndex];
    const actualLessonId = word.lessonId ?? lessonId;
    const key = `${actualLessonId}::${word.romanized}`;
    if (lastAutoPlayedKeyRef.current === key) return;
    lastAutoPlayedKeyRef.current = key;
    playCurrentAudio();
  }, [currentIndex, isFinished, lessonId, playCurrentAudio, studyQueue]);

  const handleNext = useCallback(() => {
    if (currentIndex < studyQueue.length - 1) {
      setIsFlipped(false);
      setPage([currentIndex + 1, 1]);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, studyQueue.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setPage([currentIndex - 1, -1]);
    }
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const setStatus = (status: VocabStatus) => {
    if (!currentWord) return;
    const newKey = getWordKey(currentWord);
    const shouldWriteLegacy = (romanizedCounts.get(currentWord.romanized) ?? 0) === 1;
    setStatuses((prev) => ({
      ...prev,
      [newKey]: status,
      ...(shouldWriteLegacy ? { [currentWord.romanized]: status } : {}),
    }));
  };

  const handleMarkAndNext = (status: VocabStatus) => {
    if (!currentWord) return;
    setStatus(status);

    // "아직 몰라요/외웠어요" 탭에서는 현재 카드가 목록에서 사라질 수 있으므로,
    // 인덱스를 증가시키지 않고 같은 자리에서 다음 카드로 자연스럽게 이어갑니다.
    if (filter === "all") {
      handleNext();
      return;
    }

    setIsFlipped(false);
    const isLastBefore = currentIndex >= studyQueue.length - 1;
    // 현재 카드가 제거되면(필터 조건에 안 맞게 되면) 다음 카드는 같은 index로 당겨집니다.
    // 마지막 카드였다면 1개 줄어든 새 큐가 0개가 되거나, 이전 카드로 이동해야 합니다.
    if (studyQueue.length <= 1) {
      setIsFinished(true);
      return;
    }
    const nextIndex = isLastBefore ? Math.max(0, currentIndex - 1) : currentIndex;
    setPage([nextIndex, 1]);
  };

  useEffect(() => {
    // 필터 변경 시 학습 상태 초기화
    setIsFinished(false);
    setIsFlipped(false);
    setPage([0, 0]);
    lastAutoPlayedKeyRef.current = null;
  }, [filter]);

  // 키보드 조작 지원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, handleFlip, isFinished]);

  // 슬라이드 애니메이션 설정
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  // 전체 개수 == 외웠어요 개수면 전체 학습 완료 UI 노출
  if (isAllKnown) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border bg-card py-20 text-center shadow-sm sm:py-24">
        <div className="mb-6 text-6xl">🎉</div>
        <h2 className="mb-2 text-2xl font-bold text-foreground">학습 완료!</h2>
        <p className="mb-8 text-base text-muted-foreground">
          총 {vocabulary.length}개의 단어를 모두 “외웠어요”로 체크했어요.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={resetStatuses} size="lg" variant="secondary" className="rounded-xl px-7 shadow-sm">
            초기화하고 다시
          </Button>
          <Button onClick={onFinish} size="lg" className="rounded-xl px-8 shadow-sm">
            종료하고 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  // 전체 단어는 있으나, 현재 필터 큐가 비어있는 경우(=해당 탭 학습 완료)
  if (isQueueEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border bg-card py-20 text-center shadow-sm sm:py-24">
        <div className="mb-6 text-6xl">✅</div>
        <h2 className="mb-2 text-2xl font-bold text-foreground">이 탭의 학습이 끝났어요!</h2>
        <p className="mb-8 text-base text-muted-foreground">
          {filter === "unknown"
            ? "‘아직 몰라요’로 남아있는 단어가 없습니다."
            : "‘외웠어요’로 체크된 단어가 없습니다."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => setFilter("all")} size="lg" className="rounded-xl px-8 shadow-sm">
            전체로 보기
          </Button>
          <Button onClick={onFinish} size="lg" variant="secondary" className="rounded-xl px-8 shadow-sm">
            종료하고 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  // 단어 데이터가 비어있거나 로드되지 않은 경우 에러 방지 및 안내 화면 렌더링
  if (!vocabulary || vocabulary.length === 0 || !currentWord) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border bg-card py-20 text-center shadow-sm sm:py-24">
        <div className="mb-6 text-6xl">📭</div>
        <h2 className="mb-2 text-2xl font-bold text-foreground">
          {vocabulary.length === 0 ? "단어가 없어요!" : "이 필터에는 단어가 없어요!"}
        </h2>
        <p className="mb-8 text-base text-muted-foreground">
          {vocabulary.length === 0
            ? "선택한 레슨 범위에 학습할 단어가 포함되어 있지 않습니다."
            : "다른 탭(전체/아직 몰라요/외웠어요)으로 바꿔서 학습을 계속해보세요."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {vocabulary.length > 0 && (
            <Button onClick={() => setFilter("all")} size="lg" className="rounded-xl px-8 shadow-sm">
              전체로 보기
            </Button>
          )}
          <Button onClick={onFinish} size="lg" variant="secondary" className="rounded-xl px-8 shadow-sm">
            종료하고 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border bg-card py-20 text-center shadow-sm sm:py-24">
        <div className="mb-6 text-6xl">🎉</div>
        <h2 className="mb-2 text-2xl font-bold text-foreground">학습 완료!</h2>
        <p className="mb-8 text-base text-muted-foreground">
          {filter === "all" ? (
            <>
              총 {vocabulary.length}개의 단어 카드를 모두 확인했습니다.<br />
            </>
          ) : (
            <>
              이 탭에서 {studyQueue.length}개의 단어 카드를 모두 확인했습니다.<br />
            </>
          )}
          (외운 단어: <span className="font-semibold text-primary">{knownCount}</span>개)
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => setFilter("unknown")} size="lg" variant="secondary" className="rounded-xl px-7 shadow-sm">
            아직 몰라요 복습
          </Button>
          <Button onClick={() => setFilter("all")} size="lg" variant="secondary" className="rounded-xl px-7 shadow-sm">
            전체 다시 보기
          </Button>
          <Button onClick={onFinish} size="lg" className="rounded-xl px-8 shadow-sm">
            종료하고 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center">
      {/* 필터 탭 */}
      <div className="mb-4 w-full rounded-2xl border bg-card p-1 shadow-sm">
        <div className="flex w-full">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
              filter === "all" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            전체 <span className="ml-1 text-[11px] opacity-70">{vocabulary.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("unknown")}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
              filter === "unknown" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            아직 몰라요 <span className="ml-1 text-[11px] opacity-70">{unknownCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("known")}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
              filter === "known" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            외웠어요 <span className="ml-1 text-[11px] opacity-70">{knownCount}</span>
          </button>
        </div>
      </div>

      {/* 진행 상황 프로그레스 바 */}
      <div className="mb-5 w-full">
        <div className="mb-2 flex justify-between text-sm font-semibold text-muted-foreground">
          <span>진행 상황</span>
          <span className="text-primary">
            {currentIndex + 1} / {studyQueue.length}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${studyQueue.length > 0 ? ((currentIndex + 1) / studyQueue.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="mb-4 flex w-full justify-end">
        <Button type="button" variant="ghost" onClick={resetStatuses} className="h-9 rounded-xl px-3 text-xs">
          초기화
        </Button>
      </div>

      {/* 1:1 슬라이드 카드 영역 */}
      <div className="relative h-[18rem] w-full sm:h-[22rem]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
            className="absolute inset-0 h-full w-full"
          >
            <button
              type="button"
              onClick={handleFlip}
              className={cn(
                "relative h-full w-full select-none overflow-hidden rounded-[1.75rem] border-2 p-5 text-center shadow-md transition-all",
                "active:scale-[0.99]",
                isKnown ? "border-[#DDE3D2] bg-[#E8EDDF]" : "border-border bg-card",
              )}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  playCurrentAudio();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    playCurrentAudio();
                  }
                }}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-foreground transition-colors hover:bg-accent"
                aria-label="단어 음성 재생"
              >
                <Volume2 className="h-5 w-5" />
              </span>

              <div className="flex h-full flex-col items-center justify-center">
                {isFlipped ? (
                  <div className="animate-in fade-in duration-200">
                    <p className="text-2xl font-bold text-[#333D29] sm:text-3xl">{currentWord.korean}</p>
                    <p className="mt-3 text-sm italic text-[#6B5D4F] sm:text-base">{currentWord.romanized}</p>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-200">
                    <p
                      className="text-4xl font-bold text-[#333D29] sm:text-5xl"
                      style={{ fontFamily: "var(--font-nepali)" }}
                    >
                      {currentWord.nepali}
                    </p>
                    <p className="mt-3 text-base italic text-muted-foreground sm:text-lg">{currentWord.romanized}</p>
                  </div>
                )}
                <p className="mt-6 text-[11px] text-muted-foreground/70">터치하거나 스페이스바를 눌러 뒤집기</p>
              </div>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 학습 상태 업데이트 버튼 */}
      <div className="mt-5 grid w-full grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleMarkAndNext("unknown")}
          className={cn(
            "rounded-2xl py-3 text-sm font-bold transition-all active:scale-95",
            currentStatus === "unknown"
              ? "border border-destructive/30 bg-destructive/10 text-destructive"
              : "bg-secondary text-secondary-foreground hover:bg-accent",
          )}
        >
          ❓ 아직 몰라요
        </button>
        <button
          type="button"
          onClick={() => handleMarkAndNext("known")}
          className={cn(
            "rounded-2xl py-3 text-sm font-bold transition-all active:scale-95",
            currentStatus === "known"
              ? "border border-[#839665]/40 bg-[#839665]/20 text-[#54653e]"
              : "bg-secondary text-secondary-foreground hover:bg-accent",
          )}
        >
          ✅ 외웠어요
        </button>
      </div>

      {/* 슬라이드 네비게이션 컨트롤 */}
      <div className="mt-6 flex w-full items-center justify-between">
        <Button variant="ghost" onClick={handlePrev} disabled={currentIndex === 0} className="rounded-xl px-2">
          <ChevronLeft className="mr-1 h-5 w-5" /> 이전
        </Button>
        <span className="text-xs text-muted-foreground">키보드 ◀ / ▶</span>
        <Button variant="ghost" onClick={handleNext} className="rounded-xl px-2">
          {currentIndex < vocabulary.length - 1 ? "다음" : "완료"} <ChevronRight className="ml-1 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
