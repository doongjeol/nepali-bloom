import { useEffect, useState, useMemo, useCallback } from "react";
import { useDrivingMode, type VocabularyItem } from "@/hooks/useDrivingMode";
import { Play, Pause, ChevronLeft, ChevronRight, X, Car, BookOpen, MessageCircle, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrivingModePlayerProps {
  lessonId: string | number;
  vocabulary: (VocabularyItem & { type?: string })[];
  onClose: () => void;
}

export function DrivingModePlayer({ lessonId, vocabulary, onClose }: DrivingModePlayerProps) {
  const [sessionState, setSessionState] = useState<"setup" | "playing" | "finished">("setup");
  const [studyQueue, setStudyQueue] = useState<VocabularyItem[]>([]);
  const [failedItems, setFailedItems] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [ttsSpeed, setTtsSpeed] = useState(0.9);

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

  const handleSessionComplete = useCallback(() => {
    setSessionState("finished");
    if (failedItems.size > 0) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(`학습이 끝났습니다. 외우지 못한 ${failedItems.size}개의 단어를 다시 학습할까요?`);
        u.lang = "ko-KR";
        window.speechSynthesis.speak(u);
      }
    } else {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance("모든 단어를 마스터했습니다!");
        u.lang = "ko-KR";
        u.onend = () => {
          onClose();
        };
        window.speechSynthesis.speak(u);
      } else {
        onClose();
      }
    }
  }, [failedItems.size, onClose]);

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
  } = useDrivingMode(lessonId, studyQueue, { 
    ttsSpeed, 
    enableSwipe: false, // 좌우 터치 영역을 사용하므로 기존 스와이프 기능 충돌 방지
    onSessionComplete: handleSessionComplete 
  });

  useEffect(() => {
    if (sessionState === "playing") {
      // 약간의 지연을 주어 모달 애니메이션 및 tasks 생성이 완료된 후 재생되도록 함
      const timer = setTimeout(() => {
        play();
      }, 300);
      return () => clearTimeout(timer);
    }
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, studyQueue]);

  const getItemKey = (v: VocabularyItem, idx: number) => `${v.type}-${v.lessonId}-${v.romanized || idx}`;

  if (sessionState === "setup") {
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
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-bold text-foreground">음성(TTS) 읽기 속도</h2>
            <div className="flex gap-2">
              {[0.7, 0.9, 1.0, 1.2, 1.5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setTtsSpeed(speed)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-sm font-medium transition-colors",
                    ttsSpeed === speed ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <h2 className="mb-4 text-lg font-bold text-foreground">어떤 내용을 학습할까요?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "vocab", icon: BookOpen, label: "단어", desc: "단어와 뜻을 반복 재생합니다." },
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
            onClick={() => {
              void unlockAudio();
              setStudyQueue(filteredVocab);
              setFailedItems(new Set());
              setSessionState("playing");
            }}
            className="w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50"
          >
            {filteredVocab.length === 0 ? "학습할 항목을 선택해주세요" : `${filteredVocab.length}개 항목 학습 시작`}
          </button>
        </div>
      </div>
    );
  }

  if (sessionState === "finished") {
    const startRetrySession = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance("복습을 시작합니다");
        u.lang = "ko-KR";
        window.speechSynthesis.speak(u);
      }
      const nextQueue = studyQueue.filter((v, i) => failedItems.has(getItemKey(v, i)));
      setStudyQueue(nextQueue);
      setFailedItems(new Set());
      setSessionState("playing");
    };

    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6 text-center animate-in zoom-in-95 duration-300">
        <h2 className="mb-4 text-3xl font-bold text-foreground">학습 세션 종료</h2>
        {failedItems.size > 0 ? (
          <>
            <p className="mb-8 text-lg text-muted-foreground">
              외우지 못한 <span className="font-bold text-destructive">{failedItems.size}</span>개의 항목이 남았습니다.
            </p>
            <button 
              onClick={startRetrySession} 
              className="mb-4 rounded-2xl bg-primary px-8 py-6 text-2xl font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              다시 학습하기 (터치)
            </button>
            <button onClick={onClose} className="mt-4 text-sm text-muted-foreground underline underline-offset-4">
              종료하기
            </button>
          </>
        ) : (
          <>
            <div className="mb-6 text-6xl">🎉</div>
            <p className="mb-8 text-xl text-foreground">모든 항목을 마스터했습니다!</p>
            <button onClick={onClose} className="rounded-2xl bg-primary px-8 py-4 text-xl font-bold text-primary-foreground shadow-lg transition-transform active:scale-95">
              완료
            </button>
          </>
        )}
      </div>
    );
  }

  const handleMarkUnknown = () => {
    if (!currentWord) return;
    setFailedItems((prev) => new Set(prev).add(getItemKey(currentWord, currentWordIndex)));
    nextWord();
  };

  const handleMarkKnown = () => {
    if (!currentWord) return;
    setFailedItems((prev) => {
      const next = new Set(prev);
      next.delete(getItemKey(currentWord, currentWordIndex));
      return next;
    });
    nextWord();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-in fade-in duration-300">
      {/* Header */}
      <div className="relative z-50 flex items-center justify-between border-b bg-background/80 p-4 backdrop-blur-sm sm:p-6">
        <div className="flex items-center gap-2 font-bold text-primary">
          <Car className="h-6 w-6" />
          <span className="text-lg sm:text-xl">운전 모드</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border bg-secondary/50 px-2 py-1">
            <span className="pl-2 text-xs font-semibold text-muted-foreground">속도</span>
            <select
              value={ttsSpeed}
              onChange={(e) => setTtsSpeed(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-foreground outline-none"
            >
              <option value={0.7}>0.7x</option>
              <option value={0.9}>0.9x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.2}>1.2x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-accent"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div 
        className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-10"
      >
        {/* 좌/우 터치 오버레이 */}
        <div className="absolute inset-0 z-20 flex w-full">
          <button 
            type="button" 
            className="flex-1 outline-none transition-colors hover:bg-success/5 active:bg-success/10" 
            onClick={handleMarkKnown}
            aria-label="외웠음 (제외)"
          />
          <button 
            type="button" 
            className="flex-1 outline-none transition-colors hover:bg-destructive/5 active:bg-destructive/10" 
            onClick={handleMarkUnknown}
            aria-label="몰라요 (복습 목록 추가)"
          />
        </div>

        {/* 시각적 힌트 */}
        <div className="pointer-events-none absolute inset-0 z-10 flex w-full opacity-10 select-none">
          <div className="flex flex-1 items-center justify-center border-r border-foreground/10">
            <span className="text-3xl font-black tracking-widest text-success sm:text-5xl">외웠음<br/><span className="text-base sm:text-xl">Got it</span></span>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <span className="text-3xl font-black tracking-widest text-destructive sm:text-5xl">몰라요<br/><span className="text-base sm:text-xl">Keep</span></span>
          </div>
        </div>

        <div className="relative z-30 pointer-events-none flex max-w-full flex-col items-center">
          {currentWord ? (
            <div className="duration-300 animate-in fade-in">
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
              {studyQueue.length === 0 ? "학습할 항목이 없습니다." : "재생 대기 중..."}
            </div>
          )}

          <div className="flex min-h-12 items-center justify-center break-keep text-lg font-medium text-primary sm:text-xl">
            {currentTask?.description ?? ""}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-50 border-t bg-card p-6 pb-10 sm:p-10 sm:pb-12">
        <div className="mb-3 flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>
            {currentWordIndex + 1} / {studyQueue.length}
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
