import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import lessonsData from "@/data/lesson_1.json";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

type Tab = "vocabulary" | "quiz" | "dialogues";

function LessonDetailPage() {
  const { lessonId } = Route.useParams();
  const lesson = lessonsData.find((l) => l.id === Number(lessonId));
  const [tab, setTab] = useState<Tab>("vocabulary");
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  // Quiz state
  const [qIdx, setQIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);

  // Dialogue state
  const [showRomanized, setShowRomanized] = useState(true);

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

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: "vocabulary", label: "단어장", icon: "📖", count: lesson.vocabulary.length },
    { key: "quiz", label: "퀴즈", icon: "✏️", count: lesson.quiz.length },
    { key: "dialogues", label: "대화문", icon: "💬", count: lesson.dialogues.length },
  ];

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
    if (idx === lesson.quiz[qIdx].answer) setScore((s) => s + 1);
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
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{lesson.title} · {lesson.description}</p>
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
                {lesson.vocabulary.map((word, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleFlip(idx)}
                    className="rounded-xl border bg-card p-4 sm:p-5 text-left shadow-sm transition-all active:scale-[0.98] hover:shadow-md"
                  >
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
                  </button>
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
                <h2 className="mb-4 sm:mb-5 text-base sm:text-lg font-semibold text-foreground">{lesson.quiz[qIdx].question}</h2>
                <div className="grid gap-2">
                  {lesson.quiz[qIdx].options.map((opt, idx) => {
                    let style = "border bg-card hover:bg-accent";
                    if (answered) {
                      if (idx === lesson.quiz[qIdx].answer) style = "border-2 border-success bg-success/10";
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
                    <div className="mb-2 sm:mb-3 flex items-center justify-between">
                      <h2 className="text-sm sm:text-base font-semibold text-foreground">{dialogue.title}</h2>
                      <button
                        onClick={() => setShowRomanized(!showRomanized)}
                        className="rounded-lg bg-secondary px-2.5 py-1.5 text-[10px] sm:text-xs font-medium text-secondary-foreground hover:bg-accent active:scale-95 transition-all"
                      >
                        {showRomanized ? "로마자 숨기기" : "로마자 보기"}
                      </button>
                    </div>
                    <div className="space-y-2.5 sm:space-y-3 rounded-2xl border bg-card p-3 sm:p-5 shadow-sm">
                      {dialogue.lines.map((line, idx) => (
                        <div key={idx} className={cn("flex gap-2 sm:gap-3", line.speaker === "B" && "flex-row-reverse text-right")}>
                          <div className={cn(
                            "flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold",
                            line.speaker === "A" ? "bg-primary text-primary-foreground" : "bg-nepali text-nepali-foreground"
                          )}>
                            {line.speaker}
                          </div>
                          <div className={cn(
                            "max-w-[80%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5",
                            line.speaker === "A" ? "rounded-tl-sm bg-warm/40" : "rounded-tr-sm bg-nepali/10"
                          )}>
                            <p className="text-sm sm:text-base font-medium text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                              {line.nepali}
                            </p>
                            {showRomanized && <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground italic">{line.romanized}</p>}
                            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">{line.korean}</p>
                          </div>
                        </div>
                      ))}
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
