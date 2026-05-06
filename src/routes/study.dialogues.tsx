import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RangeSelector } from "@/components/RangeSelector";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import { cn } from "@/lib/utils";
import { MAX_LESSON_ID, MIN_LESSON_ID } from "@/data/lessonsMeta";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getVocabAudioPath, getDialogueAudioPath } from "@/lib/getAudioPath";
import { CheckCircle2, XCircle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN = MIN_LESSON_ID;
const MAX = MAX_LESSON_ID;

type RangeQuizLine = {
  lessonId: number;
  dIdx: number;
  lIdx: number;
  korean: string;
  nepali: string;
  romanized: string;
  parsedWords: { id: string; word: string }[];
};

type WordToken = {
  id: string;
  word: string;
};

export const Route = createFileRoute("/study/dialogues")({
  validateSearch: (search: Record<string, unknown>) => {
    const startRaw = typeof search.start === "string" || typeof search.start === "number" ? Number(search.start) : undefined;
    const endRaw = typeof search.end === "string" || typeof search.end === "number" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(startRaw) ? startRaw : undefined,
      end: Number.isFinite(endRaw) ? endRaw : undefined,
    };
  },
  component: StudyDialoguesPage,
});

function StudyDialoguesPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const start = search.start;
  const end = search.end;
  const range = typeof start === "number" && typeof end === "number" ? { start, end } : null;

  const { isLoading, error, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });
  const [idx, setIdx] = useState(0);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const audioPlayer = useAudioPlayer();

  const slides = useMemo(() => {
    if (!data?.lessons) return [];
    return data.lessons.flatMap(lesson =>
      (lesson.dialogues ?? []).map((d, dIdx) => ({
        lessonId: lesson.id,
        dIdx,
        title: d.title,
        lines: d.lines
      }))
    );
  }, [data?.lessons]);

  const current = slides[idx] ?? null;
  const canPrev = idx > 0;
  const canNext = idx < slides.length - 1;

  // Debug logs for range selection issues
  // eslint-disable-next-line no-console
  console.log("[study.dialogues] search:", search, "range:", range);
  // eslint-disable-next-line no-console
  console.log("[study.dialogues] data:", {
    isLoading,
    error,
    lessons: data?.lessons.length ?? null,
    dialogues: data?.dialogues.length ?? null,
    slides: slides.length,
  });

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-6">
          <Link to="/study" search={{ start: search.start, end: search.end }} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 범위 학습
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">대화문</h1>
          <p className="mt-1 text-sm text-muted-foreground">범위 내 대화문을 슬라이드처럼 넘겨서 봐요.</p>
        </div>

        {!range && (
          <RangeSelector min={MIN} max={MAX} onSubmit={({ start, end }) => navigate({ search: { start, end } })} />
        )}

        {range && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              범위: <span className="font-semibold text-foreground">{range.start} ~ {range.end}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {slides.length ? idx + 1 : 0} / {slides.length}
            </div>
          </div>
        )}

        {isLoading && <LoadingSpinner />}
        {error && <div className="rounded-2xl border bg-card p-6 text-sm text-destructive shadow-sm">{error}</div>}

        {data && (
          slides.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground shadow-sm">선택한 범위에 대화문이 없어요.</div>
          ) : isQuizMode ? (
            <RangeDialogueQuiz lessons={data.lessons} audioPlayer={audioPlayer} onClose={() => setIsQuizMode(false)} />
          ) : (
            <div className="space-y-6">
              {/* 퀴즈 배너 추가 */}
              <div className="rounded-2xl border bg-card p-5 text-center shadow-sm">
                 <h2 className="mb-2 text-lg font-bold text-foreground">배운 대화문을 확인해볼까요?</h2>
                 <p className="mb-4 text-sm text-muted-foreground">선택한 범위 내 모든 대화문을 섞어서 퀴즈를 풀어보세요.</p>
                 <button onClick={() => setIsQuizMode(true)} className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-[#B28471] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#a07664] active:scale-95">
                   🧩 전체 대화 퀴즈 도전 (10문제)
                 </button>
              </div>

              {/* 대화문 채팅 UI */}
              <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
                  <div className="min-w-0 pr-4">
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Lesson {current?.lessonId}</p>
                    <p className="text-base sm:text-lg font-bold text-foreground truncate">{current?.title}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={!canPrev}
                      onClick={() => setIdx((v) => Math.max(0, v - 1))}
                      className={cn("rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all", !canPrev && "opacity-60")}
                    >
                      ← 이전
                    </button>
                    <button
                      type="button"
                      disabled={!canNext}
                      onClick={() => setIdx((v) => Math.min(slides.length - 1, v + 1))}
                      className={cn("rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all", !canNext && "opacity-60")}
                    >
                      다음 →
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {current?.lines.map((line: any, lIdx: number) => {
                    const isA = line.speaker === "A";
                    const itemId = `dial-${current.lessonId}-${current.dIdx}-${lIdx}`;
                    const src = getDialogueAudioPath(current.lessonId, current.dIdx, lIdx);
                    const isPlaying = audioPlayer.currentItemId === itemId && audioPlayer.isPlaying;

                    return (
                      <div key={lIdx} className={cn("flex flex-col w-full gap-2", !isA && "items-end")}>
                        <div className={cn("flex flex-col gap-1 max-w-[85%] sm:max-w-[75%]", isA ? "items-start" : "items-end")}>
                          <span className="text-xs font-bold text-muted-foreground px-1">Speaker {line.speaker}</span>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => audioPlayer.play(itemId, src, { silentError: true })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                void audioPlayer.play(itemId, src, { silentError: true });
                              }
                            }}
                            className={cn(
                              "relative px-4 py-2.5 text-[#333D29] cursor-pointer transition-all hover:brightness-[0.97] active:scale-[0.98] shadow-sm outline-none focus:ring-2 focus:ring-ring/40",
                              isA ? "bg-[#E8EDDF] rounded-2xl rounded-tl-sm" : "bg-[#F5EBE0] rounded-2xl rounded-tr-sm"
                            )}
                          >
                            <div className={cn("flex items-start gap-3", isA ? "flex-row" : "flex-row-reverse")}>
                              <button className="shrink-0 mt-1 h-7 w-7 flex items-center justify-center rounded-full bg-background/50 hover:bg-background/80 transition-colors" tabIndex={-1}>
                                <Volume2 className={cn("h-3.5 w-3.5", isPlaying && "text-primary")} />
                              </button>
                              <div className={cn("min-w-0", isA ? "text-left" : "text-right")}>
                                <p className="text-sm sm:text-base font-bold" style={{ fontFamily: "var(--font-nepali)" }}>{line.nepali}</p>
                                <p className="text-xs sm:text-sm italic opacity-75 mt-0.5">{line.romanized}</p>
                                <p className="text-xs sm:text-sm mt-1.5 font-medium">{line.korean}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}

// 유틸리티: 배열 무작위 섞기
function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 하위 컴포넌트: 범위 학습용 대화문 종합 퀴즈
function RangeDialogueQuiz({
  lessons,
  audioPlayer,
  onClose,
}: {
  lessons: any[];
  audioPlayer: ReturnType<typeof useAudioPlayer>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "playing" | "finished">("idle");
  const [quizLines, setQuizLines] = useState<RangeQuizLine[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);

  const [pool, setPool] = useState<WordToken[]>([]);
  const [answer, setAnswer] = useState<WordToken[]>([]);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasErrorOnCurrent, setHasErrorOnCurrent] = useState(false);
  const [clickedTokenId, setClickedTokenId] = useState<string | null>(null);

  useEffect(() => {
    const allLines: RangeQuizLine[] = [];
    lessons.forEach((lesson) => {
      (lesson.dialogues ?? []).forEach((d: any, dIdx: number) => {
        (d.lines ?? []).forEach((l: any, lIdx: number) => {
          const clean = l.romanized.replace(/[?!.,;:]/g, "").trim();
          const words = clean.split(/\s+/).filter(Boolean);
          if (words.length >= 2) {
            allLines.push({
              ...l,
              lessonId: lesson.id,
              dIdx,
              lIdx,
              parsedWords: words.map((word: string, i: number) => ({ id: `${i}-${word}`, word })),
            });
          }
        });
      });
    });

    const lines = shuffleArray(allLines).slice(0, 10);
    if (lines.length === 0) {
      alert("현재 범위에서 퀴즈를 진행할 수 있는 대화문이 부족합니다.");
      onClose();
      return;
    }
    setQuizLines(lines);
    setCurrentStep(0);
    setScore(0);
    setStatus("playing");
    initStep(lines[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons]);

  const initStep = (line: RangeQuizLine) => {
    setPool(shuffleArray([...line.parsedWords]));
    setAnswer([]);
    setIsError(false);
    setIsSuccess(false);
    setHasErrorOnCurrent(false);
  };

  const playTokenAudio = (token: WordToken, line: RangeQuizLine) => {
    setClickedTokenId(token.id);
    setTimeout(() => setClickedTokenId(null), 150);
    try {
      const cleanWord = token.word.replace(/[^a-zA-Z]/g, "").toLowerCase();
      const itemId = `token-${token.id}`;
      const src = getVocabAudioPath(line.lessonId, cleanWord);
      void audioPlayer.play(itemId, src, { silentError: true });
    } catch (e) {
      // ignore
    }
  };

  const handleAdd = (token: WordToken) => {
    if (isSuccess) return;
    setIsError(false);
    const line = quizLines[currentStep];
    playTokenAudio(token, line);
    setPool((prev) => prev.filter((t) => t.id !== token.id));
    setAnswer((prev) => {
      const next = [...prev, token];
      checkAnswer(next, line);
      return next;
    });
  };

  const handleRemove = (token: WordToken) => {
    if (isSuccess) return;
    setIsError(false);
    const line = quizLines[currentStep];
    playTokenAudio(token, line);
    setAnswer((prev) => prev.filter((t) => t.id !== token.id));
    setPool((prev) => [...prev, token]);
  };

  const handleReset = () => {
    if (isSuccess) return;
    setIsError(false);
    const line = quizLines[currentStep];
    setPool(shuffleArray([...line.parsedWords]));
    setAnswer([]);
  };

  const checkAnswer = (currentAnswer: WordToken[], line: RangeQuizLine) => {
    if (currentAnswer.length === line.parsedWords.length) {
      const isCorrect = currentAnswer.map((t) => t.word).join(" ") === line.parsedWords.join(" ");
      if (isCorrect) {
        setIsSuccess(true);
        if (!hasErrorOnCurrent) {
          setScore((s) => s + 1);
        }
        const itemId = `dial-quiz-${line.lessonId}-${line.dIdx}-${line.lIdx}`;
        const src = getDialogueAudioPath(line.lessonId, line.dIdx, line.lIdx);
        void audioPlayer.play(itemId, src, { silentError: true });
      } else {
        setIsError(true);
        setHasErrorOnCurrent(true);
      }
    }
  };

  const handleNext = () => {
    if (currentStep < quizLines.length - 1) {
      setCurrentStep((c) => c + 1);
      initStep(quizLines[currentStep + 1]);
    } else {
      setStatus("finished");
    }
  };

  if (status === "idle") return null;

  if (status === "finished") {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
        <div className="mb-3 text-4xl sm:text-5xl">🎉</div>
        <h2 className="mb-2 text-xl font-bold text-foreground sm:text-2xl">대화문 퀴즈 완료!</h2>
        <p className="mb-6 text-base text-muted-foreground sm:text-lg">
          <span className="font-semibold text-primary">{score}</span> / {quizLines.length} 정답
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={onClose} size="lg" variant="default">
            대화문 목록으로
          </Button>
        </div>
      </div>
    );
  }

  const line = quizLines[currentStep];

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground sm:text-sm">
          문제 {currentStep + 1} / {quizLines.length}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2 text-xs">
          그만두기
        </Button>
      </div>

      <div className="mb-6 text-center">
        <h3 className="text-lg font-bold text-foreground sm:text-xl">{line.korean}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">로마자 조각을 순서대로 선택해 문장을 완성하세요.</p>
      </div>

      <div className={cn("mb-5 flex min-h-[3.5rem] flex-wrap items-center gap-2 rounded-xl p-3 transition-colors", isError ? "border-2 border-destructive/50 bg-destructive/5" : "border border-border bg-muted/30", isSuccess ? "border-2 border-success/50 bg-success/5" : "")}>
        {answer.length === 0 && !isSuccess && <span className="ml-1 text-xs sm:text-sm text-muted-foreground">이곳에 단어가 배열됩니다.</span>}
        {answer.map((t) => (
          <button key={t.id} onClick={() => handleRemove(t)} disabled={isSuccess} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-all duration-200 active:scale-95", isError ? "animate-shake bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground hover:opacity-90", isSuccess ? "bg-success text-success-foreground" : "", clickedTokenId === t.id && "scale-110 brightness-110 ring-2 ring-primary/40")}>
            {t.word}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {pool.map((t) => (
          <button key={t.id} onClick={() => handleAdd(t)} className={cn("rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-all duration-200 hover:bg-accent active:scale-95", clickedTokenId === t.id && "scale-110 border-primary bg-primary/10 text-primary ring-2 ring-primary/30")}>
            {t.word}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-4 min-h-[3.5rem]">
        <div className="flex items-center gap-2">
          {isError && !isSuccess && <><XCircle className="h-5 w-5 text-destructive" /><span className="text-sm font-semibold text-destructive">순서가 맞지 않습니다</span></>}
          {isSuccess && <><CheckCircle2 className="h-5 w-5 text-success" /><span className="text-sm font-semibold text-success">정답입니다!</span></>}
        </div>
        <div className="flex gap-2">
          {answer.length > 0 && !isSuccess && <Button variant="secondary" size="sm" onClick={handleReset}>초기화</Button>}
          {isSuccess && <Button onClick={handleNext}>{currentStep === quizLines.length - 1 ? "결과 보기" : "다음 문제"}</Button>}
        </div>
      </div>
      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
}
