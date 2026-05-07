import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVocabAudioPath } from "@/lib/getAudioPath";
import type { UseAudioPlayerResult } from "@/hooks/useAudioPlayer";

export type ReviewWord = {
  id: string;
  nepali: string;
  romanized: string;
  korean: string;
  lessonId?: number | string;
  example?: any;
  exampleKo?: any;
};

function getExample(word: ReviewWord) {
  const ex = word.example;
  if (ex && typeof ex === "object") {
    return {
      nepali: typeof ex.nepali === "string" ? ex.nepali : "",
      romanized: typeof ex.romanized === "string" ? ex.romanized : "",
      korean:
        typeof ex.korean === "string"
          ? ex.korean
          : typeof word.exampleKo?.korean === "string"
            ? word.exampleKo.korean
            : "",
    };
  }
  if (typeof ex === "string" && ex.trim().length > 0) {
    return {
      nepali: ex,
      romanized: "",
      korean: typeof word.exampleKo === "string" ? word.exampleKo : "",
    };
  }
  return null;
}

function ReviewCard({
  lessonId,
  word,
  audioPlayer,
  onAutoPlay,
}: {
  lessonId: number | string;
  word: ReviewWord;
  audioPlayer: UseAudioPlayerResult;
  onAutoPlay?: () => void;
}) {
  // CSS 강제 초기화: Mount 시 무조건 앞면(rotate-y-0)에서 시작
  const [isFlipped, setIsFlipped] = useState(false);
  const example = useMemo(() => getExample(word), [word]);

  useEffect(() => {
    onAutoPlay?.();
    // mount-only (key remount로 단어 전환 시마다 새로 mount됨)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative h-64 w-full cursor-pointer [perspective:1000px]"
      onClick={() => setIsFlipped((v) => !v)}
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
              const actualLessonId = word.lessonId ?? lessonId;
              void audioPlayer.play(
                `review-modal-vocab-${actualLessonId}-${word.romanized}`,
                getVocabAudioPath(actualLessonId, word.romanized),
                { silentError: true },
              );
            }}
            className="absolute right-4 top-4 rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-accent"
            aria-label="단어 음성 재생"
          >
            <Volume2 className="h-5 w-5" />
          </button>
          <p className="text-4xl font-bold" style={{ fontFamily: "var(--font-nepali)" }}>
            {word.nepali}
          </p>
          <p className="mt-3 text-lg italic text-muted-foreground">{word.romanized}</p>
          <p className="absolute bottom-5 text-xs text-muted-foreground">터치하여 뒤집기</p>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-border bg-[#F5EBE0] p-6 text-center shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className={cn("flex w-full flex-col items-center justify-center", example ? "mb-auto mt-auto" : "my-auto")}>
            <p className="text-2xl font-bold text-[#333D29]">{word.korean}</p>
            <p className="mt-2 text-sm italic text-[#6B5D4F]">{word.romanized}</p>

            {example && (
              <div className="mt-3 w-full rounded-xl bg-background/60 p-3 text-left shadow-sm ring-1 ring-border/50">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground">예문</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const actualLessonId = word.lessonId ?? lessonId;
                      const itemId = `review-modal-example-${actualLessonId}-${word.romanized}`;
                      const src = `/audio/lesson_${actualLessonId}/${word.romanized}_example.mp3`;
                      void audioPlayer.play(itemId, src, { silentError: true });
                    }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                    aria-label="예문 음성 재생"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                  {example.nepali}
                </p>
                {example.romanized && <p className="mt-0.5 text-[11px] italic text-muted-foreground">{example.romanized}</p>}
                {example.korean && <p className="mt-1 text-xs text-foreground/80">{example.korean}</p>}
              </div>
            )}
          </div>

          <p className={cn("text-[#6B5D4F]/80 transition-all", example ? "mt-2 text-[10px]" : "absolute bottom-5 text-xs")}>
            터치하여 앞면으로
          </p>
        </div>
      </div>
    </div>
  );
}

