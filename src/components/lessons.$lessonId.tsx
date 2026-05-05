import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { availableLessonIds, loadLesson } from "@/data/lessonLoader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GrammarPractice, type GrammarPracticeCard } from "@/components/GrammarPractice";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getDialogueAudioPath, getVocabAudioPath, getExampleAudioPath } from "@/lib/getAudioPath";
import { ChevronDown, Pause, Play, Volume2 } from "lucide-react";
import { DialogueGeneralQuiz } from "@/components/DialogueGeneralQuiz";
import { VocabLearningSystem } from "@/components/VocabLearningSystem";

export const Route = createFileRoute("/lessons/$lessonId")({
  loader: async ({ params }) => {
    const lessonId = Number(params.lessonId);
    if (!Number.isInteger(lessonId)) {
      throw new Error(`Invalid lesson id: ${params.lessonId}`);
    }
    return await loadLesson(lessonId);
  },
  head: ({ params, loaderData }) => {
    const lesson = loaderData;
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
  const lesson = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("vocabulary");
  const [expandedGrammar, setExpandedGrammar] = useState<Set<number>>(new Set([0]));
  const [grammarPractice, setGrammarPractice] = useState<GrammarCardData | null>(null);
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
  const [playDialogueIndex, setPlayDialogueIndex] = useState<number | null>(null);
  const [isQuizMode, setIsQuizMode] = useState(false);

  const playNextLineRef = useRef<number>(0);
  const playWasPlayingRef = useRef(false);

  const isPlayingAll = playDialogueIndex !== null;

  const playingDialogue = useMemo(() => {
    if (playDialogueIndex === null) return null;
    const dialogues = lesson?.dialogues ?? [];
    return dialogues[playDialogueIndex] ?? null;
  }, [lesson?.dialogues, playDialogueIndex]);

  const startPlayAllForDialogue = (dIdx: number) => {
    setPlayDialogueIndex(dIdx);
    playNextLineRef.current = 0;
    playWasPlayingRef.current = false;
    audioPlayer.stop();
  };

  const stopPlayAll = () => {
    setPlayDialogueIndex(null);
    playNextLineRef.current = 0;
    playWasPlayingRef.current = false;
    audioPlayer.stop();
  };

  useEffect(() => {
    if (!lesson) return;
    if (playDialogueIndex === null || !playingDialogue) return;

    // Kick off: play the first line automatically.
    if (
      !playWasPlayingRef.current &&
      !audioPlayer.isPlaying &&
      audioPlayer.currentItemId === null
    ) {
      const i = playNextLineRef.current;
      if (i >= playingDialogue.lines.length) {
        stopPlayAll();
        return;
      }
      playNextLineRef.current = i + 1;
      const itemId = `dial-${lesson.id}-${playDialogueIndex}-${i}`;
      const src = getDialogueAudioPath(lesson.id, playDialogueIndex, i);
      void audioPlayer.play(itemId, src);
    }
  }, [
    audioPlayer.currentItemId,
    audioPlayer.isPlaying,
    lesson,
    playDialogueIndex,
    playingDialogue,
  ]);

  useEffect(() => {
    if (!lesson) return;
    if (playDialogueIndex === null || !playingDialogue) return;

    const wasPlaying = playWasPlayingRef.current;
    const isPlaying = audioPlayer.isPlaying;
    playWasPlayingRef.current = isPlaying;

    // After a line finishes, immediately play the next line.
    if (wasPlaying && !isPlaying && audioPlayer.currentItemId === null) {
      const i = playNextLineRef.current;
      if (i >= playingDialogue.lines.length) {
        stopPlayAll();
        return;
      }
      playNextLineRef.current = i + 1;
      const itemId = `dial-${lesson.id}-${playDialogueIndex}-${i}`;
      const src = getDialogueAudioPath(lesson.id, playDialogueIndex, i);
      void audioPlayer.play(itemId, src);
    }
  }, [
    audioPlayer.currentItemId,
    audioPlayer.isPlaying,
    lesson,
    playDialogueIndex,
    playingDialogue,
  ]);

  useEffect(() => {
    if (!lesson) return;
    setQuizOrder(shuffle([...Array(lesson.quiz.length)].map((_, i) => i)));
    setQIdx(0);
    setSelectedOption(null);
    setScore(0);
    setAnswered(false);
    setFinished(false);
  }, [lessonId, lesson]);

  const currentIndex = availableLessonIds.indexOf(Number(lessonId));
  const prevId = currentIndex > 0 ? availableLessonIds[currentIndex - 1] : null;
  const nextId =
    currentIndex >= 0 && currentIndex < availableLessonIds.length - 1
      ? availableLessonIds[currentIndex + 1]
      : null;

  const grammarItemCount = useMemo(
    () => parseGrammarCards(lesson.grammar ?? []).length,
    [lesson.grammar],
  );

  const allTabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: "vocabulary", label: "단어장", icon: "📖", count: lesson.vocabulary.length },
    { key: "examples", label: "예문", icon: "💡", count: lesson.examples.length },
    { key: "grammar", label: "문법", icon: "📏", count: grammarItemCount },
    { key: "quiz", label: "퀴즈", icon: "✏️", count: lesson.quiz.length },
    { key: "dialogues", label: "대화문", icon: "💬", count: lesson.dialogues.length },
  ];

  const tabs = allTabs.filter((t) => t.key !== "examples" || t.count > 0);
  const grammarCards = useMemo(() => parseGrammarCards(lesson.grammar ?? []), [lesson.grammar]);

  const toggleGrammar = (idx: number) => {
    setExpandedGrammar((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const openGrammarPractice = (card: GrammarCardData) => {
    setGrammarPractice(card);
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
          <Link
            to="/lessons"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 레슨 목록
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {lesson.id}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                {lesson.titleKo}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground break-words sm:truncate">
                {lesson.title} · {lesson.description}
              </p>
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
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon} {t.label}
                {t.count > 0 && (
                  <span className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs opacity-60">
                    ({t.count})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-4 sm:mt-6">
          {tab === "vocabulary" &&
            (lesson.vocabulary.length === 0 ? (
              <EmptyState message="아직 단어가 준비되지 않았습니다." />
            ) : (
              <VocabLearningSystem
                lessonId={lesson.id}
                vocabulary={lesson.vocabulary}
                audioPlayer={audioPlayer}
              />
            ))}

          {tab === "examples" &&
            (lesson.examples.length === 0 ? (
              <EmptyState message="아직 예문이 준비되지 않았습니다." />
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {lesson.examples.map((example: any, idx: number) => {
                  const itemId = `example-${lesson.id}-${idx}`;
                  const src = getExampleAudioPath(lesson.id, idx);
                  const isCurrent = audioPlayer.currentItemId === itemId;
                  const isPlaying = isCurrent && audioPlayer.isPlaying;

                  return (
                    <div
                      key={idx}
                      className="relative rounded-xl border bg-card p-4 sm:p-5 text-left shadow-sm transition-all hover:shadow-md"
                    >
                      <button
                        type="button"
                        aria-label="예문 음성 재생"
                        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-accent active:scale-95 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          void audioPlayer.play(itemId, src);
                        }}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
                      <p
                        className="pr-10 text-lg sm:text-xl font-bold text-foreground"
                        style={{ fontFamily: "var(--font-nepali)" }}
                      >
                        {example.nepali}
                      </p>
                      <p className="mt-1 text-sm sm:text-base text-muted-foreground italic">
                        {example.romanized}
                      </p>
                      <p className="mt-2 text-base sm:text-lg font-medium text-foreground">
                        {example.korean}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}

          {tab === "grammar" &&
            (!lesson.grammar || lesson.grammar.length === 0 ? (
              <EmptyState message="아직 문법 설명이 준비되지 않았습니다." />
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {grammarCards.map((card, idx) => (
                  <GrammarCard
                    key={idx}
                    card={card}
                    index={idx}
                    lessonId={lesson.id}
                    expanded={expandedGrammar.has(idx)}
                    audioPlayer={audioPlayer}
                    onToggle={() => toggleGrammar(idx)}
                    onPractice={() => openGrammarPractice(card)}
                  />
                ))}
              </div>
            ))}

          {tab === "quiz" &&
            (lesson.quiz.length === 0 ? (
              <EmptyState message="아직 퀴즈가 준비되지 않았습니다." />
            ) : finished ? (
              <div className="rounded-2xl border bg-card p-8 sm:p-10 text-center shadow-sm">
                <div className="mb-3 sm:mb-4 text-4xl sm:text-5xl">🎉</div>
                <h2 className="mb-2 text-xl sm:text-2xl font-bold text-foreground">퀴즈 완료!</h2>
                <p className="mb-4 sm:mb-6 text-base sm:text-lg text-muted-foreground">
                  <span className="font-semibold text-primary">{score}</span> / {lesson.quiz.length}{" "}
                  정답
                </p>
                <div className="mb-4 sm:mb-6 h-3 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(score / lesson.quiz.length) * 100}%` }}
                  />
                </div>
                <Button onClick={resetQuiz} size="lg" className="w-full sm:w-auto">
                  다시 풀기
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
                <div className="mb-3 sm:mb-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {qIdx + 1} / {lesson.quiz.length}
                  </span>
                  <span className="rounded-full bg-warm/50 px-2.5 py-1 text-xs sm:text-sm font-medium text-warm-foreground">
                    점수: {score}
                  </span>
                </div>
                <div className="mb-3 sm:mb-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${((qIdx + 1) / lesson.quiz.length) * 100}%` }}
                  />
                </div>
                <h2 className="mb-4 sm:mb-5 text-base sm:text-lg font-semibold text-foreground">
                  {lesson.quiz[quizOrder[qIdx] ?? qIdx].question}
                </h2>
                <div className="grid gap-2">
                  {lesson.quiz[quizOrder[qIdx] ?? qIdx].options.map((opt: any, idx: number) => {
                    let style = "border bg-card hover:bg-accent";
                    if (answered) {
                      if (idx === lesson.quiz[quizOrder[qIdx] ?? qIdx].answer)
                        style = "border-2 border-success bg-success/10";
                      else if (idx === selectedOption)
                        style = "border-2 border-destructive bg-destructive/10";
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelect(idx)}
                        disabled={answered}
                        className={cn(
                          "rounded-xl px-4 py-3.5 sm:py-3 text-left text-sm font-medium transition-all active:scale-[0.98]",
                          style,
                          answered && "cursor-default",
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
            ))}

          {tab === "dialogues" &&
            (lesson.dialogues.length === 0 ? (
              <EmptyState message="아직 대화문이 준비되지 않았습니다." />
            ) : isQuizMode ? (
              <DialogueGeneralQuiz
                dialogues={lesson.dialogues}
                lessonId={lesson.id}
                vocabulary={lesson.vocabulary}
                audioPlayer={audioPlayer}
                onClose={() => setIsQuizMode(false)}
              />
            ) : (
              <div className="space-y-5 sm:space-y-6">
                {/* 퀴즈 배너 추가 */}
                <div className="rounded-2xl border bg-card p-5 text-center shadow-sm sm:p-6">
                  <h2 className="mb-2 text-lg font-bold text-foreground">배운 내용을 확인해볼까요?</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    이번 레슨의 대화문 문장들을 직접 조립해보며 실력을 점검해보세요.
                  </p>
                  <button
                    onClick={() => setIsQuizMode(true)}
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
                  >
                    🧩 전체 대화문 퀴즈 도전하기
                  </button>
                </div>

                {lesson.dialogues.map((dialogue: any, dIdx: number) => (
                  <div key={dIdx}>
                    <div className="mb-2 sm:mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-sm sm:text-base font-semibold text-foreground">
                        {dialogue.title}
                      </h2>
                      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                        <button
                          onClick={() => {
                            if (playDialogueIndex === dIdx) stopPlayAll();
                            else startPlayAllForDialogue(dIdx);
                          }}
                          className={cn(
                            "inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-medium hover:bg-accent active:scale-95 transition-all sm:h-9 sm:w-auto sm:px-3 sm:text-sm",
                            playDialogueIndex === dIdx
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {playDialogueIndex === dIdx ? "재생 중지" : "전체 재생"}
                        </button>
                        <button
                          onClick={() => setShowRomanized(!showRomanized)}
                          className="inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-lg bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-accent active:scale-95 transition-all sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
                        >
                          {showRomanized ? "로마자 숨기기" : "로마자 보기"}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2.5 sm:space-y-3 rounded-2xl border bg-card p-3 sm:p-5 shadow-sm">
                      {dialogue.lines.map((line: any, idx: number) => {
                        return (
                          <DialogueLine
                            key={idx}
                            line={line}
                            lessonId={lesson.id}
                            dIdx={dIdx}
                            idx={idx}
                            audioPlayer={audioPlayer}
                            playDialogueIndex={playDialogueIndex}
                            showRomanized={showRomanized}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>

        {/* Grammar Practice Dialog */}
        <Dialog open={!!grammarPractice} onOpenChange={(open) => !open && setGrammarPractice(null)}>
          <DialogContent className="grid max-h-[85dvh] max-w-[94vw] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-[#DCCFC4] bg-[#FFFDF9] p-0 text-[#333D29] sm:max-h-[80vh] sm:max-w-lg">
            {grammarPractice && (
              <>
                <DialogHeader className="px-4 pb-3 pt-4 text-left sm:px-6 sm:pt-6">
                  <DialogTitle className="text-[#333D29]">문법 연습</DialogTitle>
                  <DialogDescription className="text-sm sm:text-base">
                    {grammarPractice.title.replace(/^\d+\.\s*/, "").trim()}
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 text-base [-webkit-overflow-scrolling:touch] sm:px-6">
                  <GrammarPractice card={toPracticeCard(grammarPractice)} />
                </div>
                <div className="sticky bottom-0 flex justify-end border-t border-[#DCCFC4] bg-[#FFFDF9]/95 px-4 py-3 sm:px-6">
                  <DialogClose asChild>
                    <Button type="button" className="rounded-xl px-6">
                      닫기
                    </Button>
                  </DialogClose>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

// 유틸리티 함수: 배열을 무작위로 섞음
const shuffle = <T,>(arr: T[]) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

type DialogueLineProps = {
  line: { speaker: string; nepali: string; romanized: string; korean: string };
  lessonId: number | string;
  dIdx: number;
  idx: number;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
  playDialogueIndex: number | null;
  showRomanized: boolean;
};

function DialogueLine({
  line,
  lessonId,
  dIdx,
  idx,
  audioPlayer,
  playDialogueIndex,
  showRomanized,
}: DialogueLineProps) {
  const itemId = `dial-${lessonId}-${dIdx}-${idx}`;
  const src = getDialogueAudioPath(lessonId, dIdx, idx);
  const isCurrent = audioPlayer.currentItemId === itemId;
  const isPlaying = isCurrent && audioPlayer.isPlaying;
  const isPlayingThisDialogue = playDialogueIndex === dIdx;


  const handlePlay = () => {
    void audioPlayer.play(itemId, src);
  };

  return (
    <div className={cn("flex flex-col w-full gap-2", line.speaker === "B" && "items-end")}>
      <div className={cn("flex w-full gap-2 sm:gap-3", line.speaker === "B" && "flex-row-reverse text-right")}>
        {/* 스피커 아이콘 */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/5 text-xs font-bold sm:h-9 sm:w-9 sm:text-sm",
            line.speaker === "A" ? "bg-[#DDE3D2] text-[#333D29]" : "bg-[#E9DED3] text-[#333D29]",
          )}
        >
          {line.speaker}
        </div>

        {/* 말풍선 및 퀴즈 영역 */}
        <div className="flex max-w-[85%] flex-col gap-2">
          <div
            role="button"
            tabIndex={0}
            onClick={handlePlay}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handlePlay();
              }
            }}
            className={cn(
              "group relative cursor-pointer rounded-2xl border px-3 py-2 text-[#333D29] outline-none transition-all focus:ring-2 focus:ring-ring/40 sm:px-4 sm:py-2.5",
              line.speaker === "A" ? "border-[#DDE3D2] bg-[#E8EDDF]" : "border-[#E9DED3] bg-[#F5EBE0]",
            )}
          >
            <div className={cn("flex items-start gap-2", line.speaker === "B" && "flex-row-reverse")}>
              {/* 버튼 컨트롤 영역 */}
              <div className="flex shrink-0 flex-col items-center justify-start gap-1 sm:gap-1.5">
                <button
                  type="button"
                  aria-label="대화문 음성 재생"
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground transition-colors hover:bg-accent",
                    isPlayingThisDialogue && "opacity-70",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlay();
                  }}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>

              {/* 문장 텍스트 */}
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium text-[#333D29] transition-all sm:text-base"
                  style={{ fontFamily: "var(--font-nepali)" }}
                >
                  {line.nepali}
                </p>
                {showRomanized && (
                  <p className="mt-1 text-sm italic text-muted-foreground sm:text-base">
                    {line.romanized}
                  </p>
                )}
                <p className="mt-1.5 text-sm text-foreground sm:mt-2 sm:text-base">
                  {line.korean}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 sm:p-12 text-center shadow-sm">
      <div className="mb-3 sm:mb-4 text-3xl sm:text-4xl">🚧</div>
      <p className="text-sm sm:text-base text-muted-foreground">{message}</p>
    </div>
  );
}

type GrammarCardData = {
  title: string;
  lines: string[];
  examples?: string[];
};

function hasHoChhaHunchhaText(text: string) {
  const lower = text.toLowerCase();
  return lower.includes(" ho ") && lower.includes(" chha ") && lower.includes(" hunchha ");
}

function inferGrammarCategory(card: GrammarCardData) {
  const blob = [card.title, ...card.lines].join(" ").toLowerCase();
  if (blob.includes("인사") || blob.includes("greetings")) return "인사말";
  if (blob.includes("어순") || blob.includes("word order")) return "어순";
  if (blob.includes("-ko") || blob.includes("소유")) return "접미사";
  if (blob.includes("-le") || blob.includes("타동사") || blob.includes("자동사")) return "조사";
  if (blob.includes("동사") || hasHoChhaHunchhaText(` ${blob} `)) return "동사";
  if (blob.includes("부정")) return "부정";
  return "문법";
}

function toPracticeCard(card: GrammarCardData): GrammarPracticeCard {
  const details = card.lines.map((l) => l.trim()).filter(Boolean);
  const examples =
    (card.examples ?? []).map((l) => l.trim()).filter(Boolean).length > 0
      ? (card.examples ?? []).map((l) => l.trim()).filter(Boolean)
      : details.filter((l) => /예:|->|\([^)]+\)/.test(l) && /[a-zA-Z]/.test(l));
  const hasComparisonTable = hasHoChhaHunchhaText(` ${details.join(" ").toLowerCase()} `);
  return {
    title: card.title.replace(/^\d+\.\s*/, "").trim(),
    category: inferGrammarCategory(card),
    details,
    examples,
    hasComparisonTable,
  };
}

function parseGrammarCards(grammar: any[]): GrammarCardData[] {
  if (!grammar || grammar.length === 0) return [];

  // 새로운 형식 지원: 객체 형태 ({ title: string, details: string[] })
  if (typeof grammar[0] === "object") {
    return grammar.map((g) => ({
      title: g.title,
      lines: g.details || [],
      examples: g.examples || [],
    }));
  }

  // 기존 문자열 배열 형식 지원 (이전 데이터 호환성 유지)
  const cards: GrammarCardData[] = [];
  let currentCard: GrammarCardData | null = null;
  for (const line of grammar) {
    if (typeof line === "string" && line.match(/^\d+\./)) {
      if (currentCard) cards.push(currentCard);
      currentCard = { title: line, lines: [] };
    } else if (currentCard && typeof line === "string") {
      if (line.trim() || currentCard.lines.length > 0) {
        currentCard.lines.push(line);
      }
    }
  }
  if (currentCard) cards.push(currentCard);
  return cards;
}

function isPracticable(card: GrammarCardData) {
  const blob = [card.title, ...card.lines].join(" ").toLowerCase();
  const hasPossessive = blob.includes("'-ko'") || blob.includes("-ko") || blob.includes("소유");
  const hasErgative = blob.includes("'-le'") || blob.includes("-le") || blob.includes("타동사");
  const hasCopula = hasHoChhaHunchhaText(` ${card.lines.join(" ").toLowerCase()} `) || (blob.includes(" ho ") && blob.includes(" chha ") && blob.includes(" hunchha "));
  const hasExamples = (card.examples ?? []).length > 0;
  return hasPossessive || hasErgative || hasCopula || hasExamples;
}

function GrammarCard({
  card,
  index,
  lessonId,
  expanded,
  audioPlayer,
  onToggle,
  onPractice,
}: {
  card: GrammarCardData;
  index: number;
  lessonId: number;
  expanded: boolean;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
  onToggle: () => void;
  onPractice: () => void;
}) {
  const practicable = isPracticable(card);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full touch-pan-y items-center justify-between p-4 text-left sm:p-5"
      >
        <h2 className="text-base sm:text-lg font-semibold text-foreground pr-4">{card.title}</h2>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <div className="touch-pan-y border-t bg-muted/30 p-4 sm:p-5">
          <div className="space-y-2.5">
            {card.lines.map((line, i) => (
              <p key={i} className="text-base leading-relaxed text-foreground">
                {line}
              </p>
            ))}
          </div>
          {practicable && (
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" size="sm" onClick={onPractice}>
                문법 연습하기
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
