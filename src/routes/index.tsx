import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";

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
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-12">
        <section className="mb-8 sm:mb-16 text-center">
          <div className="mb-3 sm:mb-6 text-5xl sm:text-6xl">🇳🇵</div>
          <h1 className="mb-2 sm:mb-4 text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            네팔어 학습
          </h1>
          <p className="mx-auto max-w-md text-sm sm:text-lg text-muted-foreground">
            Basic Course in Spoken Nepali 교재를 기반으로
            <br />
            37개 레슨을 통해 네팔어를 배워보세요
          </p>
        </section>

        <section className="mb-8 sm:mb-12">
          <Link
            to="/lessons"
            className="group mx-auto block max-w-lg rounded-2xl border bg-card p-6 sm:p-8 text-center shadow-sm transition-all active:scale-[0.98] hover:-translate-y-1 hover:shadow-md"
          >
            <div className="mb-3 sm:mb-4 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-warm text-2xl">
              📚
            </div>
            <h2 className="mb-1 sm:mb-2 text-lg sm:text-xl font-semibold text-foreground">
              레슨 시작하기
            </h2>
            <p className="text-sm text-muted-foreground">
              단어장, 퀴즈, 대화문이 포함된 37개 레슨
            </p>
          </Link>
        </section>

        <section className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl border bg-card p-4 sm:p-6 text-center shadow-sm">
            <div className="mb-1 sm:mb-2 text-xl sm:text-2xl">📖</div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">단어장</h3>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground hidden sm:block">
              플립 카드로 어휘를 학습
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 sm:p-6 text-center shadow-sm">
            <div className="mb-1 sm:mb-2 text-xl sm:text-2xl">✏️</div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">퀴즈</h3>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground hidden sm:block">
              객관식으로 실력 테스트
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 sm:p-6 text-center shadow-sm">
            <div className="mb-1 sm:mb-2 text-xl sm:text-2xl">💬</div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">대화문</h3>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground hidden sm:block">
              실생활 대화 연습
            </p>
          </div>
        </section>

        <section className="mt-8 sm:mt-12 rounded-2xl bg-warm/50 p-6 sm:p-8 text-center">
          <h2 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold text-warm-foreground">
            🙏 नमस्ते (나마스테)
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            네팔의 인사말 '나마스테'처럼, 따뜻한 마음으로 학습을 시작해보세요!
          </p>
        </section>
      </main>
    </div>
  );
}
