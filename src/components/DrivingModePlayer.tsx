import { useEffect, useState, useMemo } from "react";
import { useDrivingMode, type VocabularyItem } from "@/hooks/useDrivingMode";
import { Play, Pause, ChevronLeft, ChevronRight, X, Car, BookOpen, MessageCircle, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrivingModePlayerProps {
  lessonId: string | number;
  vocabulary: (VocabularyItem & { type?: string })[];
  onClose: () => void;
}

export function DrivingModePlayer({ lessonId, vocabulary, onClose }: DrivingModePlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(["vocab", "grammar", "dialogue", "quiz"]));

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filteredVocab = useMemo(() => {
    return vocabulary.filter((v) => selectedTypes.has(v.type || "vocab"));
  }, [vocabulary, selectedTypes]);

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
  } = useDrivingMode(lessonId, filteredVocab);

  useEffect(() => {
    if (hasStarted) {
      play();
    }
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted]);

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-background p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Car className="h-6 w-6" />
            <span className="text-xl sm:text-2xl">운전 모드 설정</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-accent"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto pb-4">
          <h2 className="mb-4 text-lg font-bold text-foreground">어떤 내용을 학습할까요?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "vocab", icon: BookOpen, label: "단어", desc: "단어와 뜻을 반복 재생합니다." },
              { id: "grammar", icon: BookOpen, label: "문법", desc: "문법 설명과 예문을 재생합니다." },
              { id: "dialogue", icon: MessageCircle, label: "대화문", desc: "대화문 문장을 순서대로 재생합니다." },
              { id: "quiz", icon: FileQuestion, label: "퀴즈", desc: "퀴즈 문제와 정답을 재생합니다." },
            ].map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedTypes.has(opt.id);
              const count = vocabulary.filter((v) => (v.type || "vocab") === opt.id).length;

              return (
                <label
                  key={opt.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all",
                    isSelected ? "border-primary bg-primary/5" : "bg-card hover:bg-accent/50",
                    count === 0 && "opacity-50 grayscale"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={count === 0}
                    onChange={() => toggleType(opt.id)}
                    className="mt-0.5 h-5 w-5 rounded border-primary/50 text-primary accent-primary"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Icon className="h-4 w-4" /> {opt.label}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">{count}개</span>
                    </div>
                    <span className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {count === 0 ? "해당 항목이 없습니다." : opt.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-4">
          <button
            type="button"
            disabled={filteredVocab.length === 0}
            onClick={() => setHasStarted(true)}
            className="w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50"
          >
            {filteredVocab.length === 0 ? "학습할 항목을 선택해주세요" : `${filteredVocab.length}개 항목 학습 시작`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-in fade-in duration-300">
      {/* Header */}
      <div className="relative z-50 flex items-center justify-between border-b bg-background/80 p-4 backdrop-blur-sm sm:p-6">
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
      <div 
        className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-10"
        {...swipeHandlers}
      >
        {currentWord ? (
          <div className="max-w-full duration-300 animate-in fade-in">
            <p
              className="mb-4 break-keep text-4xl font-bold text-foreground sm:text-6xl"
              style={{ fontFamily: "var(--font-nepali)" }}
            >
              {currentWord.nepali}
            </p>
            <p className="mb-2 break-keep text-xl italic text-muted-foreground sm:text-2xl">
              {currentWord.romanized}
            </p>
            <p className="mb-8 break-keep text-2xl font-bold text-foreground/80 sm:text-3xl">
              {currentWord.korean}
            </p>
          </div>
        ) : (
          <div className="text-2xl font-bold text-muted-foreground">
            {filteredVocab.length === 0 ? "학습할 항목이 없습니다." : "재생 대기 중..."}
          </div>
        )}

        <div className="flex min-h-12 items-center justify-center break-keep text-lg font-medium text-primary sm:text-xl">
          {currentTask?.description ?? ""}
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-50 border-t bg-card p-6 pb-10 sm:p-10 sm:pb-12">
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