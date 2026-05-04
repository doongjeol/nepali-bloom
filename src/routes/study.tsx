import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { RangeSelector } from "@/components/RangeSelector";
import { cn } from "@/lib/utils";

const MIN = 1;
const MAX = 37;

export const Route = createFileRoute("/study")({
  validateSearch: (search: Record<string, unknown>) => {
    const start = typeof search.start === "string" ? Number(search.start) : undefined;
    const end = typeof search.end === "string" ? Number(search.end) : undefined;
    return {
      start: Number.isFinite(start) ? start : undefined,
      end: Number.isFinite(end) ? end : undefined,
    };
  },
  component: StudyHomePage,
});

function StudyHomePage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  const rangeReady = Number.isInteger(search.start) && Number.isInteger(search.end);

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-6">
          <Link to="/" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 홈
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">범위 학습</h1>
          <p className="mt-1 text-sm text-muted-foreground">원하는 레슨 범위를 선택해서 단어장/퀴즈/대화문을 학습해요.</p>
        </div>

        <RangeSelector
          min={MIN}
          max={MAX}
          initialStart={search.start}
          initialEnd={search.end}
          onSubmit={({ start, end }) => navigate({ search: { start, end } })}
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link
            to="/study/vocab"
            search={rangeReady ? { start: search.start, end: search.end } : { start: undefined, end: undefined }}
            className={cn(
              "rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.99]",
              !rangeReady && "opacity-60",
            )}
          >
            <div className="text-xl">📖</div>
            <h2 className="mt-2 font-semibold text-foreground">단어장</h2>
            <p className="mt-1 text-sm text-muted-foreground">범위 내 단어를 합쳐서 학습</p>
          </Link>
          <Link
            to="/study/quiz"
            search={rangeReady ? { start: search.start, end: search.end } : { start: undefined, end: undefined }}
            className={cn(
              "rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.99]",
              !rangeReady && "opacity-60",
            )}
          >
            <div className="text-xl">✏️</div>
            <h2 className="mt-2 font-semibold text-foreground">퀴즈</h2>
            <p className="mt-1 text-sm text-muted-foreground">단어/문장으로 랜덤 문제</p>
          </Link>
          <Link
            to="/study/dialogues"
            search={rangeReady ? { start: search.start, end: search.end } : { start: undefined, end: undefined }}
            className={cn(
              "rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.99]",
              !rangeReady && "opacity-60",
            )}
          >
            <div className="text-xl">💬</div>
            <h2 className="mt-2 font-semibold text-foreground">대화문</h2>
            <p className="mt-1 text-sm text-muted-foreground">슬라이드로 넘기며 보기</p>
          </Link>
        </div>

        {!rangeReady && (
          <p className="mt-4 text-xs text-muted-foreground">
            먼저 범위를 적용한 뒤 메뉴를 눌러주세요. (URL: <span className="font-mono">?start=1&amp;end=5</span>)
          </p>
        )}
      </main>
    </div>
  );
}
