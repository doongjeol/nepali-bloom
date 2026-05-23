import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { loadExtraLesson } from "@/data/extraLessonLoader";
import { cn } from "@/lib/utils";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { VocabLearningSystem } from "@/components/VocabLearningSystem";
import { DialogueGeneralQuiz } from "@/components/DialogueGeneralQuiz";
import { Button } from "@/components/ui/button";
import { getExtraDialogueAudioPath } from "@/lib/getAudioPath";
import { Pause, Volume2 } from "lucide-react";

export const Route = createFileRoute("/extra-lessons/$extraLessonId")({
  loader: async ({ params }) => {
    const extraLessonId = Number(params.extraLessonId);
    if (!Number.isInteger(extraLessonId)) throw new Error(`Invalid extraLessonId: ${params.extraLessonId}`);
    return await loadExtraLesson(extraLessonId);
  },
  head: ({ params, loaderData }) => {
    const lesson = loaderData;
    return {
      meta: [
        { title: `${lesson?.titleKo ?? ""} - 추가 레슨 - 네팔어 학습` },
        { name: "description", content: lesson?.description ?? "" },
      ],
    };
  },
  component: ExtraLessonDetailPage,
});

type Tab = "vocabulary" | "grammar" | "quiz" | "dialogues";

function ExtraLessonDetailPage() {
  const { extraLessonId } = Route.useParams();
  const lesson = Route.useLoaderData();
  const audioPlayer = useAudioPlayer();

  const [tab, setTab] = useState<Tab>("vocabulary");
  const [showRomanized, setShowRomanized] = useState(true);
  const [isDialogueQuizMode, setIsDialogueQuizMode] = useState(false);

  const counts = useMemo(
    () => ({
      vocabulary: lesson.vocabulary?.length ?? 0,
      grammar: lesson.grammar?.length ?? 0,
      quiz: lesson.quiz?.length ?? 0,
      dialogues: lesson.dialogues?.length ?? 0,
    }),
    [lesson],
  );

  const tabs: Array<{ key: Tab; label: string; icon: string; count: number }> = [
    { key: "vocabulary", label: "단어장", icon: "📖", count: counts.vocabulary },
    { key: "grammar", label: "문법", icon: "📏", count: counts.grammar },
    { key: "dialogues", label: "대화문", icon: "💬", count: counts.dialogues },
    { key: "quiz", label: "퀴즈", icon: "✏️", count: counts.quiz },
  ].filter((t): t is { key: Tab; label: string; icon: string; count: number } => t.count > 0 || t.key === "vocabulary");

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <Link
            to="/extra-lessons"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 추가 레슨 목록
          </Link>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-warm text-sm font-bold text-warm-foreground">
                +
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">{lesson.titleKo}</h1>
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{lesson.title}</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">ID: {extraLessonId}</div>
          </div>
          {lesson.description ? <p className="mt-2 text-sm text-muted-foreground">{lesson.description}</p> : null}
        </div>

        <div className="sticky top-12 z-40 -mx-4 bg-background/95 backdrop-blur-sm px-4 py-2 sm:static sm:mx-0 sm:px-0 sm:py-0">
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-all sm:px-3 sm:text-sm",
                  tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
                {t.count > 0 && <span className="ml-1 opacity-60">({t.count})</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 sm:mt-6">
          {tab === "vocabulary" ? (
            lesson.vocabulary?.length ? (
              <VocabLearningSystem lessonId={`extra-${extraLessonId}`} vocabulary={lesson.vocabulary} audioPlayer={audioPlayer} />
            ) : (
              <EmptyState message="단어가 없습니다." />
            )
          ) : null}

          {tab === "grammar" ? (
            lesson.grammar?.length ? (
              <div className="space-y-3 sm:space-y-4">
                {lesson.grammar.map((g: any, idx: number) => (
                  <div key={idx} className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm">
                    <div className="font-bold text-foreground">{g.title}</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {(g.details ?? []).map((d: string, di: number) => (
                        <li key={di}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="문법이 없습니다." />
            )
          ) : null}

          {tab === "quiz" ? (
            lesson.quiz?.length ? (
              <SimpleMultipleChoiceQuiz quiz={lesson.quiz} />
            ) : (
              <EmptyState message="퀴즈가 없습니다." />
            )
          ) : null}

          {tab === "dialogues" ? (
            lesson.dialogues?.length ? (
              isDialogueQuizMode ? (
                <DialogueGeneralQuiz
                  dialogues={lesson.dialogues as any}
                  lessonId={extraLessonId}
                  vocabulary={(lesson.vocabulary ?? []).map((v: any) => ({ romanized: v.romanized, korean: v.korean }))}
                  audioPlayer={audioPlayer}
                  resolveDialogueAudioSrc={(dIdx, lIdx) => getExtraDialogueAudioPath(extraLessonId, dIdx, lIdx)}
                  resolveVocabAudioSrc={() => undefined}
                  onClose={() => setIsDialogueQuizMode(false)}
                />
              ) : (
                <div className="space-y-5 sm:space-y-6">
                  <div className="rounded-2xl border bg-card p-5 text-center shadow-sm sm:p-6">
                    <h2 className="mb-2 text-lg font-bold text-foreground">대화문 퀴즈</h2>
                    <p className="mb-4 text-sm text-muted-foreground">추가 레슨 대화문으로 조립 퀴즈를 풀어보세요.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        onClick={() => setIsDialogueQuizMode(true)}
                        className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
                      >
                        🧩 대화문 퀴즈 도전하기
                      </button>
                      <Button
                        variant="secondary"
                        onClick={() => setShowRomanized((p) => !p)}
                        className="w-full sm:w-auto rounded-xl"
                      >
                        {showRomanized ? "로마자 숨기기" : "로마자 보기"}
                      </Button>
                    </div>
                  </div>

                  {lesson.dialogues.map((d: any, dIdx: number) => (
                    <div key={dIdx}>
                      <h2 className="mb-2 text-sm sm:text-base font-semibold text-foreground">{d.title}</h2>
                      <div className="space-y-2.5 sm:space-y-3 rounded-2xl border bg-card p-3 sm:p-5 shadow-sm">
                        {d.lines.map((line: any, lIdx: number) => {
                          const itemId = `extra-dial-${extraLessonId}-${dIdx}-${lIdx}`;
                          const src = getExtraDialogueAudioPath(extraLessonId, dIdx, lIdx);
                          const isPlaying = audioPlayer.currentItemId === itemId && audioPlayer.isPlaying;
                          return (
                            <div key={lIdx} className="rounded-2xl border bg-muted/20 p-3 sm:p-4">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <div className="text-xs font-semibold text-muted-foreground">{line.speaker}</div>
                                <button
                                  type="button"
                                  onClick={() => void audioPlayer.play(itemId, src, { silentError: true })}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground transition-colors hover:bg-accent"
                                  aria-label="대화문 음성 재생"
                                >
                                  {isPlaying ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                </button>
                              </div>
                              <div className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                                {line.nepali}
                              </div>
                              {showRomanized ? <div className="mt-1 text-sm italic text-muted-foreground">{line.romanized}</div> : null}
                              <div className="mt-1 text-sm text-foreground/90">{line.korean}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <EmptyState message="대화문이 없습니다." />
            )
          ) : null}
        </div>
      </main>
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

function SimpleMultipleChoiceQuiz({ quiz }: { quiz: Array<{ question: string; options: string[]; answer: number }> }) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);

  const current = quiz[qIdx];

  const select = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === current.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (qIdx + 1 >= quiz.length) setFinished(true);
    else {
      setQIdx((c) => c + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  if (finished) {
    return (
      <div className="rounded-2xl border bg-card p-8 sm:p-10 text-center shadow-sm">
        <div className="mb-3 sm:mb-4 text-4xl sm:text-5xl">🎉</div>
        <h2 className="mb-2 text-xl sm:text-2xl font-bold text-foreground">퀴즈 완료!</h2>
        <p className="mb-4 sm:mb-6 text-base sm:text-lg text-muted-foreground">
          <span className="font-semibold text-primary">{score}</span> / {quiz.length} 정답
        </p>
        <Button onClick={() => { setFinished(false); setQIdx(0); setSelected(null); setScore(0); setAnswered(false); }} size="lg" className="w-full sm:w-auto">
          다시 풀기
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
      <div className="mb-3 sm:mb-4 flex items-center justify-between">
        <span className="text-xs sm:text-sm text-muted-foreground">
          {qIdx + 1} / {quiz.length}
        </span>
        <span className="rounded-full bg-warm/50 px-2.5 py-1 text-xs sm:text-sm font-medium text-warm-foreground">
          점수: {score}
        </span>
      </div>
      <h2 className="mb-4 sm:mb-5 text-base sm:text-lg font-semibold text-foreground">{current.question}</h2>
      <div className="grid gap-2">
        {current.options.map((opt, idx) => {
          let style = "border bg-card hover:bg-accent";
          if (answered) {
            if (idx === current.answer) style = "border-2 border-success bg-success/10";
            else if (idx === selected) style = "border-2 border-destructive bg-destructive/10";
          }
          return (
            <button
              key={idx}
              onClick={() => select(idx)}
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
          <Button onClick={next} className="w-full rounded-xl">
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
