import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "네팔어 학습 - 홈" },
      { name: "description", content: "네팔어를 쉽고 재미있게 배워보세요" },
    ],
  }),
  component: Index,
});

const features = [
  {
    to: "/vocabulary" as const,
    icon: "📖",
    title: "단어장",
    description: "카테고리별 네팔어 단어를 학습해요",
    color: "bg-warm",
  },
  {
    to: "/quiz" as const,
    icon: "✏️",
    title: "퀴즈",
    description: "객관식 퀴즈로 실력을 테스트해요",
    color: "bg-nepali/10",
  },
  {
    to: "/dialogues" as const,
    icon: "💬",
    title: "대화문",
    description: "실생활 대화를 통해 연습해요",
    color: "bg-success/10",
  },
];

function Index() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <section className="mb-16 text-center">
          <div className="mb-6 text-6xl">🇳🇵</div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
            네팔어 학습
          </h1>
          <p className="mx-auto max-w-md text-lg text-muted-foreground">
            단어, 퀴즈, 대화문으로 네팔어를 쉽고 재미있게 배워보세요
          </p>
        </section>

        <section className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <Link
              key={f.to}
              to={f.to}
              className="group rounded-2xl border bg-card p-8 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <div
                className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl ${f.color} text-2xl`}
              >
                {f.icon}
              </div>
              <h2 className="mb-2 text-xl font-semibold text-foreground">
                {f.title}
              </h2>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </Link>
          ))}
        </section>

        <section className="mt-16 rounded-2xl bg-warm/50 p-8 text-center">
          <h2 className="mb-2 text-lg font-semibold text-warm-foreground">
            🙏 नमस्ते (나마스테)
          </h2>
          <p className="text-sm text-muted-foreground">
            네팔의 인사말 '나마스테'처럼, 따뜻한 마음으로 학습을 시작해보세요!
          </p>
        </section>
      </main>
    </div>
  );
}
