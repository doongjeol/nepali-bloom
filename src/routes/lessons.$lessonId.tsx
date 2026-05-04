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
      <div className="min-h-screen">
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

  const prevId = lesson.id > 1 ? lesson.id - 1 : null;
  const nextId = lesson.id < lessonsData.length ? lesson.id + 1 : null;

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
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Lesson header */}
        <div className="mb-6">
          <Link to="/lessons" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 레슨 목록
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {lesson.id}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{lesson.titleKo}</h1>
              <p className="text-sm text-muted-foreground">{lesson.title} · {lesson.description}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-secondary p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon} {t.label}
              {t.count > 0 && (
                <span className="ml-1 text-xs opacity-60">({t.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "vocabulary" && (
          lesson.vocabulary.length === 0 ? (
            <EmptyState message="아직 단어가 준비되지 않았습니다." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {lesson.vocabulary.map((word, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleFlip(idx)}
                  className="rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md"
                >
                  {flipped.has(idx) ? (
                    <>
                      <p className="text-lg font-semibold text-foreground">{word.korean}</p>
                      <p className="mt-1 text-sm text-muted-foreground italic">{word.romanized}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                        {word.nepali}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground italic">{word.romanized}</p>
                    </>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
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
            <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
              <div className="mb-4 text-5xl">🎉</div>
              <h2 className="mb-2 text-2xl font-bold text-foreground">퀴즈 완료!</h2>
              <p className="mb-6 text-lg text-muted-foreground">
                <span className="font-semibold text-primary">{score}</span> / {lesson.quiz.length} 정답
              </p>
              <div className="mb-6 h-3 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(score / lesson.quiz.length) * 100}%` }} />
              </div>
              <Button onClick={resetQuiz} size="lg">다시 풀기</Button>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{qIdx + 1} / {lesson.quiz.length}</span>
                <span className="rounded-full bg-warm/50 px-3 py-1 text-sm font-medium text-warm-foreground">점수: {score}</span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((qIdx + 1) / lesson.quiz.length) * 100}%` }} />
              </div>
              <h2 className="mb-5 text-lg font-semibold text-foreground">{lesson.quiz[qIdx].question}</h2>
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
                      className={cn("rounded-xl px-4 py-3 text-left text-sm font-medium transition-all", style, answered && "cursor-default")}
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
                <div className="mt-5 flex justify-end">
                  <Button onClick={handleNext}>
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
            <div className="space-y-6">
              {lesson.dialogues.map((dialogue, dIdx) => (
                <div key={dIdx}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold text-foreground">{dialogue.title}</h2>
                    <button
                      onClick={() => setShowRomanized(!showRomanized)}
                      className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent transition-colors"
                    >
                      {showRomanized ? "로마자 숨기기" : "로마자 보기"}
                    </button>
                  </div>
                  <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
                    {dialogue.lines.map((line, idx) => (
                      <div key={idx} className={cn("flex gap-3", line.speaker === "B" && "flex-row-reverse text-right")}>
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          line.speaker === "A" ? "bg-primary text-primary-foreground" : "bg-nepali text-nepali-foreground"
                        )}>
                          {line.speaker}
                        </div>
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5",
                          line.speaker === "A" ? "rounded-tl-sm bg-warm/40" : "rounded-tr-sm bg-nepali/10"
                        )}>
                          <p className="text-base font-medium text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                            {line.nepali}
                          </p>
                          {showRomanized && <p className="mt-0.5 text-xs text-muted-foreground italic">{line.romanized}</p>}
                          <p className="mt-1 text-sm text-muted-foreground">{line.korean}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Prev/Next navigation */}
        <div className="mt-8 flex items-center justify-between">
          {prevId ? (
            <Link
              to="/lessons/$lessonId"
              params={{ lessonId: String(prevId) }}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent transition-colors"
              onClick={() => { setTab("vocabulary"); setFlipped(new Set()); resetQuiz(); }}
            >
              ← Lesson {prevId}
            </Link>
          ) : <div />}
          {nextId ? (
            <Link
              to="/lessons/$lessonId"
              params={{ lessonId: String(nextId) }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
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
    <div className="rounded-2xl border bg-card p-12 text-center shadow-sm">
      <div className="mb-3 text-4xl">📝</div>
      <p className="text-muted-foreground">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">책 내용을 기반으로 곧 추가될 예정입니다.</p>
    </div>
  );
}
