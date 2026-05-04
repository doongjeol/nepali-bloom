import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import lessonsData from "@/data/lessons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getDialogueAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";
import { Pause, Play, Volume2 } from "lucide-react";

export const Route = createFileRoute("/lessons/$lessonId")({
  head: ({ params }) => {
    const lesson = lessonsData.find((l) => l.id === Number(params.lessonId));
    return {
      meta: [
        { title: `Lesson ${params.lessonId}: ${lesson?.titleKo ?? ""} - 네팔어 학습` },
        { name: "description", content: lesson?.description ?? "" },
      ],
    };
  },
  component: LessonDetailPage,
});

type Tab = "vocabulary" | "examples" | "grammar" | "quiz" | "dialogues";

function LessonDetailPage() {
  const { lessonId } = Route.useParams();
  const lesson = lessonsData.find((l) => l.id === Number(lessonId));
  const [tab, setTab] = useState<Tab>("vocabulary");
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const audioPlayer = useAudioPlayer();

  // Quiz state
  const [qIdx, setQIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [quizOrder, setQuizOrder] = useState<number[]>([]);

  // Dialogue state
  const [showRomanized, setShowRomanized] = useState(true);
  const [practiceDialogueIndex, setPracticeDialogueIndex] = useState<number | null>(null);
  const [practiceRoleA, setPracticeRoleA] = useState(false);
  const [hideNepali, setHideNepali] = useState(false);
  const [revealedNepaliKeys, setRevealedNepaliKeys] = useState<Set<string>>(new Set());

  type ScrambleState = {
    key: string; // `${dIdx}-${lineIdx}`
    originalWords: string[];
    pool: string[];
    answer: string[];
    done: boolean;
  } | null;
  const [scramble, setScramble] = useState<ScrambleState>(null);

  const practiceNextLineRef = useRef<number>(0);
  const practiceWasPlayingRef = useRef(false);

  const isPracticing = practiceRoleA && practiceDialogueIndex !== null;

  const practiceDialogue = useMemo(() => {
    if (practiceDialogueIndex === null) return null;
    const dialogues = lesson?.dialogues ?? [];
    return dialogues[practiceDialogueIndex] ?? null;
  }, [lesson?.dialogues, practiceDialogueIndex]);

  const normalizeWords = (text: string) =>
    text
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);

  const shuffle = <T,>(arr: T[]) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const startPracticeForDialogue = (dIdx: number) => {
    setPracticeDialogueIndex(dIdx);
    setPracticeRoleA(true);
    practiceNextLineRef.current = 0;
  };

  const stopPractice = () => {
    setPracticeRoleA(false);
    setPracticeDialogueIndex(null);
    practiceNextLineRef.current = 0;
  };

  useEffect(() => {
    if (!lesson) return;
    if (!isPracticing || !practiceDialogue) return;

    // Kick off: play first B line automatically.
    if (!practiceWasPlayingRef.current && !audioPlayer.isPlaying && audioPlayer.currentItemId === null) {
      for (let i = practiceNextLineRef.current; i < practiceDialogue.lines.length; i++) {
        const line = practiceDialogue.lines[i];
        practiceNextLineRef.current = i + 1;
        if (line.speaker === "B") {
          const itemId = `dial-${lesson.id}-${practiceDialogueIndex}-${i}`;
          const src = getDialogueAudioPath(lesson.id, practiceDialogueIndex, i);
          void audioPlayer.play(itemId, src);
          break;
        }
      }
    }
  }, [audioPlayer, isPracticing, lessonId, practiceDialogue, practiceDialogueIndex]);

  useEffect(() => {
    if (!lesson) return;
    if (!isPracticing || !practiceDialogue) return;

    const wasPlaying = practiceWasPlayingRef.current;
    const isPlaying = audioPlayer.isPlaying;
    practiceWasPlayingRef.current = isPlaying;

    // After a B line finishes, immediately play the next B line.
    if (wasPlaying && !isPlaying && audioPlayer.currentItemId === null) {
      for (let i = practiceNextLineRef.current; i < practiceDialogue.lines.length; i++) {
        const line = practiceDialogue.lines[i];
        practiceNextLineRef.current = i + 1;
        if (line.speaker === "B") {
          const itemId = `dial-${lesson.id}-${practiceDialogueIndex}-${i}`;
          const src = getDialogueAudioPath(lesson.id, practiceDialogueIndex, i);
          void audioPlayer.play(itemId, src);
          return;
        }
      }
      // Reached end.
      stopPractice();
    }
  }, [audioPlayer.currentItemId, audioPlayer.isPlaying, isPracticing, lessonId, practiceDialogue, practiceDialogueIndex]);

  useEffect(() => {
    if (!lesson) return;
    setQuizOrder(shuffle([...Array(lesson.quiz.length)].map((_, i) => i)));
    setQIdx(0);
    setSelectedOption(null);
    setScore(0);
    setAnswered(false);
    setFinished(false);
  }, [lessonId, lesson]);

  if (!lesson) {
    return (
      <div className="min-h-screen pb-16 sm:pb-0">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-muted-foreground">레슨을 찾을 수 없습니다.</p>
          <Link to="/lessons" className="mt-4 inline-block text-primary underline">
            레슨 목록으로
          </Link>
        </main>
      </div>
    );
  }

  const currentIndex = lessonsData.findIndex((l) => l.id === Number(lessonId));
  const prevId = currentIndex > 0 ? lessonsData[currentIndex - 1].id : null;
  const nextId = currentIndex < lessonsData.length - 1 ? lessonsData[currentIndex + 1].id : null;
  
  const allTabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: "vocabulary", label: "단어장", icon: "📖", count: lesson.vocabulary.length },
    { key: "examples", label: "예문", icon: "💡", count: lesson.examples.length },
    { key: "grammar", label: "문법", icon: "📏", count: lesson.grammar?.length || 0 },
    { key: "quiz", label: "퀴즈", icon: "✏️", count: lesson.quiz.length },
    { key: "dialogues", label: "대화문", icon: "💬", count: lesson.dialogues.length },
  ];

  const tabs = allTabs.filter((t) => t.key !== "examples" || t.count > 0);

  const toggleFlip = (idx: number) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelectedOption(idx);
    setAnswered(true);
    const currentQuizIndex = quizOrder[qIdx] ?? qIdx;
    if (idx === lesson.quiz[currentQuizIndex].answer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (qIdx + 1 >= lesson.quiz.length) {
      setFinished(true);
    } else {
      setQIdx((c) => c + 1);
      setSelectedOption(null);
      setAnswered(false);
    }
  };

  const resetQuiz = () => {
    setQIdx(0);
    setSelectedOption(null);
    setScore(0);
    setAnswered(false);
    setFinished(false);
    setQuizOrder(shuffle([...Array(lesson.quiz.length)].map((_, i) => i)));
  };

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-4 sm:py-8">
        {/* Lesson header */}
        <div className="mb-4 sm:mb-6">
          <Link to="/lessons" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 레슨 목록
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {lesson.id}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{lesson.titleKo}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground break-words sm:truncate">{lesson.title} · {lesson.description}</p>
            </div>
          </div>
        </div>

        {/* Sticky tabs */}
        <div className="sticky top-12 z-40 -mx-4 bg-background/95 backdrop-blur-sm px-4 py-2 sm:static sm:mx-0 sm:px-0 sm:py-0">
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-2.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium transition-colors",
                  tab === t.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.icon} {t.label}
                {t.count > 0 && (
                  <span className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs opacity-60">({t.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-4 sm:mt-6">
          {tab === "vocabulary" && (
            lesson.vocabulary.length === 0 ? (
              <EmptyState message="아직 단어가 준비되지 않았습니다." />
            ) : (
              <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                {lesson.vocabulary.map((word, idx) => {
                  const itemId = `vocab-${lesson.id}-${idx}`;
                  const src = getVocabAudioPath(lesson.id, idx);
                  const isCurrent = audioPlayer.currentItemId === itemId;
                  const isPlaying = isCurrent && audioPlayer.isPlaying;

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleFlip(idx)}
                      className="relative rounded-xl border bg-card p-4 sm:p-5 text-left shadow-sm transition-all active:scale-[0.98] hover:shadow-md cursor-pointer"
                    >
                      <button
                        type="button"
                        aria-label="단어 음성 재생"
                        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-accent active:scale-95 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          void audioPlayer.play(itemId, src);
                        }}
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                    {flipped.has(idx) ? (
                      <>
                        <p className="text-base sm:text-lg font-semibold text-foreground">{word.korean}</p>
                        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground italic">{word.romanized}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                          {word.nepali}
                        </p>
                        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground italic">{word.romanized}</p>
                      </>
                    )}
                    <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground">
                      탭하여 {flipped.has(idx) ? "네팔어" : "한국어"} 보기
                    </p>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {tab === "examples" && (
            lesson.examples.length === 0 ? (
              <EmptyState message="아직 예문이 준비되지 않았습니다." />
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {lesson.examples.map((example, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border bg-card p-4 sm:p-5 text-left shadow-sm transition-all hover:shadow-md"
                  >
                    <p className="text-lg sm:text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                      {example.nepali}
                    </p>
                    <p className="mt-1 text-sm sm:text-base text-muted-foreground italic">
                      {example.romanized}
                    </p>
                    <p className="mt-2 text-base sm:text-lg font-medium text-foreground">
                      {example.korean}
                    </p>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "grammar" && (
            !lesson.grammar || lesson.grammar.length === 0 ? (
              <EmptyState message="아직 문법 설명이 준비되지 않았습니다." />
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {lesson.grammar.map((rule, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border bg-card p-4 sm:p-5 text-left shadow-sm transition-all hover:shadow-md"
                  >
                    <p className="text-sm sm:text-base font-medium text-foreground whitespace-pre-wrap leading-relaxed">
                      {rule}
                    </p>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "quiz" && (
            lesson.quiz.length === 0 ? (
              <EmptyState message="아직 퀴즈가 준비되지 않았습니다." />
            ) : finished ? (
              <div className="rounded-2xl border bg-card p-8 sm:p-10 text-center shadow-sm">
                <div className="mb-3 sm:mb-4 text-4xl sm:text-5xl">🎉</div>
                <h2 className="mb-2 text-xl sm:text-2xl font-bold text-foreground">퀴즈 완료!</h2>
                <p className="mb-4 sm:mb-6 text-base sm:text-lg text-muted-foreground">
                  <span className="font-semibold text-primary">{score}</span> / {lesson.quiz.length} 정답
                </p>
                <div className="mb-4 sm:mb-6 h-3 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(score / lesson.quiz.length) * 100}%` }} />
                </div>
                <Button onClick={resetQuiz} size="lg" className="w-full sm:w-auto">다시 풀기</Button>
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
                <div className="mb-3 sm:mb-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">{qIdx + 1} / {lesson.quiz.length}</span>
                  <span className="rounded-full bg-warm/50 px-2.5 py-1 text-xs sm:text-sm font-medium text-warm-foreground">점수: {score}</span>
                </div>
                <div className="mb-3 sm:mb-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((qIdx + 1) / lesson.quiz.length) * 100}%` }} />
                </div>
                <h2 className="mb-4 sm:mb-5 text-base sm:text-lg font-semibold text-foreground">
                  {lesson.quiz[quizOrder[qIdx] ?? qIdx].question}
                </h2>
                <div className="grid gap-2">
                  {lesson.quiz[quizOrder[qIdx] ?? qIdx].options.map((opt, idx) => {
                    let style = "border bg-card hover:bg-accent";
                    if (answered) {
                      if (idx === lesson.quiz[quizOrder[qIdx] ?? qIdx].answer) style = "border-2 border-success bg-success/10";
                      else if (idx === selectedOption) style = "border-2 border-destructive bg-destructive/10";
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelect(idx)}
                        disabled={answered}
                        className={cn(
                          "rounded-xl px-4 py-3.5 sm:py-3 text-left text-sm font-medium transition-all active:scale-[0.98]",
                          style,
                          answered && "cursor-default"
                        )}
                      >
                        <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                          {idx + 1}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {answered && (
                  <div className="mt-4 sm:mt-5">
                    <Button onClick={handleNext} className="w-full sm:w-auto">
                      {qIdx + 1 >= lesson.quiz.length ? "결과 보기" : "다음 →"}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}

          {tab === "dialogues" && (
            lesson.dialogues.length === 0 ? (
              <EmptyState message="아직 대화문이 준비되지 않았습니다." />
            ) : (
              <div className="space-y-5 sm:space-y-6">
                {lesson.dialogues.map((dialogue, dIdx) => (
                  <div key={dIdx}>
                    <div className="mb-2 sm:mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-sm sm:text-base font-semibold text-foreground">{dialogue.title}</h2>
                      <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:gap-2">
                        <button
                          onClick={() => {
                            if (practiceRoleA && practiceDialogueIndex === dIdx) stopPractice();
                            else startPracticeForDialogue(dIdx);
                          }}
                          className={cn(
                            "inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2 py-1 text-[10px] leading-none sm:px-2.5 sm:py-1.5 sm:text-xs font-medium hover:bg-accent active:scale-95 transition-all",
                            practiceRoleA && practiceDialogueIndex === dIdx
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {practiceRoleA && practiceDialogueIndex === dIdx ? "학습 모드 종료" : "A 역할 하기"}
                        </button>
                        <button
                          onClick={() => {
                            setHideNepali((v) => !v);
                            setRevealedNepaliKeys(new Set());
                          }}
                          className={cn(
                            "inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2 py-1 text-[10px] leading-none sm:px-2.5 sm:py-1.5 sm:text-xs font-medium hover:bg-accent active:scale-95 transition-all",
                            hideNepali ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {hideNepali ? "가리기 해제" : "가리기"}
                        </button>
                        <button
                          onClick={() => setShowRomanized(!showRomanized)}
                          className="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-secondary px-2 py-1 text-[10px] leading-none font-medium text-secondary-foreground hover:bg-accent active:scale-95 transition-all sm:px-2.5 sm:py-1.5 sm:text-xs"
                        >
                          {showRomanized ? "로마자 숨기기" : "로마자 보기"}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2.5 sm:space-y-3 rounded-2xl border bg-card p-3 sm:p-5 shadow-sm">
                      {dialogue.lines.map((line, idx) => {
                        const itemId = `dial-${lesson.id}-${dIdx}-${idx}`;
                        const src = getDialogueAudioPath(lesson.id, dIdx, idx);
                        const isCurrent = audioPlayer.currentItemId === itemId;
                        const isPlaying = isCurrent && audioPlayer.isPlaying;

                        const inPracticeThisDialogue = practiceRoleA && practiceDialogueIndex === dIdx;
                        const dimmedForRole = inPracticeThisDialogue && line.speaker === "A";

                        const nepaliKey = `${dIdx}-${idx}`;
                        const nepaliVisible = !hideNepali || revealedNepaliKeys.has(nepaliKey);

                        const scrambleKey = `${dIdx}-${idx}`;
                        const isScrambling = scramble?.key === scrambleKey;
                        const romanizedWords = normalizeWords(line.romanized);
                        const scrambleAllowed = romanizedWords.length >= 2 && !inPracticeThisDialogue;

                        const openScramble = () => {
                          if (!scrambleAllowed) return;
                          setScramble({
                            key: scrambleKey,
                            originalWords: romanizedWords,
                            pool: shuffle(romanizedWords),
                            answer: [],
                            done: false,
                          });
                        };

                        const tryPlay = () => {
                          if (dimmedForRole) return;
                          void audioPlayer.play(itemId, src);
                        };

                        const handleActivate = () => {
                          if (hideNepali && !nepaliVisible) {
                            setRevealedNepaliKeys((prev) => {
                              const next = new Set(prev);
                              next.add(nepaliKey);
                              return next;
                            });
                            return;
                          }

                          if (isScrambling) return;
                          if (scrambleAllowed) {
                            openScramble();
                            return;
                          }

                          tryPlay();
                        };

                        return (
                          <div key={idx} className={cn("flex gap-2 sm:gap-3", line.speaker === "B" && "flex-row-reverse text-right")}>
                            <div
                              className={cn(
                                "flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-black/5 text-xs sm:text-sm font-bold",
                                line.speaker === "A" ? "bg-[#DDE3D2] text-[#333D29]" : "bg-[#E9DED3] text-[#333D29]",
                              )}
                            >
                              {line.speaker}
                            </div>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={handleActivate}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleActivate();
                                }
                              }}
                              className={cn(
                                "group max-w-[80%] rounded-2xl border px-3 py-2 text-[#333D29] sm:px-4 sm:py-2.5 cursor-pointer outline-none focus:ring-2 focus:ring-ring/40 transition-opacity",
                                line.speaker === "A" ? "bg-[#E8EDDF] border-[#DDE3D2]" : "bg-[#F5EBE0] border-[#E9DED3]",
                              )}
                            >
                              <div className={cn("flex items-start gap-2", line.speaker === "B" && "flex-row-reverse")}>
                                <div className={cn("min-w-0 flex-1", dimmedForRole && "opacity-40")}>
                                  <p className="text-sm sm:text-base font-medium text-[#333D29]" style={{ fontFamily: "var(--font-nepali)" }}>
                                    {nepaliVisible ? line.nepali : "••••••••"}
                                  </p>
                                  {showRomanized &&
                                    (isScrambling ? (
                                      <div className="mt-1 space-y-2">
                                        <div className="flex flex-wrap gap-1">
                                          {scramble!.answer.map((w, i) => (
                                            <button
                                              key={`${w}-${i}`}
                                              type="button"
                                              className="rounded-md bg-secondary px-2 py-1 text-[10px] sm:text-xs text-secondary-foreground hover:bg-accent"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setScramble((prev) => {
                                                  if (!prev || prev.key !== scrambleKey || prev.done) return prev;
                                                  const nextAnswer = prev.answer.filter((_, idx2) => idx2 !== i);
                                                  return { ...prev, answer: nextAnswer };
                                                });
                                              }}
                                            >
                                              {w}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {scramble!.pool.map((w, i) => (
                                            <button
                                              key={`${w}-${i}`}
                                              type="button"
                                              className="rounded-md border bg-background/60 px-2 py-1 text-[10px] sm:text-xs text-foreground hover:bg-accent"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setScramble((prev) => {
                                                  if (!prev || prev.key !== scrambleKey || prev.done) return prev;
                                                  const nextPool = prev.pool.filter((_, idx2) => idx2 !== i);
                                                  const nextAnswer = [...prev.answer, w];
                                                  const done =
                                                    nextAnswer.length === prev.originalWords.length &&
                                                    nextAnswer.join(" ") === prev.originalWords.join(" ");
                                                  return { ...prev, pool: nextPool, answer: nextAnswer, done };
                                                });
                                              }}
                                            >
                                              {w}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={cn(
                                              "text-[10px] sm:text-xs",
                                              scramble!.done ? "text-primary" : "text-muted-foreground",
                                            )}
                                          >
                                            {scramble!.done ? "성공!" : "단어 순서 맞추기"}
                                          </span>
                                          <button
                                            type="button"
                                            className="rounded-md bg-secondary px-2 py-1 text-[10px] sm:text-xs text-secondary-foreground hover:bg-accent"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setScramble(null);
                                            }}
                                          >
                                            닫기
                                          </button>
                                          <button
                                            type="button"
                                            className="rounded-md bg-secondary px-2 py-1 text-[10px] sm:text-xs text-secondary-foreground hover:bg-accent"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setScramble((prev) => {
                                                if (!prev || prev.key !== scrambleKey) return prev;
                                                return { ...prev, pool: shuffle(prev.originalWords), answer: [], done: false };
                                              });
                                            }}
                                          >
                                            다시 섞기
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="mt-0.5 text-[10px] sm:text-xs text-[#333D29]/70 italic">{line.romanized}</p>
                                    ))}
                                  <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-[#333D29]/80">{line.korean}</p>
                                  {scrambleAllowed && !isScrambling && (
                                    <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground">클릭하면 단어 셔플 모드</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  aria-label="대화문 음성 재생"
                                  className={cn(
                                    "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                                    dimmedForRole && "pointer-events-none opacity-0",
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    tryPlay();
                                  }}
                                >
                                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Prev/Next navigation */}
        <div className="mt-6 sm:mt-8 flex items-center justify-between gap-2">
          {prevId ? (
            <Link
              to="/lessons/$lessonId"
              params={{ lessonId: String(prevId) }}
              className="rounded-lg bg-secondary px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium text-secondary-foreground hover:bg-accent active:scale-95 transition-all"
              onClick={() => { setTab("vocabulary"); setFlipped(new Set()); resetQuiz(); }}
            >
              ← Lesson {prevId}
            </Link>
          ) : <div />}
          {nextId ? (
            <Link
              to="/lessons/$lessonId"
              params={{ lessonId: String(nextId) }}
              className="rounded-lg bg-primary px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
              onClick={() => { setTab("vocabulary"); setFlipped(new Set()); resetQuiz(); }}
            >
              Lesson {nextId} →
            </Link>
          ) : <div />}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 sm:p-12 text-center shadow-sm">
      <div className="mb-2 sm:mb-3 text-3xl sm:text-4xl">📝</div>
      <p className="text-sm sm:text-base text-muted-foreground">{message}</p>
      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">책 내용을 기반으로 곧 추가될 예정입니다.</p>
    </div>
  );
}
