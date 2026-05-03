import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import quizData from "@/data/quiz.json";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "퀴즈 - 네팔어 학습" },
      { name: "description", content: "객관식 퀴즈로 네팔어 실력을 테스트하세요" },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const [current, setCurrent] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answered, setAnswered] = useState(false);

  const q = quizData[current];

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelectedOption(idx);
    setAnswered(true);
    if (idx === q.answer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (current + 1 >= quizData.length) {
      setFinished(true);
    } else {
      setCurrent((c) => c + 1);
      setSelectedOption(null);
      setAnswered(false);
    }
  };

  const handleReset = () => {
    setCurrent(0);
    setSelectedOption(null);
    setScore(0);
    setFinished(false);
    setAnswered(false);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold text-foreground">✏️ 퀴즈</h1>

        {finished ? (
          <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
            <div className="mb-4 text-5xl">🎉</div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              퀴즈 완료!
            </h2>
            <p className="mb-6 text-lg text-muted-foreground">
              <span className="font-semibold text-primary">{score}</span> /{" "}
              {quizData.length} 정답
            </p>
            <div className="mb-6 h-3 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(score / quizData.length) * 100}%` }}
              />
            </div>
            <Button onClick={handleReset} size="lg">
              다시 풀기
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {current + 1} / {quizData.length}
              </span>
              <span className="rounded-full bg-warm/50 px-3 py-1 text-sm font-medium text-warm-foreground">
                점수: {score}
              </span>
            </div>

            <div className="mb-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${((current + 1) / quizData.length) * 100}%`,
                }}
              />
            </div>

            <h2 className="mb-6 mt-6 text-xl font-semibold text-foreground">
              {q.question}
            </h2>

            <div className="grid gap-3">
              {q.options.map((opt, idx) => {
                let optionStyle = "border bg-card hover:bg-accent";
                if (answered) {
                  if (idx === q.answer)
                    optionStyle = "border-2 border-success bg-success/10";
                  else if (idx === selectedOption)
                    optionStyle = "border-2 border-destructive bg-destructive/10";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    disabled={answered}
                    className={cn(
                      "rounded-xl px-5 py-4 text-left text-sm font-medium transition-all",
                      optionStyle,
                      answered && "cursor-default"
                    )}
                  >
                    <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                      {idx + 1}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className="mt-6 flex justify-end">
                <Button onClick={handleNext}>
                  {current + 1 >= quizData.length ? "결과 보기" : "다음 →"}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
