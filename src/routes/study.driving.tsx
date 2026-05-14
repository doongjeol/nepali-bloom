import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLessonRangeData } from "@/hooks/useLessonRangeData";
import { MAX_LESSON_ID, MIN_LESSON_ID } from "@/data/lessonsMeta";
import { DrivingModePlayer } from "@/components/DrivingModePlayer";
import { useBookmarks } from "@/hooks/useBookmarks";
import type { VocabularyItem } from "@/hooks/useDrivingMode";

const MIN = MIN_LESSON_ID;
const MAX = MAX_LESSON_ID;

export const Route = createFileRoute("/study/driving")({
  validateSearch: (search: Record<string, unknown>) => {
    const s = typeof search.start === "string" || typeof search.start === "number" ? Number(search.start) : undefined;
    const e = typeof search.end === "string" || typeof search.end === "number" ? Number(search.end) : undefined;
    const source = search.source === "bookmarks" ? "bookmarks" : "range";
    return {
      start: Number.isFinite(s) ? s : undefined,
      end: Number.isFinite(e) ? e : undefined,
      source,
    };
  },
  component: DrivingModePage,
});

/* ─── Range Picker (shown before learning starts) ─── */
function DrivingRangePicker({
  onSubmitRange,
  onSubmitBookmarks,
}: {
  onSubmitRange: (s: number, e: number) => void;
  onSubmitBookmarks: () => void;
}) {
  const [source, setSource] = useState<"range" | "bookmarks">("range");
  const [startText, setStartText] = useState("1");
  const [endText, setEndText] = useState("5");

  const submit = () => {
    if (source === "bookmarks") {
      onSubmitBookmarks();
      return;
    }
    const s = Number.parseInt(startText, 10);
    const e = Number.parseInt(endText, 10);
    if (!Number.isFinite(s) || !Number.isFinite(e) || s < MIN || e > MAX || s > e) return;
    onSubmitRange(s, e);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0f1117] px-6 text-white">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight">🚗 운전 모드</h1>
      <p className="mb-8 text-base text-white/60">학습할 레슨 범위를 선택하세요</p>

      <div className="mb-4 grid w-full max-w-xs grid-cols-2 gap-2 rounded-2xl border border-white/20 bg-white/5 p-2">
        <button
          type="button"
          onClick={() => setSource("range")}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
            source === "range" ? "bg-white text-[#0f1117]" : "text-white/70 hover:text-white"
          }`}
        >
          범위
        </button>
        <button
          type="button"
          onClick={() => setSource("bookmarks")}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
            source === "bookmarks" ? "bg-white text-[#0f1117]" : "text-white/70 hover:text-white"
          }`}
        >
          북마크
        </button>
      </div>

      {source === "range" ? (
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
      ) : (
        <div className="w-full max-w-xs rounded-2xl border border-white/20 bg-white/5 p-4 text-center text-sm text-white/70">
          저장한 북마크(단어/대화문)만 모아서 학습합니다.
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        className="mt-8 w-full max-w-xs rounded-2xl bg-white px-6 py-4 text-lg font-bold text-[#0f1117] active:scale-95 transition-transform"
      >
        학습 시작
      </button>

      <Link to="/study" search={{ start: undefined, end: undefined }} className="mt-6 text-sm text-white/40 hover:text-white/70 transition-colors">
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
  const source = search.source;
  const start = search.start;
  const end = search.end;
  const range = source === "range" && typeof start === "number" && typeof end === "number" ? { start, end } : null;

  const bookmarks = useBookmarks();

  const { isLoading, data } = useLessonRangeData(range, { minLessonId: MIN, maxLessonId: MAX });

  const bookmarkItems = useMemo<VocabularyItem[]>(() => {
    return bookmarks.list.map((b) => {
      if (b.kind === "dialogue") {
        return {
          nepali: b.nepali,
          romanized: b.romanized ?? "",
          korean: b.speaker ? `[${b.speaker}] ${b.korean}` : b.korean,
          lessonId: b.lessonId,
          type: "dialogue",
          dIdx: b.dIdx,
          lIdx: b.lIdx,
        };
      }
      return {
        nepali: b.nepali,
        romanized: b.romanized ?? "",
        korean: b.korean,
        lessonId: b.lessonId,
        type: "vocab",
      };
    });
  }, [bookmarks.list]);

  const allItems = useMemo(() => {
    if (source === "bookmarks") return bookmarkItems;
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
  }, [bookmarkItems, data?.lessons, source]);

  // If no range selected, show range picker
  if (source === "range" && !range) {
    return (
      <DrivingRangePicker
        onSubmitRange={(s, e) => navigate({ search: { source: "range", start: s, end: e } })}
        onSubmitBookmarks={() => navigate({ search: { source: "bookmarks", start: undefined, end: undefined } })}
      />
    );
  }

  if (source === "bookmarks" && bookmarkItems.length === 0) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0f1117] text-white px-6">
        <div className="w-full max-w-xs text-center">
          <div className="text-2xl font-extrabold">북마크가 없어요</div>
          <p className="mt-2 text-sm text-white/60">학습 화면에서 북마크를 저장한 뒤 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => navigate({ search: { source: "range", start: undefined, end: undefined } })}
            className="mt-6 w-full rounded-2xl bg-white px-6 py-4 text-base font-bold text-[#0f1117] active:scale-95 transition-transform"
          >
            범위로 학습하기
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (source === "range" && (isLoading || !data)) {
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
      lessonId={source === "bookmarks" ? "bookmarks" : `${start}-${end}`}
      vocabulary={allItems}
      onClose={() => navigate({ search: { source: "range", start: undefined, end: undefined } })}
    />
  );
}
