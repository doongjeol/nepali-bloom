import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import vocabData from "@/data/vocabulary.json";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vocabulary")({
  head: () => ({
    meta: [
      { title: "단어장 - 네팔어 학습" },
      { name: "description", content: "카테고리별 네팔어 단어를 학습하세요" },
    ],
  }),
  component: VocabularyPage,
});

function VocabularyPage() {
  const categories = [...new Set(vocabData.map((v) => v.category))];
  const [selected, setSelected] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  const filtered = selected
    ? vocabData.filter((v) => v.category === selected)
    : vocabData;

  const toggleFlip = (id: number) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold text-foreground">📖 단어장</h1>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelected(null)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              selected === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            )}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelected(cat)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                selected === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((word) => (
            <button
              key={word.id}
              onClick={() => toggleFlip(word.id)}
              className="group rounded-xl border bg-card p-6 text-left shadow-sm transition-all hover:shadow-md"
            >
              {flipped.has(word.id) ? (
                <div className="animate-in fade-in">
                  <p className="text-lg font-semibold text-foreground">
                    {word.korean}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {word.romanized}
                  </p>
                </div>
              ) : (
                <div className="animate-in fade-in">
                  <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-nepali)" }}>
                    {word.nepali}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {word.romanized}
                  </p>
                </div>
              )}
              <span className="mt-3 inline-block rounded-full bg-warm/50 px-2.5 py-0.5 text-xs font-medium text-warm-foreground">
                {word.category}
              </span>
              <p className="mt-2 text-xs text-muted-foreground">
                탭하여 {flipped.has(word.id) ? "네팔어" : "한국어"} 보기
              </p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
