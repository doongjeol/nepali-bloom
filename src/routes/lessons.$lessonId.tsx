﻿import { createFileRoute, Link } from "@tanstack/react-router";
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
import { ChevronDown, Pause, Play, Volume2, Car, Bookmark } from "lucide-react";
import { DialogueGeneralQuiz } from "@/components/DialogueGeneralQuiz";
import { VocabLearningSystem } from "@/components/VocabLearningSystem";
import { DrivingModePlayer } from "@/components/DrivingModePlayer";
import { useBookmarks } from "@/hooks/useBookmarks";

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
type QuizMode = null | "multiple" | "speaking";

function LessonDetailPage() {
  const { lessonId } = Route.useParams();
  const lesson = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("vocabulary");
  const [expandedGrammar, setExpandedGrammar] = useState<Set<number>>(new Set([0]));
  const [grammarPractice, setGrammarPractice] = useState<GrammarCardData | null>(null);
  const audioPlayer = useAudioPlayer();

  const speakingPracticeItems = useMemo(() => {
    if (lesson.examples && lesson.examples.length > 0) {
      return lesson.examples.map((ex: any, idx: number) => ({ ...ex, _type: "example", _idx: idx }));
    }
    // 대화문이 있으면 예문 대신 사용
    if (lesson.dialogues && lesson.dialogues.length > 0) {
      return lesson.dialogues.flatMap((d: any, dIdx: number) =>
        d.lines.map((l: any, lIdx: number) => ({ ...l, _type: "dialogue", _dIdx: dIdx, _lIdx: lIdx }))
      );
    }
    return [];
  }, [lesson.examples, lesson.dialogues]);

  // Quiz state
  const [quizMode, setQuizMode] = useState<QuizMode>(null);
  const [qIdx, setQIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [quizOrder, setQuizOrder] = useState<number[]>([]);
  const [quizSelections, setQuizSelections] = useState<(number | null)[]>([]);

  // Speaking practice (Active Recall) state
  const [spkIdx, setSpkIdx] = useState(0);
  const [spkOrder, setSpkOrder] = useState<number[]>([]);
  const [spkRevealed, setSpkRevealed] = useState(false);
  const [spkAnswers, setSpkAnswers] = useState<(boolean | null)[]>([]);
  const [spkScore, setSpkScore] = useState(0);
  const [spkFinished, setSpkFinished] = useState(false);
  const lastSpokenKeyRef = useRef<string | null>(null);
  const spkScoreRef = useRef(0);

  // Dialogue state
  const [showRomanized, setShowRomanized] = useState(true);
  const [playDialogueIndex, setPlayDialogueIndex] = useState<number | null>(null);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [showDrivingMode, setShowDrivingMode] = useState(false);

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
    setQuizSelections(Array(lesson.quiz.length).fill(null));
    setQuizMode(null);

    const initialSpkOrder = shuffle([...Array(speakingPracticeItems.length)].map((_, i) => i)).slice(0, 10);
    setSpkOrder(initialSpkOrder);
    setSpkAnswers(Array(initialSpkOrder.length).fill(null));
    setSpkIdx(0);
    setSpkRevealed(false);
    setSpkScore(0);
    spkScoreRef.current = 0;
    setSpkFinished(false);
    lastSpokenKeyRef.current = null;
  }, [lessonId, lesson, speakingPracticeItems]);

  const speakKorean = (text: string) => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    try {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ko-KR";
      utter.rate = 0.95;
      synth.speak(utter);
    } catch {
      // Some browsers block speech without a user gesture
    }
  };

  useEffect(() => {
    if (quizMode !== "speaking") return;
    if (spkFinished) return;
    if (spkRevealed) return;
    const vocabIndex = spkOrder[spkIdx] ?? spkIdx;
    const card = speakingPracticeItems[vocabIndex];
    if (!card) return;
    const key = `spk-${lesson.id}-${vocabIndex}-${card.korean}`;
    if (lastSpokenKeyRef.current === key) return;
    lastSpokenKeyRef.current = key;
    speakKorean(card.korean);
  }, [lesson.id, speakingPracticeItems, quizMode, spkFinished, spkIdx, spkOrder, spkRevealed]);

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
    { key: "examples", label: "예문", icon: "💡", count: lesson.examples?.length || 0 },
    { key: "grammar", label: "문법", icon: "📏", count: grammarItemCount },
    { key: "dialogues", label: "대화문", icon: "💬", count: lesson.dialogues.length },
    { key: "quiz", label: "퀴즈", icon: "✏️", count: lesson.quiz.length },
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
    const currentQuizIndex = quizOrder[qIdx] ?? qIdx;
    if (quizSelections[currentQuizIndex] !== null) return;
    setQuizSelections((prev) => {
      const next = [...prev];
      next[currentQuizIndex] = idx;
      return next;
    });
    setSelectedOption(idx);
    setAnswered(true);
    if (idx === lesson.quiz[currentQuizIndex].answer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (qIdx + 1 >= lesson.quiz.length) {
      setFinished(true);
    } else {
      const nextIdx = qIdx + 1;
      const nextQuizIndex = quizOrder[nextIdx] ?? nextIdx;
      const nextSelection = quizSelections[nextQuizIndex] ?? null;
      setQIdx(nextIdx);
      setSelectedOption(nextSelection);
      setAnswered(nextSelection !== null);
    }
  };

  const resetMultipleQuiz = () => {
    setQIdx(0);
    setSelectedOption(null);
    setScore(0);
    setAnswered(false);
    setFinished(false);
    setQuizOrder(shuffle([...Array(lesson.quiz.length)].map((_, i) => i)));
    setQuizSelections(Array(lesson.quiz.length).fill(null));
  };

  const resetSpeakingPractice = () => {
    const nextOrder = shuffle([...Array(speakingPracticeItems.length)].map((_, i) => i)).slice(0, 10);
    setSpkOrder(nextOrder);
    setSpkAnswers(Array(nextOrder.length).fill(null));
    setSpkIdx(0);
    setSpkRevealed(false);
    setSpkScore(0);
    spkScoreRef.current = 0;
    setSpkFinished(false);
    lastSpokenKeyRef.current = null;
  };

  const retryWrongSpeakingPractice = () => {
    const wrongIdxes = spkAnswers
      .map((ans, idx) => ({ ans, idx }))
      .filter((x) => x.ans === false)
      .map((x) => x.idx);

    if (wrongIdxes.length === 0) return;

    const nextOrder = wrongIdxes.map((i) => spkOrder[i]!).filter((x) => typeof x === "number");
    setSpkOrder(nextOrder);
    setSpkAnswers(Array(nextOrder.length).fill(null));
    setSpkIdx(0);
    setSpkRevealed(false);
    setSpkScore(0);
    spkScoreRef.current = 0;
    setSpkFinished(false);
    lastSpokenKeyRef.current = null;
  };

  const backToQuizModeSelect = () => {
    setQuizMode(null);
    resetMultipleQuiz();
    resetSpeakingPractice();
  };

  const markSpeakingAnswer = (isCorrect: boolean) => {
    setSpkAnswers((prev) => {
      const next = prev.length === spkOrder.length ? [...prev] : Array(spkOrder.length).fill(null);
      const prevVal = next[spkIdx] ?? null;
      next[spkIdx] = isCorrect;

      if (prevVal === true && !isCorrect) spkScoreRef.current -= 1;
      if (prevVal !== true && isCorrect) spkScoreRef.current += 1;
      setSpkScore(spkScoreRef.current);

      return next;
    });

    if (spkIdx + 1 >= spkOrder.length) {
      setSpkFinished(true);
      setSpkRevealed(false);
      return;
    }
    setSpkIdx((c) => c + 1);
    setSpkRevealed(false);
    lastSpokenKeyRef.current = null;
  };

  const goSpeakingPrev = () => {
    if (spkIdx <= 0) return;
    setSpkIdx((c) => Math.max(0, c - 1));
    setSpkRevealed(false);
    lastSpokenKeyRef.current = null;
  };

  const goSpeakingNext = () => {
    if (spkIdx + 1 >= spkOrder.length) return;
    setSpkIdx((c) => Math.min(spkOrder.length - 1, c + 1));
    setSpkRevealed(false);
    lastSpokenKeyRef.current = null;
  };

  const handleReveal = () => {
    setSpkRevealed(true);
    const vocabIndex = spkOrder[spkIdx] ?? spkIdx;
    const card = speakingPracticeItems[vocabIndex];
    if (card) {
      if (card._type === "example") {
        void audioPlayer.play(`example-${lesson.id}-${card._idx}`, getExampleAudioPath(lesson.id, card._idx));
      } else if (card._type === "dialogue") {
        void audioPlayer.play(`dial-${lesson.id}-${card._dIdx}-${card._lIdx}`, getDialogueAudioPath(lesson.id, card._dIdx, card._lIdx));
      }
    }
  };

  const allLessonItems = useMemo(() => {
    if (!lesson) return [];
    const items: any[] = [];

    if (lesson.vocabulary) {
      lesson.vocabulary.forEach((v: any) => items.push({ ...v, type: "vocab" }));
    }

    const grammarCards = parseGrammarCards(lesson.grammar ?? []);
    grammarCards.forEach((g) => {
      g.lines.forEach((line) => {
        items.push({ nepali: line, romanized: "문법 설명", korean: g.title, type: "grammar" });
      });
      g.examples?.forEach((ex) => {
        items.push({ nepali: ex, romanized: "문법 예문", korean: g.title, type: "grammar" });
      });
    });

    if (lesson.dialogues) {
      lesson.dialogues.forEach((d: any, dIdx: number) => {
        d.lines.forEach((l: any, lIdx: number) => {
          items.push({ nepali: l.nepali, romanized: l.romanized, korean: `[${l.speaker}] ${l.korean}`, type: "dialogue", dIdx, lIdx });
        });
      });
    }

    if (lesson.quiz) {
      lesson.quiz.forEach((q: any) => {
        items.push({ nepali: q.options[q.answer], romanized: "퀴즈 정답", korean: `[Q] ${q.question}`, type: "quiz" });
      });
    }

    return items;
  }, [lesson]);

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
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                {lesson.id}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">
                  {lesson.titleKo}
                </h1>
                <p className="truncate text-xs text-muted-foreground sm:text-sm">
                  {lesson.title} · {lesson.description}
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setShowDrivingMode(true)}
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 active:scale-95 sm:w-auto"
            >
              <Car className="h-4 w-4" />
              레슨 전체 운전 모드
            </button>
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
            (!lesson.examples || lesson.examples.length === 0 ? (
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
            (quizMode === null ? (
              <div className="rounded-2xl border bg-[#F7F3F0] p-6 sm:p-8 shadow-sm">
                <h2 className="mb-2 text-center text-lg sm:text-xl font-bold text-foreground">
                  학습 모드 선택
                </h2>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                  퀴즈 시작 전에 원하는 모드를 골라주세요.
                </p>
                <div className="mx-auto grid max-w-md gap-4">
                  <button
                    type="button"
                    disabled={lesson.quiz.length === 0}
                    onClick={() => {
                      resetMultipleQuiz();
                      setQuizMode("multiple");
                    }}
                    className={cn(
                      "rounded-3xl border bg-white/70 px-5 py-5 text-left shadow-sm transition-all hover:scale-105 active:scale-[1.02]",
                      "hover:border-[#6B7A5A]/50 hover:bg-white",
                      lesson.quiz.length === 0 && "cursor-not-allowed opacity-60 hover:scale-100",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold text-foreground">객관식 퀴즈</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          4지선다로 빠르게 복습해요.
                        </div>
                        {lesson.quiz.length === 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            이 레슨은 객관식 퀴즈가 아직 없어요.
                          </div>
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={speakingPracticeItems.length === 0}
                    onClick={() => {
                      resetSpeakingPractice();
                      setQuizMode("speaking");
                    }}
                    className={cn(
                      "rounded-3xl border bg-white/70 px-5 py-5 text-left shadow-sm transition-all hover:scale-105 active:scale-[1.02]",
                      "hover:border-[#7A5C45]/40 hover:bg-white",
                      speakingPracticeItems.length === 0 && "cursor-not-allowed opacity-60 hover:scale-100",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold text-foreground">
                          낭독 연습 (문장 Active Recall)
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          한국어 문장을 듣고 네팔어로 떠올려요. (랜덤 최대 10문제)
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            ) : quizMode === "speaking" ? (
              (() => {
                const vocabIndex = spkOrder[spkIdx] ?? spkIdx;
                const card = speakingPracticeItems[vocabIndex];
                const total = spkOrder.length;

                if (total === 0) {
                  return (
                    <div className="space-y-3">
                      <EmptyState message="이 레슨은 단어가 없어서 낭독 연습을 할 수 없어요." />
                      <div className="flex justify-center">
                        <Button variant="secondary" onClick={backToQuizModeSelect}>
                          모드 선택으로
                        </Button>
                      </div>
                    </div>
                  );
                }

                if (spkFinished) {
                  const wrongCount = spkAnswers.filter((x) => x === false).length;
                  return (
                    <div className="rounded-2xl border bg-[#F7F3F0] p-8 sm:p-10 text-center shadow-sm">
                      <div className="mb-3 sm:mb-4 text-4xl sm:text-5xl">🎉</div>
                      <h2 className="mb-2 text-xl sm:text-2xl font-bold text-foreground">
                        낭독 연습 완료!
                      </h2>
                      <p className="mb-4 sm:mb-6 text-base sm:text-lg text-muted-foreground">
                        <span className="font-semibold text-[#6B7A5A]">{spkScore}</span> / {total}{" "}
                        맞혔어요
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button
                          onClick={retryWrongSpeakingPractice}
                          size="lg"
                          variant="secondary"
                          disabled={wrongCount === 0}
                          className="w-full sm:w-auto"
                        >
                          틀린 것만 다시하기
                        </Button>
                        <Button
                          onClick={resetSpeakingPractice}
                          size="lg"
                          className="w-full sm:w-auto"
                        >
                          다시 하기
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={backToQuizModeSelect}
                          size="lg"
                          className="w-full sm:w-auto"
                        >
                          모드 선택
                        </Button>
                      </div>
                      {wrongCount === 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          모두 맞혀서 다시할 문제가 없어요.
                        </p>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="relative rounded-2xl border bg-[#F7F3F0] p-4 sm:p-6 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {spkIdx + 1} / {total}
                      </span>
                      <span className="rounded-full bg-[#6B7A5A]/10 px-2.5 py-1 text-xs sm:text-sm font-medium text-[#4E5A41]">
                        점수: {spkScore}
                      </span>
                    </div>

                    <div className="rounded-2xl border bg-white/70 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium tracking-wide text-[#6A4D3A]">
                            한국어 뜻
                          </div>
                          <div className="mt-1 text-lg sm:text-xl font-bold text-foreground">
                            {card?.korean ?? ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => card?.korean && speakKorean(card.korean)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white text-[#6A4D3A] shadow-sm transition-all hover:bg-[#6B7A5A]/10 active:scale-95"
                          aria-label="한국어 뜻 다시 듣기"
                        >
                          <Volume2 className="h-5 w-5" />
                        </button>
                      </div>

                      {spkRevealed ? (
                        <div className="mt-5 space-y-3">
                          <div className="rounded-xl border bg-white/80 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs font-medium tracking-wide text-[#4E5A41]">
                                  네팔어 정답
                                </div>
                                <div
                                  className="mt-1 text-xl sm:text-2xl font-bold text-foreground"
                                  style={{ fontFamily: "var(--font-nepali)" }}
                                >
                                  {card?.nepali ?? ""}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (card?._type === "example") void audioPlayer.play(`example-${lesson.id}-${card._idx}`, getExampleAudioPath(lesson.id, card._idx));
                                  else if (card?._type === "dialogue") void audioPlayer.play(`dial-${lesson.id}-${card._dIdx}-${card._lIdx}`, getDialogueAudioPath(lesson.id, card._dIdx, card._lIdx));
                                }}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white text-[#6B7A5A] shadow-sm transition-all hover:bg-[#6B7A5A]/10 active:scale-95"
                                aria-label="네팔어 정답 다시 듣기"
                              >
                                <Volume2 className="h-5 w-5" />
                              </button>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground italic">
                              {card?.romanized ?? ""}
                            </div>
                          </div>

                          {(card?.example || card?.exampleKo) && (
                            <div className="rounded-xl border bg-white/80 p-4">
                              <div className="text-xs font-medium tracking-wide text-[#4E5A41]">
                                예문
                              </div>
                              {card?.example && (
                                <div
                                  className="mt-1 text-lg font-semibold text-foreground"
                                  style={{ fontFamily: "var(--font-nepali)" }}
                                >
                                  {typeof (card as any)?.example === "string"
                                    ? (card as any).example
                                    : (card as any)?.example?.nepali ?? ""}
                                </div>
                              )}
                              {((card as any)?.exampleKo || (card as any)?.example?.korean) && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {typeof (card as any)?.exampleKo === "string"
                                    ? (card as any).exampleKo
                                    : (card as any)?.exampleKo?.korean ??
                                      (card as any)?.example?.korean ??
                                      ""}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button
                              onClick={() => markSpeakingAnswer(true)}
                              className="h-12 rounded-2xl bg-[#6B7A5A] text-white hover:bg-[#5E6C4F]"
                            >
                              맞혔어요
                            </Button>
                            <Button
                              onClick={() => markSpeakingAnswer(false)}
                              variant="secondary"
                              className="h-12 rounded-2xl"
                            >
                              틀렸어요
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="secondary"
                              onClick={goSpeakingPrev}
                              disabled={spkIdx === 0}
                              className="h-11 rounded-2xl"
                            >
                              이전
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={goSpeakingNext}
                              disabled={spkIdx + 1 >= total}
                              className="h-11 rounded-2xl"
                            >
                              다음
                            </Button>
                          </div>
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={backToQuizModeSelect}
                              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                            >
                              모드 선택으로
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-muted-foreground">
                          네팔어로 먼저 말해본 뒤, 아래 버튼으로 정답을 확인하세요.
                        </div>
                      )}
                    </div>

                    {!spkRevealed && (
                      <div className="sticky bottom-0 -mx-4 mt-5 border-t bg-[#F7F3F0] px-4 pt-4 pb-2 sm:-mx-6 sm:px-6">
                        <div className="mb-2 grid grid-cols-2 gap-2">
                          <Button variant="secondary" onClick={goSpeakingPrev} disabled={spkIdx === 0} className="h-10 rounded-2xl">
                            이전
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={goSpeakingNext}
                            disabled={spkIdx + 1 >= total}
                            className="h-10 rounded-2xl"
                          >
                            다음
                          </Button>
                        </div>
                        <Button
                          onClick={handleReveal}
                          className="h-16 w-full rounded-3xl bg-[#7A5C45] text-base font-bold text-white shadow-md hover:bg-[#6A4D3A] active:scale-[0.99]"
                        >
                          정답 확인
                        </Button>
                        <div className="mt-2 flex justify-center">
                          <Button variant="secondary" size="sm" onClick={backToQuizModeSelect}>
                            모드 선택
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : lesson.quiz.length === 0 ? (
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
                <Button onClick={resetMultipleQuiz} size="lg" className="w-full sm:w-auto">
                  다시 풀기
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
                <div className="mb-3 sm:mb-4 flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {qIdx + 1} / {lesson.quiz.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                    onClick={backToQuizModeSelect}
                      className="h-8 rounded-full px-3"
                    >
                    모드 선택
                    </Button>
                    <span className="rounded-full bg-warm/50 px-2.5 py-1 text-xs sm:text-sm font-medium text-warm-foreground">
                      점수: {score}
                    </span>
                  </div>
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
                  <div className="mt-4 sm:mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button onClick={handleNext} className="w-full sm:w-auto">
                      {qIdx + 1 >= lesson.quiz.length ? "결과 보기" : "다음 →"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={backToQuizModeSelect}
                      className="w-full sm:w-auto"
                    >
                      모드 선택
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
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={() => setIsQuizMode(true)}
                      className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
                    >
                      🧩 대화문 퀴즈 도전하기
                    </button>
                  </div>
                </div>

                {lesson.dialogues.map((dialogue: any, dIdx: number) => (
                  <div key={dIdx}>
                    <div className="mb-2 sm:mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-sm sm:text-base font-semibold text-foreground">
                        {dialogue.title}
                      </h2>
                      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                        <button
                          onMouseDown={(e) => e.preventDefault()}
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
                          onMouseDown={(e) => e.preventDefault()}
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
                            lessonVocab={lesson.vocabulary}
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

        {showDrivingMode && lesson && (
          <DrivingModePlayer
            lessonId={lesson.id}
            vocabulary={allLessonItems}
            onClose={() => setShowDrivingMode(false)}
          />
        )}
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
  line: { speaker: string; nepali: string; romanized: string; korean: string; hintKo?: string };
  lessonId: number | string;
  dIdx: number;
  idx: number;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
  playDialogueIndex: number | null;
  showRomanized: boolean;
  lessonVocab: Array<{ nepali: string; romanized: string; korean: string }>;
};

function normalizeRomanizedWord(word: string) {
  return word
    .normalize("NFKD")
    .replace(/[^\p{L}]/gu, "")
    .toLowerCase();
}

function shouldHideDialogueMeaningToken(lessonId: number | string, lineRomanized: string, vocabRomanized: string) {
  if (String(lessonId) !== "4") return false;
  const tokenKey = normalizeRomanizedWord(vocabRomanized);
  if (tokenKey !== "chha" && tokenKey !== "chhan") return false;

  const hiddenPatterns = [
    /sanchai\s+chha\b/i,
    /\bderaa\b.*\bchha\b/i,
    /\bderaamaa\b.*\bchha\b/i,
    /\bderaamaa\b.*\bchhan\b/i,
  ];

  return hiddenPatterns.some((re) => re.test(lineRomanized));
}

function DialogueLine({
  line,
  lessonId,
  dIdx,
  idx,
  audioPlayer,
  playDialogueIndex,
  showRomanized,
  lessonVocab,
}: DialogueLineProps) {
  const bookmarks = useBookmarks();
  const [showWordMeanings, setShowWordMeanings] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const itemId = `dial-${lessonId}-${dIdx}-${idx}`;
  const src = getDialogueAudioPath(lessonId, dIdx, idx);
  const isCurrent = audioPlayer.currentItemId === itemId;
  const isPlaying = isCurrent && audioPlayer.isPlaying;
  const isPlayingThisDialogue = playDialogueIndex === dIdx;
  const bookmarkId = `dialogue:${lessonId}:${dIdx}:${idx}`;
  const bookmarked = bookmarks.isBookmarked(bookmarkId);

  const matchedVocab = useMemo(() => {
    const sentence = (line.nepali ?? "").normalize("NFC");
    if (!sentence || lessonVocab.length === 0) return [];
    const hits = lessonVocab.filter((v) => {
      if (shouldHideDialogueMeaningToken(lessonId, line.romanized ?? "", v.romanized ?? "")) return false;
      const needle = (v.nepali ?? "").normalize("NFC").trim();
      if (!needle) return false;
      // Basic substring match; works well for Nepali script tokens in this dataset.
      return sentence.includes(needle);
    });
    // Avoid overly long panels: show up to 8 most relevant (longest nepali first).
    return hits.sort((a, b) => (b.nepali?.length ?? 0) - (a.nepali?.length ?? 0)).slice(0, 8);
  }, [lessonId, lessonVocab, line.nepali, line.romanized]);


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
                <button
                  type="button"
                  aria-label={bookmarked ? "북마크 해제" : "북마크"}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground transition-colors hover:bg-accent",
                    bookmarked && "bg-primary/10 text-primary hover:bg-primary/20",
                    isPlayingThisDialogue && "opacity-70",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    bookmarks.toggle({
                      id: bookmarkId,
                      kind: "dialogue",
                      lessonId,
                      nepali: line.nepali,
                      romanized: line.romanized,
                      korean: line.korean,
                      speaker: line.speaker,
                      dIdx,
                      lIdx: idx,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    });
                  }}
                >
                  <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
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

                {showHint && typeof line.hintKo === "string" && line.hintKo.trim() ? (
                  <div className="mt-3 rounded-xl border border-border/50 bg-background/60 p-3 text-left">
                    <div className="mb-2 text-[11px] font-bold text-muted-foreground">힌트</div>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{line.hintKo}</p>
                  </div>
                ) : null}

                {showWordMeanings && matchedVocab.length > 0 && (
                  <div className="mt-3 rounded-xl border border-border/50 bg-background/60 p-3 text-left">
                    <div className="mb-2 text-[11px] font-bold text-muted-foreground">단어 뜻</div>
                    <div className="space-y-1.5">
                      {matchedVocab.map((v) => (
                        <div key={`${v.nepali}-${v.romanized}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                            {v.nepali}
                          </span>
                          <span className="text-[11px] italic text-muted-foreground">({v.romanized})</span>
                          <span className="text-xs text-foreground/80">- {v.korean}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {matchedVocab.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowWordMeanings((p) => !p);
              }}
              className="self-start text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:underline"
            >
              {showWordMeanings ? "단어 뜻 숨기기" : "단어 뜻 보기"}
            </button>
          )}

          {typeof line.hintKo === "string" && line.hintKo.trim() ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowHint((p) => !p);
              }}
              className="self-start text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:underline"
            >
              {showHint ? "힌트 숨기기" : "힌트 보기"}
            </button>
          ) : null}
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
  const examples = (card.examples ?? []).map((l) => l.trim()).filter(Boolean);
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
  
  if (blob.includes("aaphno")) return false;
  
  const hasPossessive = blob.includes("'-ko'") || blob.includes("-ko") || blob.includes("소유");
  const hasErgative = blob.includes("'-le'") || blob.includes("-le") || blob.includes("타동사");
  const hasCopula = hasHoChhaHunchhaText(` ${card.lines.join(" ").toLowerCase()} `) || (blob.includes(" ho ") && blob.includes(" chha ") && blob.includes(" hunchha "));
  
  const practiceCard = toPracticeCard(card);
  let hasRealExercise = false;
  const examples = (practiceCard.examples ?? []).filter(Boolean);
  
  for (const ex of examples) {
    const nepaliMatch = ex.match(/^[^(]+/);
    const nepaliText = nepaliMatch ? nepaliMatch[0].trim() : ex;
    const words = nepaliText.split(/\s+/).filter((w) => w.replace(/[^a-zA-Z]/g, "").length >= 2);
    if (words.length > 0) {
      hasRealExercise = true;
      break;
    }
  }

  return hasPossessive || hasErgative || hasCopula || hasRealExercise;
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
          {card.examples && card.examples.length > 0 && (
            <div className="mt-4 space-y-2 rounded-xl bg-background/50 p-3.5 shadow-sm ring-1 ring-border/50">
              <p className="text-xs font-bold text-muted-foreground">예문</p>
              <div className="space-y-3">
                {card.examples.map((ex, i) => (
                  <p key={i} className="text-sm font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                    {ex}
                  </p>
                ))}
              </div>
            </div>
          )}
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
