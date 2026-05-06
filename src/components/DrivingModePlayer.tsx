import { useEffect } from "react";
import { useDrivingMode, type VocabularyItem } from "@/hooks/useDrivingMode";
import { Play, Pause, ChevronLeft, ChevronRight, X, Car } from "lucide-react";

interface DrivingModePlayerProps {
  lessonId: string | number;
  vocabulary: VocabularyItem[];
  onClose: () => void;
}

export function DrivingModePlayer({ lessonId, vocabulary, onClose }: DrivingModePlayerProps) {
  const {
    isPlaying,
    currentTask,
    progress,
    currentWordIndex,
    currentWord,
    play,
    pause,
    stop,
    nextWord,
    prevWord,
    swipeHandlers,
  } = useDrivingMode(lessonId, vocabulary);

  useEffect(() => {
    play();
    return () => stop();
  }, [play, stop]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background" {...swipeHandlers}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4 sm:p-6">
        <div className="flex items-center gap-2 font-bold text-primary">
          <Car className="h-6 w-6" />
          <span className="text-lg sm:text-xl">운전 모드</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-accent"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-10">
        {currentWord ? (
          <div className="duration-300 animate-in fade-in">
            <p
              className="mb-4 text-5xl font-bold text-foreground sm:text-7xl"
              style={{ fontFamily: "var(--font-nepali)" }}
            >
              {currentWord.nepali}
            </p>
            <p className="mb-2 text-xl italic text-muted-foreground sm:text-2xl">
              {currentWord.romanized}
            </p>
            <p className="mb-8 text-2xl font-bold text-foreground/80 sm:text-3xl">
              {currentWord.korean}
            </p>
          </div>
        ) : (
          <div className="text-2xl font-bold text-muted-foreground">재생 대기 중...</div>
        )}

        <div className="flex h-12 items-center justify-center text-lg font-medium text-primary sm:text-xl">
          {currentTask?.description ?? ""}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t bg-card p-6 sm:p-10 pb-10 sm:pb-12">
        <div className="mb-3 flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>
            {currentWordIndex + 1} / {vocabulary.length}
          </span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="mb-8 h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
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
              onClick={play}
              className="rounded-full bg-primary p-6 text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95"
            >
              <Play className="translate-x-0.5 fill-current h-10 w-10" />
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