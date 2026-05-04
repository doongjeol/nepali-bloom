import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { PronunciationStudy } from "@/components/PronunciationStudy";

export const Route = createFileRoute("/study/pronunciation")({
  head: () => ({
    meta: [
      { title: "발음 연습 - 네팔어 학습" },
      { name: "description", content: "네팔어 기초 발음(모음/자음) 학습" },
    ],
  }),
  component: PronunciationPage,
});

function PronunciationPage() {
  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-6">
          <Link
            to="/lessons"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 레슨 목록
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">발음 연습</h1>
          <p className="mt-1 text-sm text-muted-foreground">카드를 눌러 소리를 듣고 익혀보세요.</p>
        </div>

        <PronunciationStudy />
      </main>
    </div>
  );
}

