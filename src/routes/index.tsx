import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { MAX_LESSON_ID } from "@/data/lessonsMeta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "네팔어 학습 - 홈" },
      { name: "description", content: "Basic Course in Spoken Nepali 기반 네팔어 학습" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
        <section className="mb-6 sm:mb-10 text-center">
          <div className="mb-2 sm:mb-4 text-5xl sm:text-6xl">🇳🇵</div>
          <h1 className="mb-2 sm:mb-4 text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            네팔어 학습
          </h1>
          <p className="mx-auto max-w-md text-sm sm:text-lg text-muted-foreground">
            Basic Course in Spoken Nepali 교재를 기반으로
            <br />
            {MAX_LESSON_ID}개 레슨을 통해 네팔어를 배워보세요
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/lessons"
              className="group mx-auto block w-full rounded-2xl border bg-card p-6 sm:p-8 text-center shadow-sm transition-all active:scale-[0.98] hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-3 sm:mb-4 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-warm text-2xl">
                📚
              </div>
              <h2 className="mb-1 sm:mb-2 text-lg sm:text-xl font-semibold text-foreground">
                레슨 시작하기
              </h2>
              <p className="text-sm text-muted-foreground">
                전체 {MAX_LESSON_ID}개 레슨을 순서대로 학습
              </p>
            </Link>
            <Link
              to="/study"
              search={{ start: undefined, end: undefined }}
              className="group mx-auto block w-full rounded-2xl border bg-card p-6 sm:p-8 text-center shadow-sm transition-all active:scale-[0.98] hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-3 sm:mb-4 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-secondary text-2xl">
                🎯
              </div>
              <h2 className="mb-1 sm:mb-2 text-lg sm:text-xl font-semibold text-foreground">
                범위 학습
              </h2>
              <p className="text-sm text-muted-foreground">
                범위를 선택해서 단어장/퀴즈/대화문 학습
              </p>
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <Link
            to="/study/vocab"
            search={{ start: undefined, end: undefined }}
            className="rounded-xl border bg-card p-4 sm:p-5 text-center shadow-sm transition-all hover:shadow-sm active:scale-[0.99]"
          >
            <div className="mb-1 sm:mb-2 text-xl sm:text-2xl">📖</div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">단어장</h3>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground hidden sm:block">
              레슨 범위를 선택해서 어휘 학습
            </p>
          </Link>
          <Link
            to="/study/quiz"
            search={{ start: undefined, end: undefined }}
            className="rounded-xl border bg-card p-4 sm:p-5 text-center shadow-sm transition-all hover:shadow-sm active:scale-[0.99]"
          >
            <div className="mb-1 sm:mb-2 text-xl sm:text-2xl">✏️</div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">퀴즈</h3>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground hidden sm:block">
              범위 내 단어/문장 랜덤 문제
            </p>
          </Link>
          <Link
            to="/study/dialogues"
            search={{ start: undefined, end: undefined }}
            className="rounded-xl border bg-card p-4 sm:p-5 text-center shadow-sm transition-all hover:shadow-sm active:scale-[0.99]"
          >
            <div className="mb-1 sm:mb-2 text-xl sm:text-2xl">💬</div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">대화문</h3>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground hidden sm:block">
              선택한 범위를 슬라이드로 학습
            </p>
          </Link>
        </section>

        <section className="mt-6 sm:mt-8 rounded-2xl bg-warm/30 p-5 sm:p-6 text-center">
          <h2 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold text-warm-foreground">
            🙏 जय मसीह (저이머씨)
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            네팔의 인사말 '저이머씨'처럼, 따뜻한 마음으로 학습을 시작해보세요!
          </p>
        </section>
      </main>
    </div>
  );
}
