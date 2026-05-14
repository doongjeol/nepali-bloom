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
    // 1. h-screen 대신 min-h-[100dvh]를 사용하여 모바일 브라우저 UI를 반영한 높이를 잡습니다.
    // 내부 콘텐츠가 길어질 수 있으므로 overflow-hidden은 제거하거나 유동적으로 바꿉니다.
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Header />
      
      {/* 2. pb-32(또는 pb-36)을 주어 하단 탭 바에 콘텐츠가 절대 가려지지 않게 합니다. 
           sm(데스크톱) 환경에서는 다시 중앙 정렬(justify-center)과 패딩 초기화를 해줍니다. */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-32 pt-6 sm:justify-center sm:pb-6">
        
        {/* 상단 섹션: 마진을 살짝 줄여 공간 확보 */}
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
            40개 레슨을 통해 네팔어를 배워보세요
          </p>
        </section>

        {/* 메인 버튼 섹션 */}
        <section className="mb-6 sm:mb-8">
          <Link
            to="/lessons"
            className="group mx-auto block max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm transition-all active:scale-[0.98] hover:shadow-md sm:p-8"
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm text-2xl">
              📚
            </div>
            <h2 className="mb-1 text-xl font-semibold text-foreground">
              레슨 시작하기
            </h2>
            <p className="text-sm text-muted-foreground">
              단어장, 퀴즈, 대화문이 포함된 40개 레슨
            </p>
          </Link>
        </section>

        {/* 하단 카드 그리드: 모바일에서 가로가 좁으므로 수직/수평 정렬 조합 변경 */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
          <Link
            to="/study/vocab"
            search={{ start: undefined, end: undefined }}
            className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] sm:flex-col sm:justify-center sm:text-center sm:p-6"
          >
            <div className="text-xl sm:mb-1">📖</div>
            <div className="text-left sm:text-center">
              <h3 className="text-sm font-semibold text-foreground sm:text-base">단어장</h3>
              <p className="text-xs text-muted-foreground sm:text-sm">플립 카드 어휘 학습</p>
            </div>
          </Link>
          
          <Link
            to="/study/quiz"
            search={{ start: undefined, end: undefined }}
            className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] sm:flex-col sm:justify-center sm:text-center sm:p-6"
          >
            <div className="text-xl sm:mb-1">✏️</div>
            <div className="text-left sm:text-center">
              <h3 className="text-sm font-semibold text-foreground sm:text-base">퀴즈</h3>
              <p className="text-xs text-muted-foreground sm:text-sm">객관식 실력 테스트</p>
            </div>
          </Link>

          <Link
            to="/study/dialogues"
            search={{ start: undefined, end: undefined }}
            className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] sm:flex-col sm:justify-center sm:text-center sm:p-6"
          >
            <div className="text-xl sm:mb-1">💬</div>
            <div className="text-left sm:text-center">
              <h3 className="text-sm font-semibold text-foreground sm:text-base">대화문</h3>
              <p className="text-xs text-muted-foreground sm:text-sm">실생활 대화 연습</p>
            </div>
          </Link>

          <Link
            to="/study/driving"
            search={{ source: "range", start: undefined, end: undefined }}
            className="flex items-center gap-4 rounded-xl border border-amber-500/30 bg-[#1a1a2e] p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] sm:flex-col sm:justify-center sm:text-center sm:p-6"
          >
            <div className="text-xl sm:mb-1">🚗</div>
            <div className="text-left sm:text-center">
              <h3 className="text-sm font-semibold text-amber-300 sm:text-base">운전 모드</h3>
              <p className="text-xs text-white/50 sm:text-sm">자동 재생 · 다크</p>
            </div>
          </Link>

          <Link
            to="/study/bookmarks"
            className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] sm:flex-col sm:justify-center sm:text-center sm:p-6"
          >
            <div className="text-xl sm:mb-1">⭐</div>
            <div className="text-left sm:text-center">
              <h3 className="text-sm font-semibold text-foreground sm:text-base">북마크 복습</h3>
              <p className="text-xs text-muted-foreground sm:text-sm">저장한 것만 퀴즈</p>
            </div>
          </Link>
        </section>

        {/* 응원 메시지 섹션 */}
        <section className="mt-6 rounded-2xl bg-warm/50 p-6 text-center sm:mt-8">
          <h2 className="mb-1 text-base font-semibold text-warm-foreground sm:text-lg">
            🙏 जय मसीह (저이머씨)
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            따뜻한 마음으로 학습을 시작해보세요!
          </p>
        </section>
      </main>
    </div>
  );
}
