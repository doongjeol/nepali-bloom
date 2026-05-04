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
    // h-screen과 overflow-hidden을 사용하여 전체 스크롤을 방지하고 내부 유동성을 확보합니다.
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />
      
      {/* py를 줄이고 justify-center를 통해 수직 중앙 정렬을 유지합니다. */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-4 sm:py-6">
        
        {/* 상단 섹션 여백 축소 (mb-8 -> mb-6) */}
        <section className="mb-6 text-center sm:mb-8">
          <div className="mb-4 flex justify-center">
            <img 
              src="/favicon.svg" 
              alt="Nepali Bloom Logo" 
              className="h-14 w-14 sm:h-16 sm:w-16 drop-shadow-sm transition-transform hover:scale-105" 
            />
          </div>
          <h2 className="mb-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            네팔어 학습
          </h2>
          <p className="mx-auto max-w-md text-base text-muted-foreground sm:text-lg">
            Basic Course in Spoken Nepali 기반으로
            <br className="hidden sm:block" />
            37개 레슨을 통해 네팔어를 배워보세요
          </p>
        </section>

        {/* 메인 버튼 여백 축소 (mb-8 -> mb-6) */}
        <section className="mb-6 sm:mb-8">
          <Link
            to="/lessons"
            className="group mx-auto block max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md sm:p-8"
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm text-2xl">
              📚
            </div>
            <h2 className="mb-1 text-xl font-semibold text-foreground">
              레슨 시작하기
            </h2>
            <p className="text-sm text-muted-foreground">
              단어장, 퀴즈, 대화문이 포함된 37개 레슨
            </p>
          </Link>
        </section>

        {/* 하단 카드 그리드 여백 및 패딩 축소 */}
        <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-xl border bg-card p-4 text-center shadow-sm sm:p-6">
            <div className="mb-1 text-xl">📖</div>
            <h3 className="text-sm font-semibold text-foreground sm:text-base">단어장</h3>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              플립 카드로 어휘 학습
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center shadow-sm sm:p-6">
            <div className="mb-1 text-xl">✏️</div>
            <h3 className="text-sm font-semibold text-foreground sm:text-base">퀴즈</h3>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              객관식 실력 테스트
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center shadow-sm sm:p-6">
            <div className="mb-1 text-xl">💬</div>
            <h3 className="text-sm font-semibold text-foreground sm:text-base">대화문</h3>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              실생활 대화 연습
            </p>
          </div>
        </section>

        {/* 하단 푸터 느낌의 섹션 여백 대폭 축소 */}
        <section className="mt-6 rounded-2xl bg-warm/50 p-4 text-center sm:mt-8 sm:p-6">
          <h2 className="mb-1 text-base font-semibold text-warm-foreground sm:text-lg">
            🙏 जय मसीह (저이머씨)
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            네팔의 인사말 '저이머씨'처럼 따뜻하게 시작해보세요!
          </p>
        </section>
      </main>
    </div>
  );
}