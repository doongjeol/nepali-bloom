import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import { MAX_LESSON_ID, MIN_LESSON_ID } from "@/data/lessonsMeta";
import { DrivingModePlayer } from "@/components/DrivingModePlayer";

const MIN = MIN_LESSON_ID;
const MAX = MAX_LESSON_ID;

export const Route = createFileRoute("/study/driving")({
  validateSearch: (search: Record<string, unknown>) => {
    const s = typeof search.start === "string" || typeof search.start === "number" ? Number(search.start) : undefined;
    const e = typeof search.end === "string" || typeof search.end === "number" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(s) ? s : undefined,
      end: Number.isFinite(e) ? e : undefined,
    };
  },
  component: DrivingModePage,
});

/* ─── Range Picker (shown before learning starts) ─── */
function DrivingRangePicker({ onSubmit }: { onSubmit: (s: number, e: number) => void }) {
  const [startText, setStartText] = useState("1");
  const [endText, setEndText] = useState("5");

  const submit = () => {
    const s = Number.parseInt(startText, 10);
    const e = Number.parseInt(endText, 10);
    if (!Number.isFinite(s) || !Number.isFinite(e) || s < MIN || e > MAX || s > e) return;
    onSubmit(s, e);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0f1117] px-6 text-white">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight">🚗 운전 모드</h1>
      <p className="mb-8 text-base text-white/60">학습할 레슨 범위를 선택하세요</p>

      <div className="grid w-full max-w-xs grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-white/50">시작</span>
          <input
            value={startText}
            onChange={(e) => setStartText(e.target.value)}
            type="number"
            min={MIN}
            max={MAX}
            inputMode="numeric"
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-white/40"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-white/50">종료</span>
          <input
            value={endText}
            onChange={(e) => setEndText(e.target.value)}
            type="number"
            min={MIN}
            max={MAX}
            inputMode="numeric"
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-white/40"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-8 w-full max-w-xs rounded-2xl bg-white px-6 py-4 text-lg font-bold text-[#0f1117] active:scale-95 transition-transform"
      >
        학습 시작
      </button>

      <Link to="/study" className="mt-6 text-sm text-white/40 hover:text-white/70 transition-colors">
        ← 범위 학습으로 돌아가기
      </Link>
    </div>
  );
}

function parseGrammarCards(grammar: any[]) {
  if (!grammar || grammar.length === 0) return [];
  if (typeof grammar[0] === "object") {
    return grammar.map((g: any) => ({
      title: g.title,
      lines: g.details || [],
      examples: g.examples || [],
    }));
  }
  const cards: any[] = [];
  let currentCard: any = null;
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

/* ─── Main Driving UI ─── */
function DrivingModePage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const start = search.start;
  const end = search.end;
  const range = typeof start === "number" && typeof end === "number" ? { start, end } : null;

  const { isLoading, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });

  const allItems = useMemo(() => {
    if (!data?.lessons) return [];
    const items: any[] = [];

    data.lessons.forEach((lesson) => {
      if (lesson.vocabulary) {
        lesson.vocabulary.forEach((v: any) => items.push({ ...v, lessonId: lesson.id, type: "vocab" }));
      }

      const grammarCards = parseGrammarCards(lesson.grammar ?? []);
      grammarCards.forEach((g) => {
        g.lines.forEach((line: string) => {
          items.push({ nepali: line, romanized: "문법 설명", korean: g.title, lessonId: lesson.id, type: "grammar" });
        });
        g.examples?.forEach((ex: string) => {
          items.push({ nepali: ex, romanized: "문법 예문", korean: g.title, lessonId: lesson.id, type: "grammar" });
        });
      });

      if (lesson.dialogues) {
        lesson.dialogues.forEach((d: any, dIdx: number) => {
          d.lines.forEach((l: any, lIdx: number) => {
            items.push({ nepali: l.nepali, romanized: l.romanized, korean: `[${l.speaker}] ${l.korean}`, lessonId: lesson.id, type: "dialogue", dIdx, lIdx });
          });
        });
      }

      if (lesson.quiz) {
        lesson.quiz.forEach((q: any) => {
          items.push({ nepali: q.options[q.answer], romanized: "퀴즈 정답", korean: `[Q] ${q.question}`, lessonId: lesson.id, type: "quiz" });
        });
      }
    });

    return items;
  }, [data?.lessons]);

  // If no range selected, show range picker
  if (!range) {
    return (
      <DrivingRangePicker
        onSubmit={(s, e) => navigate({ search: { start: s, end: e } })}
      />
    );
  }

  // Loading
  if (isLoading || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0f1117] text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl animate-pulse">🚗</div>
            <p className="text-lg text-white/60">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <DrivingModePlayer
      lessonId={`${start}-${end}`}
      vocabulary={allItems}
      onClose={() => navigate({ to: "/study", search: { start, end } })}
    />
  );
}
