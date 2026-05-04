import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RangeSelector } from "@/components/RangeSelector";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { getDialogueAudioPath, getVocabAudioPath } from "@/lib/getAudioPath";
import { cn } from "@/lib/utils";
import { MAX_LESSON_ID, MIN_LESSON_ID } from "@/data/lessonsMeta";

const MIN = MIN_LESSON_ID;
const MAX = MAX_LESSON_ID;

type QuizOption = {
  id: string;
  nepali: string;
  romanized: string;
  audioItemId: string;
  audioSrc: string;
};

type Question =
  | { kind: "vocab"; instruction: string; korean: string; answerId: string; options: QuizOption[] }
  | { kind: "sentence"; instruction: string; korean: string; answerId: string; options: QuizOption[] };

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
    const startRaw = typeof search.start === "string" || typeof search.start === "number" ? Number(search.start) : undefined;
    const endRaw = typeof search.end === "string" || typeof search.end === "number" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(startRaw) ? startRaw : undefined,
      end: Number.isFinite(endRaw) ? endRaw : undefined,
    };
  },
  component: StudyQuizPage,
});

function StudyQuizPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const start = search.start;
  const end = search.end;
  const range = typeof start === "number" && typeof end === "number" ? { start, end } : null;
  const audioPlayer = useAudioPlayer();

  const { isLoading, error, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const pool = useMemo(() => {
    const lessons = data?.lessons ?? [];
    const vocab = lessons.flatMap((lesson) =>
      (lesson.vocabulary ?? []).map((v) => ({
        lessonId: lesson.id,
        nepali: v.nepali,
        romanized: v.romanized,
        korean: v.korean,
      })),
    );
    const sentences = lessons.flatMap((lesson) =>
      (lesson.dialogues ?? []).flatMap((d, dialogueIndex) =>
        (d.lines ?? []).map((l, lineIndex) => ({
          lessonId: lesson.id,
          dialogueIndex,
          lineIndex,
          nepali: l.nepali,
          romanized: l.romanized,
          korean: l.korean,
        })),
      ),
    );
    return { vocab, sentences };
  }, [data?.lessons]);

  // Debug logs for range selection issues
  // eslint-disable-next-line no-console
  console.log("[study.quiz] search:", search, "range:", range);
  // eslint-disable-next-line no-console
  console.log("[study.quiz] data:", {
    isLoading,
    error,
    lessons: data?.lessons.length ?? null,
    vocabulary: data?.vocabulary.length ?? null,
    dialogues: data?.dialogues.length ?? null,
  });

  const makeQuestion = (): Question | null => {
    if (!pool.vocab.length && !pool.sentences.length) return null;
    const useSentence = pool.sentences.length > 0 && Math.random() < 0.35;

    if (useSentence) {
      const base = pool.sentences[Math.floor(Math.random() * pool.sentences.length)];
      const baseId = `dial:${base.lessonId}:${base.dialogueIndex}:${base.lineIndex}`;
      const distractors = pickDistinct(shuffle(pool.sentences), 3, (x) => `dial:${x.lessonId}:${x.dialogueIndex}:${x.lineIndex}`)
        .filter((x) => `dial:${x.lessonId}:${x.dialogueIndex}:${x.lineIndex}` !== baseId);
      const options = shuffle([base, ...distractors].slice(0, 4)).map((s) => {
        const id = `dial:${s.lessonId}:${s.dialogueIndex}:${s.lineIndex}`;
        return {
          id,
          nepali: s.nepali,
          romanized: s.romanized,
          audioItemId: `quiz-${id}`,
          audioSrc: getDialogueAudioPath(s.lessonId, s.dialogueIndex, s.lineIndex),
        } satisfies QuizOption;
      });
      return {
        kind: "sentence",
        instruction: "다음 한국어를 네팔어로 고르세요",
        korean: base.korean,
        answerId: baseId,
        options,
      };
    }

    const base = pool.vocab[Math.floor(Math.random() * pool.vocab.length)];
    const baseId = `vocab:${base.lessonId}:${base.romanized}`;
    const distractors = pickDistinct(shuffle(pool.vocab), 3, (x) => `vocab:${x.lessonId}:${x.romanized}`)
      .filter((x) => `vocab:${x.lessonId}:${x.romanized}` !== baseId);
    const options = shuffle([base, ...distractors].slice(0, 4)).map((v) => {
      const id = `vocab:${v.lessonId}:${v.romanized}`;
      return {
        id,
        nepali: v.nepali,
        romanized: v.romanized,
        audioItemId: `quiz-${id}`,
        audioSrc: getVocabAudioPath(v.lessonId, v.romanized),
      } satisfies QuizOption;
    });
    return {
      kind: "vocab",
      instruction: "다음 뜻에 맞는 네팔어를 고르세요",
      korean: base.korean,
      answerId: baseId,
      options,
    };
  };

  useEffect(() => {
    if (!data) return;
    setQuestion(makeQuestion());
    setSelectedId(null);
    setRevealed(false);
    setScore({ correct: 0, total: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.range.start, data?.range.end]);

  const submit = (valueId: string) => {
    if (!question || revealed) return;
    setSelectedId(valueId);
    setRevealed(true);
    setScore((s) => ({
      total: s.total + 1,
      correct: s.correct + (valueId === question.answerId ? 1 : 0),
    }));
  };

  const next = () => {
    setQuestion(makeQuestion());
    setSelectedId(null);
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

        {data && !question && (
          <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground shadow-sm">
            선택한 범위에 퀴즈를 만들 수 있는 데이터가 없어요.
          </div>
        )}

        {data && question && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="rounded-2xl border border-[#E7D7CF] bg-[#FDF2F0] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-xl bg-white/60 px-3 py-2 text-[#7A4F3B] shadow-sm">
                  <span className="text-lg font-extrabold">Q.</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#7A4F3B]/80">{question.instruction}</p>
                  <div className="mt-3 border-l-4 border-[#B28471] pl-4">
                    <p className="text-xl font-extrabold leading-snug text-[#3A2B22] sm:text-2xl">
                      {question.korean}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {question.options.map((opt) => {
                const isAnswer = opt.id === question.answerId;
                const isSelected = selectedId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      void audioPlayer.play(opt.audioItemId, opt.audioSrc);
                      if (!revealed) submit(opt.id);
                    }}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all active:scale-[0.99]",
                      !revealed && "hover:bg-accent",
                      revealed && isAnswer && "border-2 border-success bg-success/10",
                      revealed && !isAnswer && isSelected && "border-2 border-destructive bg-destructive/10",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                        {opt.nepali}
                      </p>
                      <p className="mt-0.5 text-sm italic text-muted-foreground">{opt.romanized}</p>
                    </div>
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
                  setSelectedId(null);
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
