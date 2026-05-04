import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RangeSelector } from "@/components/RangeSelector";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import { cn } from "@/lib/utils";

const MIN = 1;
const MAX = 37;

type Question =
  | { kind: "vocab"; prompt: string; answer: string; options: string[] }
  | { kind: "sentence"; prompt: string; answer: string; options: string[] };

function pickDistinct<T>(items: T[], count: number, key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= count) break;
  }
  return out;
}

function shuffle<T>(arr: T[]) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const Route = createFileRoute("/study/quiz")({
  validateSearch: (search: Record<string, unknown>) => {
    const start = typeof search.start === "string" ? Number(search.start) : undefined;
    const end = typeof search.end === "string" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(start) ? start : undefined,
      end: Number.isFinite(end) ? end : undefined,
    };
  },
  component: StudyQuizPage,
});

function StudyQuizPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const range = search.start && search.end ? { start: search.start, end: search.end } : null;

  const { isLoading, error, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const pool = useMemo(() => {
    const vocab = data?.vocabulary ?? [];
    const sentences =
      data?.dialogues.flatMap((d) => d.lines.map((l) => ({ nepali: l.nepali, korean: l.korean }))) ?? [];
    return { vocab, sentences };
  }, [data?.dialogues, data?.vocabulary]);

  const makeQuestion = (): Question | null => {
    if (!pool.vocab.length && !pool.sentences.length) return null;
    const useSentence = pool.sentences.length > 0 && Math.random() < 0.35;

    if (useSentence) {
      const base = pool.sentences[Math.floor(Math.random() * pool.sentences.length)];
      const distractors = pickDistinct(shuffle(pool.sentences), 3, (x) => x.nepali)
        .map((x) => x.nepali)
        .filter((x) => x !== base.nepali);
      const options = shuffle([base.nepali, ...distractors].slice(0, 4));
      return { kind: "sentence", prompt: `다음 한국어를 네팔어로 고르세요:\n${base.korean}`, answer: base.nepali, options };
    }

    const base = pool.vocab[Math.floor(Math.random() * pool.vocab.length)];
    const distractors = pickDistinct(shuffle(pool.vocab), 3, (x) => x.nepali)
      .map((x) => x.nepali)
      .filter((x) => x !== base.nepali);
    const options = shuffle([base.nepali, ...distractors].slice(0, 4));
    return { kind: "vocab", prompt: `다음 뜻에 맞는 네팔어를 고르세요:\n${base.korean}`, answer: base.nepali, options };
  };

  useEffect(() => {
    if (!data) return;
    setQuestion(makeQuestion());
    setSelected(null);
    setRevealed(false);
    setScore({ correct: 0, total: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.range.start, data?.range.end]);

  const submit = (value: string) => {
    if (!question || revealed) return;
    setSelected(value);
    setRevealed(true);
    setScore((s) => ({ total: s.total + 1, correct: s.correct + (value === question.answer ? 1 : 0) }));
  };

  const next = () => {
    setQuestion(makeQuestion());
    setSelected(null);
    setRevealed(false);
  };

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-6">
          <Link to="/study" search={{ start: search.start, end: search.end }} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 범위 학습
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">퀴즈</h1>
          <p className="mt-1 text-sm text-muted-foreground">범위 내 단어/문장으로 랜덤 문제를 만들어요.</p>
        </div>

        {!range && (
          <RangeSelector min={MIN} max={MAX} onSubmit={({ start, end }) => navigate({ search: { start, end } })} />
        )}

        {range && (
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              범위: <span className="font-semibold text-foreground">{range.start} ~ {range.end}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              점수: <span className="font-semibold text-foreground">{score.correct}</span> / {score.total}
            </div>
          </div>
        )}

        {isLoading && <LoadingSpinner />}
        {error && <div className="rounded-2xl border bg-card p-6 text-sm text-destructive shadow-sm">{error}</div>}

        {data && question && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="whitespace-pre-wrap text-sm font-semibold text-foreground">{question.prompt}</p>
            <div className="mt-4 grid gap-2">
              {question.options.map((opt) => {
                const isAnswer = opt === question.answer;
                const isSelected = selected === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => submit(opt)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all active:scale-[0.99]",
                      !revealed && "hover:bg-accent",
                      revealed && isAnswer && "border-2 border-success bg-success/10",
                      revealed && !isAnswer && isSelected && "border-2 border-destructive bg-destructive/10",
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={next}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.99] transition-all"
                disabled={!revealed}
              >
                다음 문제
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuestion(makeQuestion());
                  setSelected(null);
                  setRevealed(false);
                  setScore({ correct: 0, total: 0 });
                }}
                className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-accent active:scale-[0.99] transition-all"
              >
                리셋
              </button>
            </div>
            {!revealed && <p className="mt-2 text-xs text-muted-foreground">정답을 고른 뒤 “다음 문제”가 활성화돼요.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