export function ReviewStudyModal({
  open,
  onOpenChange,
  lessonId,
  data,
  audioPlayer,
  onKnown,
  onUnknown,
  title = "단어 복습",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: number | string;
  data: ReviewWord[];
  audioPlayer: UseAudioPlayerResult;
  onKnown?: (word: ReviewWord) => void;
  onUnknown?: (word: ReviewWord) => void;
  title?: string;
}) {
  const [displayData, setDisplayData] = useState<ReviewWord[]>(() => data);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [failedList, setFailedList] = useState<ReviewWord[]>([]);
  const lastAutoPlayedKeyRef = useRef<string | null>(null);

  const currentWord = displayData[currentIndex];
  const finished = isFinished || currentIndex === displayData.length;

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= displayData.length) setIsFinished(true);
      return next;
    });
  }, [displayData.length]);

  const handleUnknown = useCallback(() => {
    const word = currentWord;
    if (!word) return;
    // 오답 누적 (State Consistency)
    setFailedList((prev) => (prev.some((i) => i.id === word.id) ? prev : [...prev, word]));
    onUnknown?.(word);
    handleNext();
  }, [currentWord, handleNext, onUnknown]);

  const handleKnown = useCallback(() => {
    const word = currentWord;
    if (!word) return;
    onKnown?.(word);
    handleNext();
  }, [currentWord, handleNext, onKnown]);

  const handleRestart = useCallback(() => {
    // 재시작 로직 순서 엄수
    setDisplayData(failedList);
    setCurrentIndex(0);
    setIsFinished(false);
    setFailedList([]);
  }, [failedList]);

  // Dialog가 닫힐 때 세션 리셋(기본값으로 시작)
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (nextOpen) return;
      setDisplayData(data);
      setCurrentIndex(0);
      setIsFinished(false);
      setFailedList([]);
      lastAutoPlayedKeyRef.current = null;
    },
    [data, onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    setDisplayData(data);
    setCurrentIndex(0);
    setIsFinished(false);
    setFailedList([]);
    lastAutoPlayedKeyRef.current = null;
  }, [data, open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {finished ? "복습이 끝났습니다." : `(${currentIndex + 1} / ${displayData.length})`}
            </DialogDescription>
          </DialogHeader>

          {finished ? (
            <div className="mt-6 text-center">
              <p className="text-lg text-muted-foreground">이번 세션에서 ‘몰라요’를 누른 단어: {failedList.length}개</p>

              {failedList.length > 0 ? (
                <div className="mt-6 flex flex-col gap-3">
                  <Button type="button" onClick={handleRestart} className="h-12 rounded-2xl text-base font-bold">
                    미암기 단어 {failedList.length}개 다시 학습하기
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="h-12 rounded-2xl">
                    닫기
                  </Button>
                </div>
              ) : (
                <div className="mt-6">
                  <Button type="button" onClick={() => handleOpenChange(false)} className="h-12 rounded-2xl text-base font-bold">
                    닫기
                  </Button>
                </div>
              )}
            </div>
          ) : currentWord ? (
            <div className="mt-6">
              {/* Flicker Bug 해결: 단어 변경 시 카드 컴포넌트 강제 Remount */}
              <ReviewCard
                key={currentWord.id + currentIndex}
                lessonId={lessonId}
                word={currentWord}
                audioPlayer={audioPlayer}
                onAutoPlay={() => {
                  const actualLessonId = currentWord.lessonId ?? lessonId;
                  const autoKey = `review-auto-${actualLessonId}-${currentWord.romanized}`;
                  if (lastAutoPlayedKeyRef.current === autoKey) return;
                  lastAutoPlayedKeyRef.current = autoKey;
                  void audioPlayer.play(
                    autoKey,
                    getVocabAudioPath(actualLessonId, currentWord.romanized),
                    { silentError: true },
                  );
                }}
              />

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleUnknown}
                  className="flex-1 rounded-2xl bg-secondary py-4 text-sm font-bold text-secondary-foreground transition-all hover:bg-secondary/80 active:scale-95"
                >
                  몰라요
                </button>
                <button
                  type="button"
                  onClick={handleKnown}
                  className="flex-1 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
                >
                  알아요
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center">
              <p className="text-muted-foreground">복습할 단어가 없습니다.</p>
              <div className="mt-6">
                <Button type="button" onClick={() => handleOpenChange(false)} className="h-12 rounded-2xl">
                  닫기
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
